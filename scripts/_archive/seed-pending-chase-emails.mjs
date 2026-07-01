// One-shot seed: insert 3 pending CLIENT_CHASE OutboundEmailQueue rows on
// STAGING so Ellis can walk the email-preview/edit feature end-to-end.
//
// Each row points at a real Hartwell test contact (vendor or purchaser
// with email + portalToken) on the Tresco/Jutland/Darnley fixtures.
// scheduledFor is set to "Monday 09:00 UTC" so each row reads as a
// pending upcoming send — the test surface looks realistic.
//
// EMAIL_SANDBOX_MODE on staging keeps actual delivery off — these rows
// won't actually send even if the drain cron picks them up.
//
// Usage:  node scripts/seed-pending-chase-emails.mjs
// To clean up later:  delete the rows matching sourceId starting with "seed:"

import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

// Next Monday 09:00 UTC (rough — for display purposes only).
function nextMonday9amUTC() {
  const d = new Date();
  const day = d.getUTCDay(); // 0 = Sunday
  const daysUntilMonday = day === 1 ? 1 : (8 - day) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  d.setUTCHours(9, 0, 0, 0);
  return d;
}

const TX_IDS = [
  "cmpfbdh5b0001d9y8lh901sbh", // 40 Tresco Road
  "cmpfbzxgr00016fb29e9w9f8b", // 73 Jutland House
  "cmpf7o8u40005136353v6b2l2", // 39a Darnley Road
];

const transactions = await p.propertyTransaction.findMany({
  where: { id: { in: TX_IDS } },
  select: {
    id: true,
    propertyAddress: true,
    contacts: {
      where: {
        roleType: { in: ["vendor", "purchaser"] },
        email: { not: null },
        portalToken: { not: null },
      },
      select: { id: true, name: true, email: true, roleType: true },
      take: 1,
    },
  },
});

const scheduledFor = nextMonday9amUTC();
const scheduledLabel = scheduledFor.toLocaleString("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

let created = 0;
for (const tx of transactions) {
  const contact = tx.contacts[0];
  if (!contact || !contact.email) {
    console.log(`Skip ${tx.propertyAddress} — no eligible contact`);
    continue;
  }

  const firstName = contact.name.split(/\s+/).find((w) => !/^(Mr|Mrs|Ms|Miss|Mx|Dr)\.?$/i.test(w)) ?? contact.name;
  const shortAddress = tx.propertyAddress.split(",")[0];
  const sourceId = `seed:${tx.id}:${contact.id}:${new Date().toISOString().slice(0, 10)}`;

  // Avoid duplicates if this script is run twice
  const existing = await p.outboundEmailQueue.findFirst({
    where: { emailType: "CLIENT_CHASE", sourceId, recipientContactId: contact.id },
    select: { id: true },
  });
  if (existing) {
    console.log(`Already seeded: ${shortAddress} → ${firstName}`);
    continue;
  }

  const subject = `${shortAddress}: one update needed`;
  const text = `Hi ${firstName},

A quick update on your sale at ${shortAddress}.

There's one thing on your sale that we haven't seen confirmed yet — completing your ID & AML checks. This is something only you can move forward.

Open the page below to confirm it's done, tell us a date you're expecting, or leave a quick note about why it's delayed. It takes about a minute.

Thanks,
The team at Hartwell & Partners`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td>
          <p style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#FF6B4A;text-transform:uppercase;margin:0 0 16px;">Sales Progressor</p>
          <p style="font-size:14px;line-height:1.5;color:#1A1D29;margin:0 0 12px;">Hi ${firstName},</p>
          <p style="font-size:14px;line-height:1.5;color:#1A1D29;margin:0 0 12px;">A quick update on your sale at <strong>${shortAddress}</strong>.</p>
          <p style="font-size:14px;line-height:1.5;color:#1A1D29;margin:0 0 12px;">There's one thing on your sale that we haven't seen confirmed yet:</p>
          <ul style="font-size:14px;line-height:1.6;color:#1A1D29;margin:0 0 16px;padding-left:20px;">
            <li>Complete your ID and AML checks</li>
          </ul>
          <p style="font-size:14px;line-height:1.5;color:#1A1D29;margin:0 0 20px;">Open the page below to confirm it's done, tell us a date you're expecting, or leave a quick note.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await p.outboundEmailQueue.create({
    data: {
      emailType: "CLIENT_CHASE",
      sourceId,
      recipientEmail: contact.email,
      recipientContactId: contact.id,
      payload: { subject, text, html },
      scheduledFor,
    },
  });
  console.log(`✓ Seeded: ${shortAddress} → ${firstName} (${contact.roleType}) for ${scheduledLabel}`);
  created++;
}

console.log("");
console.log(`Done. Created ${created} pending CLIENT_CHASE row(s) on staging.`);
console.log("Walk URL: /agent/automated-emails (Pending tab)");

await p.$disconnect();
