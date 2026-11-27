// Scheduled client-invoice jobs (billing suite Phase 3).
//
//  - runMonthlyClientInvoices: on the 1st, for each business that opted into
//    auto-monthly, issue + email each active client's PRIOR-month invoice
//    (reusing sendClientInvoice; non-billable clients are skipped, never £0).
//  - runCompletionReminders: daily, for each business that opted in, email each
//    client agency a heads-up about its sale(s) completing tomorrow.
//
// Both are owner-opt-in (flags default off) and never throw per-business — one
// business's failure can't stop the rest.

import { prisma } from "@/lib/prisma";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { buildFrom } from "@/lib/email/from-name";
import { clientFacingIdentity } from "@/lib/progression/identity";
import { sendClientInvoice } from "./client-invoice-send";

export async function runMonthlyClientInvoices(now: Date = new Date()): Promise<{ businesses: number; sent: number; skipped: number }> {
  // Any day in the prior month → billingMonthRange resolves to that month.
  const prior = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const businesses = await prisma.progressionBusiness.findMany({
    where: { invoiceAutoMonthly: true, isTsp: false },
    select: { id: true },
  });
  let sent = 0, skipped = 0;
  for (const biz of businesses) {
    const owner = await prisma.user.findFirst({
      where: { progressionBusinessId: biz.id, progressionBusinessRole: "owner" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!owner) { skipped += 1; continue; }
    const clients = await prisma.progressionBusinessClient.findMany({
      where: { progressionBusinessId: biz.id, removedAt: null },
      select: { agencyId: true },
    });
    for (const c of clients) {
      try {
        const res = await sendClientInvoice(biz.id, c.agencyId, owner.id, prior);
        if (res.ok) sent += 1; else skipped += 1;
      } catch { skipped += 1; }
    }
  }
  return { businesses: businesses.length, sent, skipped };
}

export async function runCompletionReminders(now: Date = new Date()): Promise<{ businesses: number; emails: number }> {
  // Tomorrow's [start, end) in local server time.
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);

  const businesses = await prisma.progressionBusiness.findMany({
    where: { invoiceRemindDayBefore: true, isTsp: false },
    select: { id: true, name: true, senderEmail: true, senderDomain: true, senderVerified: true, isTsp: true, contactWhatsapp: true },
  });
  let emails = 0;
  for (const biz of businesses) {
    const sales = await prisma.propertyTransaction.findMany({
      where: { progressionBusinessId: biz.id, isDemo: false, status: "active", completionDate: { gte: start, lt: end } },
      select: { propertyAddress: true, agencyId: true },
    });
    if (sales.length === 0) continue;

    // Group by client agency so each gets a single heads-up.
    const byAgency = new Map<string, string[]>();
    for (const s of sales) {
      const list = byAgency.get(s.agencyId) ?? [];
      list.push(s.propertyAddress);
      byAgency.set(s.agencyId, list);
    }

    const identity = clientFacingIdentity(biz);
    const from = buildFrom(biz.name, identity.senderEmail);

    for (const [agencyId, addresses] of byAgency) {
      const director = await prisma.user.findFirst({ where: { agencyId, role: "director" }, orderBy: { createdAt: "asc" }, select: { email: true } });
      if (!director?.email) continue;
      const list = addresses.map((a) => `• ${a}`).join("\n");
      const htmlList = addresses.map((a) => `<li>${a}</li>`).join("");
      const subject = addresses.length === 1 ? `Completing tomorrow: ${addresses[0]}` : `${addresses.length} sales completing tomorrow`;
      const text = `Hi,\n\nA quick heads-up from ${biz.name}: ${addresses.length === 1 ? "a sale completes" : "the following sales complete"} tomorrow:\n\n${list}\n\nThey'll be included in your invoice for this month.\n\nThanks,\n${biz.name}`;
      const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#0F1B2D;line-height:1.55;">
        <p style="margin:0 0 12px;">Hi,</p>
        <p style="margin:0 0 12px;">A quick heads-up from ${biz.name}: ${addresses.length === 1 ? "a sale completes" : "the following sales complete"} tomorrow:</p>
        <ul style="margin:0 0 12px;padding-left:20px;">${htmlList}</ul>
        <p style="margin:0 0 12px;">They'll be included in your invoice for this month.</p>
        <p style="margin:16px 0 0;">Thanks,<br/>${biz.name}</p>
      </div>`;
      try {
        await sendAgentEmail({ to: director.email, subject, text, html, from, replyTo: identity.senderEmail, emailType: "completion_reminder", kind: "completion_reminder", agencyId });
        emails += 1;
      } catch { /* skip this agency, continue */ }
    }
  }
  return { businesses: businesses.length, emails };
}
