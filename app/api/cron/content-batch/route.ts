import { NextRequest, NextResponse } from "next/server";
import { commandDb } from "@/lib/command/prisma";
import { sendEmail } from "@/lib/email";

export const maxDuration = 60;

const CHANNEL_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
  tiktok_script: "TikTok",
  instagram_caption: "Instagram",
  instagram_reel_script: "Reel script",
};

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildHtml(
  items: Array<{ channel: string; topicSeed: string; text: string; charCount: number }>,
  date: string
): string {
  const rows = items
    .map(
      (item, i) => `
    <tr>
      <td style="padding:20px 0; border-top:1px solid #f0ebe6;">
        <p style="margin:0 0 8px 0; font-size:11px; font-weight:700; color:#FF6B4A; text-transform:uppercase; letter-spacing:0.08em;">
          ${i + 1} — ${CHANNEL_LABELS[item.channel] ?? item.channel}
          <span style="color:#aaa; font-weight:400; margin-left:8px;">${item.charCount} chars</span>
        </p>
        <p style="margin:0 0 8px 0; font-size:12px; color:#888;">
          Topic: ${item.topicSeed}
        </p>
        <div style="background:#fdf8f3; border-left:3px solid #FF6B4A; padding:14px 16px; border-radius:0 6px 6px 0;">
          <p style="margin:0; font-size:14px; line-height:1.65; color:#2D1810; white-space:pre-wrap;">${item.text}</p>
        </div>
      </td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:0; background:#f9f5f0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5f0; padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:#0a0a0a; padding:28px 32px;">
            <p style="margin:0; font-size:13px; font-weight:700; color:#FF6B4A; letter-spacing:0.05em; text-transform:uppercase;">Sales Progressor</p>
            <p style="margin:6px 0 0; font-size:22px; font-weight:700; color:#f5f5f5; letter-spacing:-0.02em;">Content batch — ${date}</p>
            <p style="margin:6px 0 0; font-size:13px; color:rgba(255,255,255,0.4);">${items.length} post${items.length !== 1 ? "s" : ""} ready to publish</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:24px 32px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${rows}
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px 32px; border-top:1px solid #f0ebe6;">
            <p style="margin:0; font-size:12px; color:#aaa;">
              Approve or remove drafts at
              <a href="https://portal.thesalesprogressor.co.uk/command/content" style="color:#FF6B4A;">command centre → content</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildText(
  items: Array<{ channel: string; topicSeed: string; text: string; charCount: number }>,
  date: string
): string {
  const lines = [
    `Content batch — ${date}`,
    `${items.length} post${items.length !== 1 ? "s" : ""} ready`,
    "",
  ];
  items.forEach((item, i) => {
    lines.push(`${i + 1}. ${CHANNEL_LABELS[item.channel] ?? item.channel} (${item.charCount} chars)`);
    lines.push(`Topic: ${item.topicSeed}`);
    lines.push("");
    lines.push(item.text);
    lines.push("---");
    lines.push("");
  });
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = todayDateString();

  // Avoid double-sending
  const existing = await commandDb.contentBatch.findUnique({ where: { date } });
  if (existing?.status === "sent") {
    return NextResponse.json({ skipped: true, reason: "already sent today" });
  }

  const drafts = await commandDb.draftPost.findMany({
    where: {
      approvedForBatch: true,
      posted: false,
      batchId: null,
    },
    orderBy: { createdAt: "asc" },
  });

  if (drafts.length === 0) {
    return NextResponse.json({ skipped: true, reason: "no approved drafts" });
  }

  // Create or upsert the batch record
  const batch = await commandDb.contentBatch.upsert({
    where: { date },
    create: { date, itemCount: drafts.length },
    update: { itemCount: drafts.length },
  });

  // Tag each draft with this batch
  await commandDb.draftPost.updateMany({
    where: { id: { in: drafts.map((d) => d.id) } },
    data: { batchId: batch.id },
  });

  // Build email payload
  const items = drafts.map((d) => {
    const text = d.editedText || (d.chosenVariant === 2 ? d.variant2 : d.variant1);
    return {
      channel: d.channel,
      topicSeed: d.topicSeed,
      text,
      charCount: text.length,
    };
  });

  const html = buildHtml(items, date);
  const text = buildText(items, date);

  await sendEmail({
    to: "inbox@thesalesprogressor.co.uk",
    subject: `Content batch — ${date} (${drafts.length} post${drafts.length !== 1 ? "s" : ""})`,
    html,
    text,
  });

  // Mark batch as sent
  await commandDb.contentBatch.update({
    where: { id: batch.id },
    data: { status: "sent", sentAt: new Date() },
  });

  return NextResponse.json({ ok: true, sent: drafts.length, date });
}
