import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/anthropic";
import { isAgentPortalView } from "@/lib/portal/preview";
import { EXPLAIN_EMAIL_SYSTEM_PROMPT as SYSTEM_PROMPT, buildExplainEmailUserMessage } from "@/lib/ai/explain-email-prompt";

const RATE_LIMIT_PER_HOUR = 3;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  // Read-only window: don't spend AI tokens explaining an email for an agent view.
  if (await isAgentPortalView()) return NextResponse.json({ error: "Read-only preview" }, { status: 403 });
  const { token, emailBody } = await req.json();

  if (!token || typeof emailBody !== "string" || emailBody.trim().length < 20) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (emailBody.length > 8000) {
    return NextResponse.json({ error: "Email too long — please paste the relevant section only." }, { status: 400 });
  }

  const contact = await prisma.contact.findFirst({
    where: { portalToken: token },
    select: { id: true, propertyTransactionId: true, name: true },
  });

  if (!contact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Enforce the agency/business off-switch at the data-flow level, not just by
  // hiding the card. Resolve the responsible party for this sale (an external
  // progression business if the file is theirs, otherwise the agency) exactly as
  // lib/services/portal.ts does, and refuse if the helper is turned off.
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: {
      progressionBusinessId: true,
      agency: { select: { aiExplainEmailEnabled: true } },
      progressionBusiness: { select: { aiExplainEmailEnabled: true } },
    },
  });
  const owner = tx?.progressionBusinessId ? tx.progressionBusiness : tx?.agency;
  if (owner && owner.aiExplainEmailEnabled === false) {
    return NextResponse.json({ error: "This feature is turned off." }, { status: 403 });
  }

  // Rate limit: max 3 explain-email uses per contact per hour
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS);
  const recentUses = await prisma.outboundMessage.count({
    where: {
      transactionId: contact.propertyTransactionId,
      type: "internal_note",
      content: { startsWith: "[AI explain-email]" },
      createdAt: { gte: windowStart },
    },
  });

  if (recentUses >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { error: "You've used this feature a few times recently. Please try again in an hour." },
      { status: 429 }
    );
  }

  // Log metadata (NOT the email content)
  await prisma.outboundMessage.create({
    data: {
      transactionId: contact.propertyTransactionId,
      type: "internal_note",
      contactIds: [contact.id],
      content: `[AI explain-email] ${contact.name} used the solicitor email explainer`,
    },
  });

  // Call Claude
  const userMessage = buildExplainEmailUserMessage(emailBody);

  try {
    const explanation = await callClaude(SYSTEM_PROMPT, userMessage, 1200);
    return NextResponse.json({ explanation });
  } catch (err) {
    console.error("[explain-email] Claude error:", err);
    return NextResponse.json(
      { error: "Sorry, we couldn't process that right now. Please try again in a moment." },
      { status: 500 }
    );
  }
}
