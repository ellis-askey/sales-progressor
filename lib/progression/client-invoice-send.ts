// Issue + email a client invoice (billing suite Phase 2). Builds the current
// month's invoice, renders the branded PDF, emails it to the client agency's
// director from the business's own verified sender (platform fallback when
// unverified), and persists a ClientInvoice snapshot so the ledger + re-download
// are stable. Off-Stripe — this sends the bill; collection stays off-platform.

import { prisma } from "@/lib/prisma";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { buildFrom } from "@/lib/email/from-name";
import { clientFacingIdentity } from "@/lib/progression/identity";
import { getAgencyLogoUrl } from "@/lib/supabase-storage";
import { buildBusinessClientInvoice } from "./business-client-invoice";
import { renderBusinessInvoicePdf, type BusinessInvoicePdfInput } from "./business-invoice-pdf";

export type SendClientInvoiceResult =
  | { ok: true; invoiceId: string; totalPence: number; recipient: string }
  | { ok: false; reason: "not_found" | "fee_not_set" | "no_recipient" | "send_failed" | "nothing" }
  | { ok: false; reason: "needs_price" | "needs_completion_date"; addresses: string[] };

function money(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function periodKeyFor(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit" }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "00";
  return `${y}-${m}`;
}

export async function sendClientInvoice(businessId: string, agencyId: string, actorUserId: string, now: Date = new Date()): Promise<SendClientInvoiceResult> {
  const built = await buildBusinessClientInvoice(businessId, agencyId, now);
  if (!built.ok) return built.reason === "needs_price" || built.reason === "needs_completion_date"
    ? { ok: false, reason: built.reason, addresses: built.addresses }
    : { ok: false, reason: built.reason };

  const input: BusinessInvoicePdfInput = built.input;

  // Never send a £0 invoice — nothing exchanged (or completed) for this client
  // this month, so there's nothing to bill.
  if (input.lines.length === 0) return { ok: false, reason: "nothing" };

  // Recipient: the client agency's earliest director (the established contact
  // convention — no dedicated billing-email field exists).
  const director = await prisma.user.findFirst({
    where: { agencyId, role: "director" },
    orderBy: { createdAt: "asc" },
    select: { email: true },
  });
  if (!director?.email) return { ok: false, reason: "no_recipient" };

  // Sender: the business's own verified identity, platform fallback when not.
  const biz = await prisma.progressionBusiness.findUnique({
    where: { id: businessId },
    select: { name: true, senderEmail: true, senderDomain: true, senderVerified: true, isTsp: true, contactWhatsapp: true },
  });
  const identity = clientFacingIdentity(biz);
  const from = buildFrom(input.issuerName, identity.senderEmail);
  const replyTo = identity.senderEmail;

  // Load the logo bytes for the PDF (best-effort — drops to no-logo header).
  if (built.logoPath) {
    try {
      const url = getAgencyLogoUrl(built.logoPath);
      if (url) {
        const r = await fetch(url);
        if (r.ok) input.logo = { bytes: new Uint8Array(await r.arrayBuffer()), mime: "image/png" };
      }
    } catch { /* no logo */ }
  }

  const pdf = await renderBusinessInvoicePdf(input);
  const total = input.totalPence;

  const subject = `Invoice ${input.number} from ${input.issuerName} — ${money(total)}`;
  const dueLine = input.dueLabel ? ` It's due by ${input.dueLabel}.` : "";
  const text = `Hi,\n\nPlease find attached invoice ${input.number} from ${input.issuerName} for the sales we progressed in ${input.periodLabel} — ${money(total)} in total.${dueLine}\n\nThe full breakdown is in the attached PDF.\n\nThanks,\n${input.issuerName}`;
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#0F1B2D;line-height:1.55;">
    <p style="margin:0 0 12px;">Hi,</p>
    <p style="margin:0 0 12px;">Please find attached <strong>invoice ${input.number}</strong> from ${input.issuerName} for the sales we progressed in <strong>${input.periodLabel}</strong>.</p>
    <p style="margin:0 0 12px;">Total due: <strong>${money(total)}</strong>.${dueLine}</p>
    <p style="margin:0 0 12px;">The full breakdown is in the attached PDF.</p>
    <p style="margin:16px 0 0;">Thanks,<br/>${input.issuerName}</p>
  </div>`;

  let sent = false;
  try {
    await sendAgentEmail({
      to: director.email,
      subject, text, html, from, replyTo,
      emailType: "client_invoice",
      kind: "client_invoice",
      userId: actorUserId,
      agencyId,
      attachments: [{ content: Buffer.from(pdf).toString("base64"), filename: `invoice-${input.periodLabel.replace(/\s+/g, "-").toLowerCase()}.pdf`, type: "application/pdf", disposition: "attachment" }],
    });
    sent = true;
  } catch {
    sent = false;
  }
  if (!sent) return { ok: false, reason: "send_failed" };

  // Persist/refresh the ledger row. Snapshot the input (minus logo bytes) + the
  // logo path so the ledger can re-render the exact invoice later.
  const periodKey = periodKeyFor(now);
  const dueAt = new Date(now.getTime() + input.design.paymentTermsDays * 86_400_000);
  const snapshot = { input: { ...input, logo: null }, logoPath: built.logoPath } as unknown as object;
  const row = await prisma.clientInvoice.upsert({
    where: { progressionBusinessId_agencyId_periodKey: { progressionBusinessId: businessId, agencyId, periodKey } },
    create: {
      progressionBusinessId: businessId, agencyId, periodKey, number: input.number, status: "sent",
      subtotalPence: input.subtotalPence, vatPence: input.vatPence, totalPence: total, lineCount: input.lines.length,
      snapshot: snapshot as never, recipientEmail: director.email, issuedAt: now, dueAt, sentAt: now,
    },
    update: {
      number: input.number, status: "sent",
      subtotalPence: input.subtotalPence, vatPence: input.vatPence, totalPence: total, lineCount: input.lines.length,
      snapshot: snapshot as never, recipientEmail: director.email, dueAt, sentAt: now, paidAt: null,
    },
    select: { id: true },
  });

  return { ok: true, invoiceId: row.id, totalPence: total, recipient: director.email };
}
