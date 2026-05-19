import "server-only";

import { randomInt } from "node:crypto";
import { Resend } from "resend";
import puppeteer from "puppeteer";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt-lite";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { buildPuppeteerLaunchOptions } from "@/lib/pdf/puppeteer-launch";

const PDF_NAV_TIMEOUT_MS = 30_000;

export type VoteReceiptFailureReason =
  | "missing_env"
  | "session_not_found"
  | "missing_voter_id"
  | "missing_voter_email"
  | "no_ballot"
  | "no_choices"
  | "pdf_failed"
  | "send_failed";

export type VoteReceiptResult =
  | { ok: true; emailId?: string | null }
  | { ok: false; reason: VoteReceiptFailureReason; message?: string };

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function generateReceiptPassword(): string {
  return String(randomInt(1_000_000)).padStart(6, "0");
}

type ChoiceRow = {
  geo_group_id: number;
  candidate_full_name: string | null;
  geo_group_code: string | null;
  geo_group_name: string | null;
};

type BallotRow = {
  id: string;
  voter_id: string | null;
  session_id: string | null;
  is_submitted: boolean | null;
  submitted_at: string | null;
};

type SessionRow = {
  id: string;
  voter_id: string | null;
  queue_number: number | null;
  status: string | null;
  session_end: string | null;
};

function renderVoteReceiptHtml(opts: {
  fullName: string;
  queueNumber: number | null;
  votedAt: string | null;
  rows: ChoiceRow[];
}) {
  const ORDER: Record<string, number> = { NL: 0, SL: 1, VIS: 2, MIN: 3 };
  const sections = new Map<
    number,
    { geo_group_id: number; code: string | null; name: string | null; rows: ChoiceRow[] }
  >();
  for (const r of opts.rows) {
    const cur = sections.get(r.geo_group_id) ?? {
      geo_group_id: r.geo_group_id,
      code: r.geo_group_code ?? null,
      name: r.geo_group_name ?? null,
      rows: [],
    };
    cur.rows.push(r);
    if (!cur.code && r.geo_group_code) cur.code = r.geo_group_code;
    if (!cur.name && r.geo_group_name) cur.name = r.geo_group_name;
    sections.set(r.geo_group_id, cur);
  }

  const geoBlocks = [...sections.values()]
    .sort((a, b) => {
      const aCode = (a.code ?? "").toUpperCase();
      const bCode = (b.code ?? "").toUpperCase();
      const ai = ORDER[aCode] ?? Number.POSITIVE_INFINITY;
      const bi = ORDER[bCode] ?? Number.POSITIVE_INFINITY;
      if (ai !== bi) return ai - bi;
      const aName = (a.name ?? "").trim();
      const bName = (b.name ?? "").trim();
      if (aName !== bName) return aName.localeCompare(bName, undefined, { sensitivity: "base" });
      return a.geo_group_id - b.geo_group_id;
    })
    .map((sec) => {
      const label = (sec.name ?? "").trim() || `Geo group ${sec.geo_group_id}`;
      const items = sec.rows
        .map((r) => `<li>${escapeHtml(r.candidate_full_name ?? "—")}</li>`)
        .join("");
      return `
        <div class="section">
          <div class="section-title">${escapeHtml(label)}</div>
          <ul class="list">${items}</ul>
        </div>
      `;
    })
    .join("");

  const votedAtText = opts.votedAt ? new Date(opts.votedAt).toLocaleString() : "—";
  const queueText = opts.queueNumber != null ? String(opts.queueNumber) : "—";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Vote Receipt</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #111; }
      .card { border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 18px 20px; color: #fff; }
      .header h1 { margin: 0; font-size: 18px; }
      .header p { margin: 6px 0 0; opacity: .9; font-size: 12px; }
      .body { padding: 18px 20px; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; }
      .meta .k { color: #555; }
      .meta .v { font-weight: 600; }
      .divider { height: 1px; background: #eee; margin: 14px 0; }
      .section { margin-top: 12px; }
      .section-title { font-size: 13px; font-weight: 700; margin-bottom: 6px; }
      .list { margin: 0; padding-left: 18px; }
      .list li { margin: 4px 0; font-size: 12px; }
      .foot { margin-top: 14px; font-size: 11px; color: #666; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header">
        <h1>PhALGA Voting Receipt</h1>
        <p>Password-protected PDF containing your voted candidates</p>
      </div>
      <div class="body">
        <div class="meta">
          <div>
            <div class="k">Voter</div>
            <div class="v">${escapeHtml(opts.fullName)}</div>
          </div>
          <div>
            <div class="k">Queue #</div>
            <div class="v">${escapeHtml(queueText)}</div>
          </div>
          <div>
            <div class="k">Vote casted at</div>
            <div class="v">${escapeHtml(votedAtText)}</div>
          </div>
        </div>

        <div class="divider"></div>

        ${geoBlocks || `<div class="foot">No choices found.</div>`}

        <div class="divider"></div>
        <div class="foot">
          This PDF is password protected. If you did not request this, you may ignore this email.
        </div>
      </div>
    </div>
  </body>
</html>`;
}

async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch(buildPuppeteerLaunchOptions());
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(PDF_NAV_TIMEOUT_MS);
    page.setDefaultTimeout(PDF_NAV_TIMEOUT_MS);
    await page.setContent(html, { waitUntil: "load", timeout: PDF_NAV_TIMEOUT_MS });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
    });
    return Buffer.from(pdf);
  } finally {
    try {
      await browser?.close();
    } catch {
      // ignore
    }
  }
}

/**
 * Resolve the ballot row for a voting session. Ballots are unique per `voter_id`
 * in this app; `submit_ballot` may not update `session_id`, so voter_id lookup
 * must come before session_id.
 */
async function resolveBallotForReceipt(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  opts: { sessionId: string; voterId: string },
): Promise<BallotRow | null> {
  const { sessionId, voterId } = opts;

  const { data: byVoterSubmitted } = await supabase
    .from("ballots")
    .select("id, voter_id, session_id, is_submitted, submitted_at")
    .eq("voter_id", voterId)
    .eq("is_submitted", true)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (byVoterSubmitted) return byVoterSubmitted as BallotRow;

  const { data: byVoter } = await supabase
    .from("ballots")
    .select("id, voter_id, session_id, is_submitted, submitted_at")
    .eq("voter_id", voterId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byVoter) return byVoter as BallotRow;

  const { data: bySession } = await supabase
    .from("ballots")
    .select("id, voter_id, session_id, is_submitted, submitted_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (bySession) return bySession as BallotRow;

  try {
    const { data: byVotingSession, error: vsErr } = await supabase
      .from("ballots")
      .select("id, voter_id, session_id, is_submitted, submitted_at")
      .eq("voting_session_id", sessionId)
      .maybeSingle();
    if (!vsErr && byVotingSession) return byVotingSession as BallotRow;
  } catch {
    // Legacy column may not exist on all deployments.
  }

  return null;
}

async function loadBallotChoices(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  ballotId: string,
): Promise<ChoiceRow[]> {
  const { data: choices } = await supabase
    .from("ballot_choices")
    .select(
      `
      geo_group_id,
      candidates:candidate_id ( full_name ),
      geo_groups:geo_group_id ( code, name )
    `,
    )
    .eq("ballot_id", ballotId)
    .order("created_at", { ascending: true });

  return (choices ?? []).map((r: Record<string, unknown>) => {
    const candidates = r.candidates as { full_name?: string | null } | null;
    const geoGroups = r.geo_groups as { code?: string | null; name?: string | null } | null;
    return {
      geo_group_id: Number(r.geo_group_id),
      candidate_full_name: candidates?.full_name ?? null,
      geo_group_code: geoGroups?.code ?? null,
      geo_group_name: geoGroups?.name ?? null,
    };
  });
}

async function sendReceiptForResolvedBallot(opts: {
  session: SessionRow;
  ballot: BallotRow;
  voterEmail: string;
  voterFullName: string;
  apiKey: string;
  fromEmail: string;
}): Promise<VoteReceiptResult> {
  const { session, ballot, voterEmail, voterFullName, apiKey, fromEmail } = opts;
  const supabase = createSupabaseServiceRoleClient();

  const rows = await loadBallotChoices(supabase, ballot.id);
  if (rows.length === 0 && ballot.is_submitted) {
    // eslint-disable-next-line no-console
    console.error("vote receipt: submitted ballot has no choices", {
      sessionId: session.id,
      ballotId: ballot.id,
      voterId: ballot.voter_id,
    });
    return { ok: false, reason: "no_choices", message: "No ballot choices found." };
  }

  const password = generateReceiptPassword();
  const votedAt =
    ballot.submitted_at ?? session.session_end ?? new Date().toISOString();

  const html = renderVoteReceiptHtml({
    fullName: voterFullName,
    queueNumber: session.queue_number,
    votedAt,
    rows,
  });

  let pdf: Buffer;
  try {
    pdf = await htmlToPdfBuffer(html);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("vote receipt PDF generation failed", {
      sessionId: session.id,
      ballotId: ballot.id,
      error: e,
    });
    return { ok: false, reason: "pdf_failed", message: "Unable to generate receipt PDF." };
  }

  let encrypted: Buffer;
  try {
    const encryptedBytes = await encryptPDF(pdf, password, password);
    encrypted = Buffer.from(encryptedBytes);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("vote receipt PDF encryption failed", { sessionId: session.id, error: e });
    return { ok: false, reason: "pdf_failed", message: "Unable to encrypt receipt PDF." };
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: voterEmail,
    subject: "Your PhALGA vote receipt (password protected PDF)",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <p>Dear ${escapeHtml(voterFullName)},</p>
        <p>Attached is your vote receipt PDF showing your voted candidates per geo group.</p>
        <p><b>This PDF is password protected.</b><br/>
          Password:
          <code style="font-family: 'Courier New', monospace; padding: 2px 6px; background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 4px;">${escapeHtml(password)}</code>
        </p>
        <p>Keep this email private — anyone with the password can open the PDF. If you did not request this, you may ignore this email.</p>
      </div>
    `,
    attachments: [
      {
        filename: "vote-receipt.pdf",
        content: encrypted.toString("base64"),
        contentType: "application/pdf",
      },
    ],
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error("vote receipt email failed", {
      sessionId: session.id,
      ballotId: ballot.id,
      message: (error as { message?: string }).message ?? String(error),
    });
    return { ok: false, reason: "send_failed", message: "Email provider rejected the send." };
  }

  // eslint-disable-next-line no-console
  console.log("vote receipt email sent", {
    sessionId: session.id,
    ballotId: ballot.id,
    id: (data as { id?: string } | null)?.id ?? null,
  });
  return { ok: true, emailId: (data as { id?: string } | null)?.id ?? null };
}

/**
 * Send the password-protected vote receipt for a voting session.
 */
export async function sendVoterReceiptEmail(sessionId: string): Promise<VoteReceiptResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    // eslint-disable-next-line no-console
    console.warn("vote receipt email skipped: missing RESEND env");
    return { ok: false, reason: "missing_env" };
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data: sessionRaw } = await supabase
    .from("voting_sessions")
    .select("id, voter_id, queue_number, status, session_end")
    .eq("id", sessionId)
    .maybeSingle();

  if (!sessionRaw) {
    // eslint-disable-next-line no-console
    console.warn("vote receipt email skipped: session not found", { sessionId });
    return { ok: false, reason: "session_not_found" };
  }

  const session = sessionRaw as SessionRow;
  const voterId = session.voter_id;
  if (!voterId) {
    // eslint-disable-next-line no-console
    console.warn("vote receipt email skipped: missing voter_id", { sessionId });
    return { ok: false, reason: "missing_voter_id" };
  }

  const { data: voter } = await supabase
    .from("voters")
    .select("id, full_name, email")
    .eq("id", voterId)
    .maybeSingle();

  const email = (voter as { email?: string | null } | null)?.email ?? null;
  const fullName = (voter as { full_name?: string | null } | null)?.full_name ?? null;
  if (!email || !fullName) {
    // eslint-disable-next-line no-console
    console.warn("vote receipt email skipped: missing voter email/name", { sessionId, voterId });
    return { ok: false, reason: "missing_voter_email" };
  }

  const ballot = await resolveBallotForReceipt(supabase, { sessionId, voterId });
  if (!ballot) {
    // eslint-disable-next-line no-console
    console.warn("vote receipt email skipped: no ballot found", { sessionId, voterId });
    return { ok: false, reason: "no_ballot" };
  }

  return sendReceiptForResolvedBallot({
    session,
    ballot,
    voterEmail: email,
    voterFullName: fullName,
    apiKey,
    fromEmail,
  });
}

/**
 * Admin resend: look up ballot by id, then send receipt using its session or voter.
 */
export async function sendVoterReceiptEmailForBallot(ballotId: string): Promise<VoteReceiptResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    return { ok: false, reason: "missing_env" };
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: ballotRaw } = await supabase
    .from("ballots")
    .select("id, voter_id, session_id, is_submitted, submitted_at")
    .eq("id", ballotId)
    .maybeSingle();

  if (!ballotRaw) {
    return { ok: false, reason: "no_ballot", message: "Ballot not found." };
  }

  const ballot = ballotRaw as BallotRow;
  if (!ballot.is_submitted) {
    return { ok: false, reason: "no_ballot", message: "Ballot has not been submitted yet." };
  }

  const voterId = ballot.voter_id;
  if (!voterId) {
    return { ok: false, reason: "missing_voter_id" };
  }

  let session: SessionRow | null = null;
  if (ballot.session_id) {
    const { data: s } = await supabase
      .from("voting_sessions")
      .select("id, voter_id, queue_number, status, session_end")
      .eq("id", ballot.session_id)
      .maybeSingle();
    session = (s as SessionRow | null) ?? null;
  }

  if (!session) {
    const { data: s } = await supabase
      .from("voting_sessions")
      .select("id, voter_id, queue_number, status, session_end")
      .eq("voter_id", voterId)
      .maybeSingle();
    session = (s as SessionRow | null) ?? null;
  }

  if (!session) {
    session = {
      id: ballot.session_id ?? ballot.id,
      voter_id: voterId,
      queue_number: null,
      status: "voted",
      session_end: ballot.submitted_at,
    };
  }

  const { data: voter } = await supabase
    .from("voters")
    .select("id, full_name, email")
    .eq("id", voterId)
    .maybeSingle();

  const email = (voter as { email?: string | null } | null)?.email ?? null;
  const fullName = (voter as { full_name?: string | null } | null)?.full_name ?? null;
  if (!email || !fullName) {
    return { ok: false, reason: "missing_voter_email" };
  }

  return sendReceiptForResolvedBallot({
    session,
    ballot,
    voterEmail: email,
    voterFullName: fullName,
    apiKey,
    fromEmail,
  });
}
