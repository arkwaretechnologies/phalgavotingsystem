"use server";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { setVotingSessionCookie } from "@/lib/voting/session-cookie";
import { getTabletSessionMatching } from "@/lib/tablet/session";
import { toPublicMessage } from "@/lib/errors/public-message";
import { getBallotSubmissionEligibility } from "@/lib/voting/voting-ballot-eligibility";
import { tryRateLimit } from "@/lib/security/rate-limit";
import {
  isVotingSessionStatusVoted,
  isVotingSessionStatusVoting,
  normalizeVotingSessionStatus,
} from "@/lib/voting/normalize-voting-session-status";
import { tryResumeVotingSession } from "@/lib/voting/resume-voting-session";

const INVALID_LOGIN_MSG = encodeURIComponent("Invalid queue number or 6-digit ballot code.");
const VOTING_CONFLICT_MSG = encodeURIComponent(
  "Another voting session is already in progress. Ask Comelec staff if you need help.",
);

type SupabaseClient = ReturnType<typeof createSupabaseServiceRoleClient>;

async function finalizeVoterLogin(sessionId: string, supabase: SupabaseClient): Promise<never> {
  const { data: settingsRow } = await supabase
    .from("app_settings")
    .select("active_confcode")
    .eq("id", 1)
    .maybeSingle();

  const rawConf = (settingsRow as { active_confcode?: string | null } | null)?.active_confcode;
  const confcode =
    rawConf != null && String(rawConf).trim() !== "" ? String(rawConf).trim() : null;

  const { data: sessionForBallot } = await supabase
    .from("voting_sessions")
    .select("voter_id")
    .eq("id", sessionId)
    .maybeSingle();
  const voterIdForBallot = (sessionForBallot as { voter_id?: string | null } | null)?.voter_id;

  if (voterIdForBallot) {
    const { error: ballotUpsertErr } = await supabase.from("ballots").upsert(
      {
        voter_id: voterIdForBallot,
        session_id: sessionId,
        confcode,
        is_submitted: false,
        submitted_at: null,
      },
      { onConflict: "voter_id" },
    );
    if (ballotUpsertErr) throw ballotUpsertErr;
  } else {
    const { error: ballotErr } = await supabase
      .from("ballots")
      .update({ confcode })
      .eq("session_id", sessionId);
    if (ballotErr) throw ballotErr;
  }

  await setVotingSessionCookie(sessionId);
  redirect("/vote");
}

/** When status is `voting`, try resume or classify for caller. */
async function handleExistingVotingSession(
  supabase: SupabaseClient,
  queueNumber: number,
  token: string,
  tabletId: number | null,
  votedVia: "tablet" | "phone",
): Promise<
  | { action: "resume"; sessionId: string }
  | { action: "used" }
  | { action: "voting_blocked" }
  | { action: "reverted_queued" }
> {
  const resume = await tryResumeVotingSession({
    queueNumber,
    token,
    tabletId,
    votedVia,
  });
  if (resume.kind === "resume") {
    return { action: "resume", sessionId: resume.sessionId };
  }
  if (resume.kind === "already_submitted") {
    return { action: "used" };
  }

  const { data: refreshed } = await supabase
    .from("voting_sessions")
    .select("status")
    .eq("queue_number", queueNumber)
    .eq("token", token)
    .maybeSingle();
  if (normalizeVotingSessionStatus(refreshed?.status) === "queued") {
    return { action: "reverted_queued" };
  }
  return { action: "voting_blocked" };
}

async function claimSessionFallback(
  supabase: SupabaseClient,
  queueNumber: number,
  token: string,
  tabletId: number | null,
  votedVia: "tablet" | "phone",
): Promise<string> {
  const { data: session, error: sErr } = await supabase
    .from("voting_sessions")
    .select("id, status")
    .eq("queue_number", queueNumber)
    .eq("token", token)
    .maybeSingle();
  if (sErr) throw sErr;
  if (!session?.id) redirect(`/vote/login?error=invalid&msg=${INVALID_LOGIN_MSG}`);

  const rowStatus = normalizeVotingSessionStatus(session.status);
  if (rowStatus !== "queued") {
    if (isVotingSessionStatusVoted(session.status)) {
      redirect(
        `/vote/login?error=used&msg=${encodeURIComponent("Voter already casted vote.")}`,
      );
    }
    if (isVotingSessionStatusVoting(session.status)) {
      const resolved = await handleExistingVotingSession(
        supabase,
        queueNumber,
        token,
        tabletId,
        votedVia,
      );
      if (resolved.action === "resume") {
        return resolved.sessionId;
      }
      if (resolved.action === "used") {
        redirect(
          `/vote/login?error=used&msg=${encodeURIComponent("Voter already casted vote.")}`,
        );
      }
      if (resolved.action === "reverted_queued") {
        return claimSessionFallback(supabase, queueNumber, token, tabletId, votedVia);
      }
      redirect(`/vote/login?error=voting&msg=${VOTING_CONFLICT_MSG}`);
    }
    redirect(
      `/vote/login?error=notqueued&msg=${encodeURIComponent(
        "This voter is not waiting in the queue. Ask Comelec staff if you need a new queue number.",
      )}`,
    );
  }

  const { error: upErr } = await supabase
    .from("voting_sessions")
    .update({
      status: "voting",
      voted_via: votedVia,
      session_start: new Date().toISOString(),
      tablet_id: tabletId,
    })
    .eq("id", session.id);
  if (upErr) throw upErr;

  if (tabletId) {
    const { error: tErr } = await supabase
      .from("tablets")
      .update({
        status: "in_use",
        current_session: session.id,
        last_active_at: new Date().toISOString(),
      })
      .eq("id", tabletId);
    if (tErr) throw tErr;
  }

  return String(session.id);
}

export async function loginWithQueueAndToken(formData: FormData) {
  const queueNumberRaw = String(formData.get("queue_number") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  const tabletIdRaw = String(formData.get("tablet_id") ?? "").trim();
  const tabletId = tabletIdRaw ? Number(tabletIdRaw) : null;

  const queueNumber = Number(queueNumberRaw);
  if (!Number.isFinite(queueNumber) || queueNumber <= 0) {
    redirect(`/vote/login?error=invalid&msg=${INVALID_LOGIN_MSG}`);
  }
  if (!/^\d{6}$/.test(token)) {
    redirect(`/vote/login?error=invalid&msg=${INVALID_LOGIN_MSG}`);
  }
  if (tabletId !== null && (!Number.isFinite(tabletId) || tabletId <= 0)) {
    redirect(`/vote/login?error=invalid&msg=${INVALID_LOGIN_MSG}`);
  }

  if (tabletId !== null) {
    const tabletSession = await getTabletSessionMatching(tabletId);
    if (!tabletSession) {
      redirect(`/vote/login?error=invalid&msg=${INVALID_LOGIN_MSG}`);
    }
  }

  const hdrs = await headers();
  const ipHeader =
    hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? "unknown";
  const clientIp = ipHeader.split(",")[0]?.trim() || "unknown";
  const rl = await tryRateLimit({
    bucket: "voter_login",
    key: `${clientIp}:${queueNumber}`,
    limit: 10,
    windowSeconds: 60,
  });
  if (!rl.ok) {
    redirect(
      `/vote/login?error=unknown&msg=${encodeURIComponent(
        "Too many sign-in attempts. Please wait a minute and try again.",
      )}`,
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  const votedVia = tabletId ? "tablet" : "phone";

  try {
    const el = await getBallotSubmissionEligibility();
    if (!el.ok) {
      if (el.kind === "closed") {
        redirect(`/vote/login?error=closed&msg=${encodeURIComponent(el.message)}`);
      }
      redirect(`/vote/login?error=unknown&msg=${encodeURIComponent(el.message)}`);
    }

    let sessionId: string | null = null;
    const { data, error } = await supabase.rpc("claim_session", {
      p_queue_number: queueNumber,
      p_token: token,
      p_voted_via: votedVia,
    });
    if (!error && data) {
      sessionId = String(data);
      if (votedVia === "phone") {
        const { error: phoneQueueErr } = await supabase
          .from("voting_sessions")
          .update({
            status: "voting",
            voted_via: "phone",
            session_start: new Date().toISOString(),
            tablet_id: null,
          })
          .eq("id", sessionId);
        if (phoneQueueErr) throw phoneQueueErr;
      }
    } else if (
      error?.message?.includes("schema cache") ||
      error?.message?.includes("Could not find the function")
    ) {
      sessionId = await claimSessionFallback(supabase, queueNumber, token, tabletId, votedVia);
    } else if (error) {
      const { data: statusProbe } = await supabase
        .from("voting_sessions")
        .select("status")
        .eq("queue_number", queueNumber)
        .eq("token", token)
        .maybeSingle();
      if (isVotingSessionStatusVoted(statusProbe?.status)) {
        redirect(`/vote/login?error=used&msg=${encodeURIComponent("Voter already casted vote.")}`);
      }
      if (isVotingSessionStatusVoting(statusProbe?.status)) {
        const resolved = await handleExistingVotingSession(
          supabase,
          queueNumber,
          token,
          tabletId,
          votedVia,
        );
        if (resolved.action === "resume") {
          await finalizeVoterLogin(resolved.sessionId, supabase);
        }
        if (resolved.action === "used") {
          redirect(
            `/vote/login?error=used&msg=${encodeURIComponent("Voter already casted vote.")}`,
          );
        }
        if (resolved.action === "reverted_queued") {
          const { data: retryData, error: retryErr } = await supabase.rpc("claim_session", {
            p_queue_number: queueNumber,
            p_token: token,
            p_voted_via: votedVia,
          });
          if (!retryErr && retryData) {
            sessionId = String(retryData);
            if (votedVia === "phone") {
              const { error: phoneQueueErr } = await supabase
                .from("voting_sessions")
                .update({
                  status: "voting",
                  voted_via: "phone",
                  session_start: new Date().toISOString(),
                  tablet_id: null,
                })
                .eq("id", sessionId);
              if (phoneQueueErr) throw phoneQueueErr;
            }
          } else {
            sessionId = await claimSessionFallback(
              supabase,
              queueNumber,
              token,
              tabletId,
              votedVia,
            );
          }
        } else {
          redirect(`/vote/login?error=voting&msg=${VOTING_CONFLICT_MSG}`);
        }
      }

      if (!sessionId) {
        const msg = String(error.message ?? "").toLowerCase();
        if (
          msg.includes("already voting") ||
          msg.includes("already in voting") ||
          msg.includes("session is voting") ||
          msg.includes("not queued") ||
          msg.includes("not_queued") ||
          msg.includes("not in queued") ||
          (msg.includes("queued") && msg.includes("voting"))
        ) {
          const resolved = await handleExistingVotingSession(
            supabase,
            queueNumber,
            token,
            tabletId,
            votedVia,
          );
          if (resolved.action === "resume") {
            await finalizeVoterLogin(resolved.sessionId, supabase);
          }
          if (resolved.action === "used") {
            redirect(
              `/vote/login?error=used&msg=${encodeURIComponent("Voter already casted vote.")}`,
            );
          }
          if (resolved.action === "reverted_queued") {
            sessionId = await claimSessionFallback(
              supabase,
              queueNumber,
              token,
              tabletId,
              votedVia,
            );
          } else {
            redirect(`/vote/login?error=voting&msg=${VOTING_CONFLICT_MSG}`);
          }
        }
        if (!sessionId) {
          if (msg.includes("invalid") || msg.includes("not found") || msg.includes("token")) {
            redirect(`/vote/login?error=invalid&msg=${INVALID_LOGIN_MSG}`);
          }
          if (msg.includes("voted")) {
            redirect(
              `/vote/login?error=used&msg=${encodeURIComponent("Voter already casted vote.")}`,
            );
          }
          if (msg.includes("already") || msg.includes("used")) {
            redirect(
              `/vote/login?error=used&msg=${encodeURIComponent("Voter already casted vote.")}`,
            );
          }
          throw error;
        }
      }
    }

    if (!sessionId) redirect(`/vote/login?error=invalid&msg=${INVALID_LOGIN_MSG}`);

    await finalizeVoterLogin(sessionId, supabase);
  } catch (e) {
    unstable_rethrow(e);
    console.error("vote login failed", e);
    const { message } = toPublicMessage(e, "Unable to sign in right now. Please try again.");
    redirect(`/vote/login?error=unknown&msg=${encodeURIComponent(message)}`);
  }
}
