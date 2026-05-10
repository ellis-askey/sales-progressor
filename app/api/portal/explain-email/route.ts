import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/anthropic";

const RATE_LIMIT_PER_HOUR = 3;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const SYSTEM_PROMPT = `You are a plain-English interpreter for property conveyancing emails. Your job is to help buyers and sellers understand what their solicitor is saying.

Always respond using exactly these four sections with **bold** labels as shown. Use short bullet points (-) within sections where helpful. Do NOT use any # headings of any kind.

**What they're saying:**
A brief plain-English summary of the main message.

**What you need to do:**
Any actions or decisions required from the reader. If none, write "Nothing right now."

**Deadlines or dates:**
Any time-sensitive items mentioned. If none, write "None mentioned."

**Worth flagging:**
Anything urgent, unusual, or worth asking their solicitor about. If nothing, write "Nothing unusual."

Rules:
- Write as if explaining to someone with no legal knowledge
- Keep each section to 2–4 lines maximum
- NEVER draft a reply or suggest specific responses
- NEVER give legal advice — you are explaining, not advising
- Do NOT use # headings of any kind`;

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
  const userMessage = `Please explain this solicitor email in plain English:\n\n---\n${emailBody.trim()}\n---`;

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
