import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function html(content: string, title: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — The Sales Progressor</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;color:#1a1d29;text-align:center}h1{font-size:22px;font-weight:700;margin:0 0 12px}p{font-size:14px;line-height:1.7;color:#4a5162;margin:0 0 12px}a{color:#3b82f6}</style>
</head><body>${content}</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return html(
      `<h1>Invalid link</h1><p>This link is invalid or has expired.</p><p>If you need help, contact <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a></p>`,
      "Invalid link",
    );
  }

  const link = await prisma.chainLink.findFirst({
    where: { inviteToken: token },
    select: {
      id: true,
      inviteStatus: true,
      inviteTokenExpiresAt: true,
      transactionId: true,
      stubPropertyAddress: true,
      createdByUserId: true,
      chain: {
        select: {
          createdBy: { select: { name: true } },
        },
      },
    },
  });

  if (!link) {
    return html(
      `<h1>Invalid link</h1><p>This link is invalid or has already been used.</p><p>If you need help, contact <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a></p>`,
      "Invalid link",
    );
  }

  if (link.transactionId !== null) {
    return html(
      `<h1>Already claimed</h1><p>This chain link has already been claimed. If you believe this is a mistake, contact <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a></p>`,
      "Already claimed",
    );
  }

  if (link.inviteTokenExpiresAt && link.inviteTokenExpiresAt < new Date()) {
    return html(
      `<h1>Invite expired</h1><p>This invite link has expired. Contact the inviting agent to request a fresh invite.</p>`,
      "Invite expired",
    );
  }

  if (link.inviteStatus === "DECLINED") {
    return html(
      `<h1>Already declined</h1><p>This invite was already declined. Contact the inviting agent if you'd like to be re-invited.</p>`,
      "Already declined",
    );
  }

  await prisma.chainLink.update({
    where: { id: link.id },
    data: { inviteStatus: "DECLINED", inviteDeclinedAt: new Date() },
  });

  // Notify the originator via in-app notification field
  if (link.createdByUserId) {
    await prisma.user.update({
      where: { id: link.createdByUserId },
      data: {
        chainDeclineNotificationAddress: link.stubPropertyAddress ?? "a sale",
        chainDeclineNotificationAt: new Date(),
      },
    }).catch((err) => console.error("Failed to set chain decline notification:", err));
  }

  const originatorName = link.chain.createdBy?.name ?? "the inviting agent";

  return html(
    `<h1>Thanks — we've let them know</h1>
<p>This invite has been declined. ${originatorName} will see this and can update the contact details if needed.</p>
<p>If you received this in error and want to report it, email <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a></p>`,
    "Invite declined",
  );
}
