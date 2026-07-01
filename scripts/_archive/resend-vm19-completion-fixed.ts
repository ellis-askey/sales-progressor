// One-shot: resend the VM19 vendorAgent ("Exchange confirmed") email
// for 22a Main Road South, Dagnall to Taylor + ellisaskey, AFTER the
// 2026-06-17 {completionDate} interpolation fix landed in
// lib/services/portal.ts. The first email (screenshot 2026-06-17) went
// out with the literal "{completionDate}" placeholder because the var
// wasn't in extraVars — see commit a165e83.
//
// Reproduces the production render path: same template strings from
// lib/portal-copy.ts → VM19.vendorAgent and same richMilestoneEmailHtml
// + interpolate logic from lib/services/portal.ts. Inlined here so the
// script doesn't import Prisma chains or trigger prod side-effects
// (queue writes, comms log, push notifications).
//
// Run:
//   env $(grep -E "^DATABASE_URL=|^DIRECT_URL=|^SENDGRID_API_KEY=" .env.production | xargs) \
//     npx tsx scripts/resend-vm19-completion-fixed.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import sgMail from "@sendgrid/mail";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const ADDRESS_NEEDLE = "22a Main Road South, Dagnall";
const ELLIS = "ellisaskey@googlemail.com";

// ─── Template (VM19.vendorAgent from lib/portal-copy.ts:646-653) ─────
const VM19_VENDOR_AGENT = {
  subject: "Exchange confirmed — {address}",
  heroLabel: "Contracts exchanged",
  opening: "Exchange confirmed on {address}.",
  whatHappened: "Contracts have exchanged. Both parties are now legally committed. Completion is set for {completionDate}.",
  whatNext: null as string | null,
  action: "View in dashboard",
};

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

function buildGreeting(name: string | null): string {
  const first = (name ?? "there").split(" ")[0];
  return `Hi ${first},`;
}

// ─── HTML builder (lib/services/portal.ts:1218-1275, minus
//      progressor/whatsapp branches we know don't apply for Akeman) ──
function buildHtml(opts: {
  greeting: string;
  copy: typeof VM19_VENDOR_AGENT;
  vars: Record<string, string>;
  address: string;
  ctaUrl: string;
  progressorName: string;
  serviceType: string | null;
}): string {
  const { greeting, copy, vars, address, ctaUrl, progressorName, serviceType } = opts;
  const ctaBg = "#FF6B4A"; // agent variant
  const ctaLabel = copy.action ?? "View portal";
  const whatNextBlock = copy.whatNext
    ? `<p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#4a5162">${interpolate(copy.whatNext, vars)}</p>`
    : "";
  const signatureBlock = serviceType === "self_managed"
    ? `<p style="margin:0;font-size:13px;color:#4a5162">Questions? Just reply to this email.</p>`
    : `<p style="margin:0;font-size:13px;color:#4a5162">Questions? Your progressor is <strong>${progressorName}</strong>.</p>`;

  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:0;color:#1a1d29;background:#fff">
<div style="background:linear-gradient(135deg,#FF8A65 0%,#FFB74D 100%);padding:32px 32px 28px;border-radius:0 0 24px 24px">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75)">${address}</p>
  <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;line-height:1.3">${interpolate(copy.heroLabel, vars)}</h1>
</div>
<div style="padding:28px 32px">
  <p style="margin:0 0 16px;font-size:15px">${greeting}</p>
  <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#1a1d29;line-height:1.5">${interpolate(copy.opening, vars)}</p>
  <p style="margin:0 0 ${copy.whatNext ? "20px" : "28px"};font-size:14px;line-height:1.7;color:#4a5162">${interpolate(copy.whatHappened, vars)}</p>
  ${whatNextBlock}
  ${copy.action ? `<p style="margin:0 0 28px"><a href="${ctaUrl}" style="display:inline-block;background:${ctaBg};color:#fff;padding:13px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">${ctaLabel}</a></p>` : ""}
  ${signatureBlock}
</div>
</body></html>`;
}

async function main() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("SENDGRID_API_KEY missing");
  sgMail.setApiKey(apiKey);

  const tx = await prisma.propertyTransaction.findFirst({
    where: { propertyAddress: { contains: ADDRESS_NEEDLE } },
    select: {
      id: true,
      propertyAddress: true,
      completionDate: true,
      serviceType: true,
      agentUser: { select: { name: true, email: true } },
      assignedUser: { select: { name: true, email: true } },
    },
  });
  if (!tx) throw new Error(`No tx matching "${ADDRESS_NEEDLE}"`);

  const address = tx.propertyAddress;
  const completionDateVar = tx.completionDate
    ? new Date(tx.completionDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "a date to be confirmed";
  const progressorName = tx.assignedUser?.name ?? "Your sales progressor";
  const base = "https://portal.thesalesprogressor.co.uk";
  const dashUrl = `${base}/transactions/${tx.id}`;

  const vars = { address, completionDate: completionDateVar };
  const subject = interpolate(VM19_VENDOR_AGENT.subject, vars);

  console.log("Tx:                ", tx.id, "—", address);
  console.log("completionDate raw:", tx.completionDate);
  console.log("completionDate var:", completionDateVar);
  console.log("Agent (Taylor):    ", tx.agentUser?.email);
  console.log("Subject:           ", subject);
  console.log("");

  for (const recipient of [tx.agentUser?.email, ELLIS].filter((x): x is string => !!x)) {
    const greetingName = recipient === ELLIS ? "Ellis" : tx.agentUser?.name ?? null;
    const greeting = buildGreeting(greetingName);
    const html = buildHtml({ greeting, copy: VM19_VENDOR_AGENT, vars, address, ctaUrl: dashUrl, progressorName, serviceType: tx.serviceType });
    const text = [greeting, "", interpolate(VM19_VENDOR_AGENT.whatHappened, vars)].join("\n");

    await sgMail.send({
      to: recipient,
      from: "Sales Progressor <updates@thesalesprogressor.co.uk>",
      subject,
      text,
      html,
    });
    console.log(`✓ Sent to ${recipient}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
