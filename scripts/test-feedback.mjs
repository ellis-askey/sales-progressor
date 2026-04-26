// One-shot test: inserts a feedback row and sends the email
// Run with: node scripts/test-feedback.mjs

import { PrismaClient } from "@prisma/client";
import sgMail from "@sendgrid/mail";
import { readFileSync } from "fs";
// Load .env manually
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

const prisma = new PrismaClient();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FEEDBACK_TO   = "inbox@thesalesprogressor.co.uk";
const FEEDBACK_FROM = "Sales Progressor <updates@thesalesprogressor.co.uk>";

async function run() {
  console.log("1/3  Inserting test row into feedback_submissions…");

  const row = await prisma.feedbackSubmission.create({
    data: {
      category:     "question",
      userRole:     "director",
      userEmail:    "ellisaskey@googlemail.com",
      field1:       "Test question — does the feedback API work end-to-end?",
      field2:       null,
      url:          "https://thesalesprogressor.co.uk/agent/dashboard",
      browser:      "Chrome 132 on macOS",
      viewportSize: "1440x900",
      userAgent:    "test-script",
    },
  });

  console.log("   ✓ Row created — id:", row.id);

  console.log("2/3  Sending email to", FEEDBACK_TO, "…");

  const subject = "[Question] Test question — does the feedback API work end";

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:560px;margin:32px auto;padding:0 16px">
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="padding:24px 28px;border-bottom:1px solid #f3f4f6">
      <span style="display:inline-block;padding:4px 10px;border-radius:99px;background:#e0f2fe;color:#075985;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Question</span>
      <p style="margin:12px 0 4px;font-size:13px;color:#374151"><strong>Test User</strong> · Director</p>
      <p style="margin:0;font-size:12px;color:#6b7280">ellisaskey@googlemail.com</p>
    </div>
    <div style="padding:24px 28px;border-bottom:1px solid #f3f4f6">
      <p style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px">The question</p>
      <p style="font-size:14px;color:#111827;margin:0">Test question — does the feedback API work end-to-end?</p>
    </div>
    <div style="padding:20px 28px;background:#f9fafb">
      <p style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px">Context</p>
      <p style="font-size:12px;color:#6b7280;margin:0 0 4px"><strong>URL:</strong> https://thesalesprogressor.co.uk/agent/dashboard</p>
      <p style="font-size:12px;color:#6b7280;margin:0 0 4px"><strong>Browser:</strong> Chrome 132 on macOS</p>
      <p style="font-size:12px;color:#6b7280;margin:0 0 4px"><strong>Viewport:</strong> 1440x900</p>
      <p style="font-size:11px;color:#d1d5db;margin:12px 0 0">ID: ${row.id} · This is a test submission — safe to ignore</p>
    </div>
  </div>
</div>
</body></html>`;

  await sgMail.send({
    to:      FEEDBACK_TO,
    from:    FEEDBACK_FROM,
    replyTo: "ellisaskey@googlemail.com",
    subject,
    text:    `[Question]\nFrom: Test User (Director)\nEmail: ellisaskey@googlemail.com\n\nQuestion:\nTest question — does the feedback API work end-to-end?\n\nURL: https://thesalesprogressor.co.uk/agent/dashboard\nBrowser: Chrome 132 on macOS\nID: ${row.id}`,
    html,
  });

  console.log("   ✓ Email sent");

  console.log("3/3  Marking email_sent = true on the row…");
  await prisma.feedbackSubmission.update({
    where: { id: row.id },
    data: { emailSent: true, emailSentAt: new Date() },
  });

  console.log("   ✓ Done\n");
  console.log("Check inbox@thesalesprogressor.co.uk for the test email.");
  console.log("Row id:", row.id);
}

run()
  .catch((e) => { console.error("✗ Error:", e.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
