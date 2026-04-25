import "server-only";

import { Resend } from "resend";
import puppeteer from "puppeteer";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt-lite";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function lastNameLower(fullName: string) {
  const parts = String(fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const last = parts.length ? parts[parts.length - 1] : "";
  return last.replaceAll(/[^a-zA-Z0-9]+/g, "").toLowerCase();
}

function last4Digits(phone: string) {
  const digits = String(phone ?? "").replaceAll(/\D+/g, "");
  if (digits.length < 4) return "";
  return digits.slice(-4);
}

function buildPassword(fullName: string, phone: string) {
  const ln = lastNameLower(fullName);
  const p4 = last4Digits(phone);
  if (!ln || !p4) return null;
  return `${ln}${p4}`;
}

type ChoiceRow = {
  geo_group_id: number;
  candidate_full_name: string | null;
  geo_group_code: string | null;
  geo_group_name: string | null;
};

function renderVoteReceiptHtml(opts: {
  fullName: string;
  queueNumber: number | null;
  votedAt: string | null;
  rows: ChoiceRow[];
}) {
  const sections = new Map<string, ChoiceRow[]>();
  for (const r of opts.rows) {
    const label = `${r.geo_group_code ?? r.geo_group_id} — ${r.geo_group_name ?? ""}`.trim();
    const list = sections.get(label) ?? [];
    list.push(r);
    sections.set(label, list);
  }

  const geoBlocks = [...sections.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, rows]) => {
      const items = rows
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

async function htmlToPdfBuffer(html: string) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
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

export async function sendVoterReceiptEmail(sessionId: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    // eslint-disable-next-line no-console
    console.warn("vote receipt email skipped: missing RESEND env");
    return;
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data: session } = await supabase
    .from("voting_sessions")
    .select("id, voter_id, queue_number, status, session_end")
    .eq("id", sessionId)
    .maybeSingle();

  const voterId = (session as { voter_id?: string | null } | null)?.voter_id ?? null;
  if (!voterId) {
    // eslint-disable-next-line no-console
    console.warn("vote receipt email skipped: missing voter_id", { sessionId });
    return;
  }

  const { data: voter } = await supabase
    .from("voters")
    .select("id, full_name, email, phone")
    .eq("id", voterId)
    .maybeSingle();

  const email = (voter as { email?: string | null } | null)?.email ?? null;
  const fullName = (voter as { full_name?: string | null } | null)?.full_name ?? null;
  const phone = (voter as { phone?: string | null } | null)?.phone ?? null;
  if (!email || !fullName) {
    // eslint-disable-next-line no-console
    console.warn("vote receipt email skipped: missing voter email/name", { sessionId, voterId });
    return;
  }

  const password = buildPassword(fullName, phone ?? "");
  if (!password) {
    // eslint-disable-next-line no-console
    console.warn("vote receipt email skipped: cannot build pdf password", { sessionId, voterId });
    return;
  }

  // Find ballot id for this session. Schema variants: ballots.session_id or ballots.voting_session_id.
  const ballotRespA = await supabase
    .from("ballots")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();
  const ballotId =
    (ballotRespA.data as { id?: string } | null)?.id ??
    ((await supabase.from("ballots").select("id").eq("voting_session_id", sessionId).maybeSingle()).data as
      | { id?: string }
      | null)?.id ??
    null;
  if (!ballotId) {
    // eslint-disable-next-line no-console
    console.warn("vote receipt email skipped: no ballot found for session", { sessionId, voterId });
    return;
  }

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

  const rows: ChoiceRow[] = (choices ?? []).map((r: any) => ({
    geo_group_id: Number(r.geo_group_id),
    candidate_full_name: r.candidates?.full_name ?? null,
    geo_group_code: r.geo_groups?.code ?? null,
    geo_group_name: r.geo_groups?.name ?? null,
  }));

  const html = renderVoteReceiptHtml({
    fullName,
    queueNumber: (session as any)?.queue_number ?? null,
    votedAt: (session as any)?.session_end ?? null,
    rows,
  });

  const pdf = await htmlToPdfBuffer(html);

  const encryptedBytes = await encryptPDF(pdf, password, password);
  const encrypted = Buffer.from(encryptedBytes);

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "Your PhALGA vote receipt (password protected PDF)",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <p>Dear ${escapeHtml(fullName)},</p>
        <p>Attached is your vote receipt PDF showing your voted candidates per geo group.</p>
        <p><b>This PDF is password protected.</b><br/>
          Password format: <b>lastname (lowercase) + last 4 digits of your phone number</b>.
        </p>
        <p>If you did not request this, you may ignore this email.</p>
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
      sessionId,
      voterId,
      message: (error as any)?.message ?? String(error),
      name: (error as any)?.name,
      statusCode: (error as any)?.statusCode,
    });
  } else {
    // eslint-disable-next-line no-console
    console.log("vote receipt email sent", { sessionId, voterId, id: (data as any)?.id ?? null });
  }
}

