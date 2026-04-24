import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/anthropic";

const RATE_LIMIT_PER_HOUR = 3;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const SYSTEM_PROMPT = `You are a plain-English interpreter for property conveyancing emails. Your job is to help buyers and sellers understand what their solicitor is saying.

Rules:
- Explain clearly in plain English, as if talking to someone with no legal knowledge
- Flag any deadlines or dates mentioned
- Identify any decisions or actions the client needs to take
- Note anything that seems concerning or urgent
- NEVER draft a reply or suggest specific responses
- NEVER give legal advice — you are explaining, not advising
- Keep your response concise and structured with short sections`;

export async function POST(req: NextRequest) {
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

  // Rate limit: max 3 explain-email uses per contact per hour
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS);
  const recentUses = await prisma.communicationRecord.count({
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
  await prisma.communicationRecord.create({
    data: {
      transactionId: contact.propertyTransactionId,
      type: "internal_note",
      contactIds: [contact.id],
      content: `[AI explain-email] ${contact.name} used the solicitor email explainer`,
    },
  });

  // Call Claude
  const userMessage = `Please explain this solicitor email in plain English:\n\n---\n${emailBody.trim()}\n---`;

  try {
    const explanation = await callClaude(SYSTEM_PROMPT, userMessage, 1024);
    return NextResponse.json({ explanation });
  } catch (err) {
    console.error("[explain-email] Claude error:", err);
    return NextResponse.json(
      { error: "Sorry, we couldn't process that right now. Please try again in a moment." },
      { status: 500 }
    );
  }
}
