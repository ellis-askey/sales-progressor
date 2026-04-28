// app/api/ai/generate-chase/route.ts
// Sprint 7: Generates a chase message using Claude AI with full transaction context.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAiLimit, rateLimitJson } from "@/lib/ratelimit";

const TONE_INSTRUCTIONS: Record<string, string> = {
  Friendly:
    "Write in a warm, friendly and approachable tone. Assume good intent. Keep it conversational and light — no pressure.",
  Professional:
    "Write in a clear, professional tone. Polite but businesslike. No small talk. Focused on the action needed.",
  "Polite Yet Firm":
    "Write in a polite but firm tone. Acknowledge any delays without judgement, but make it clear this needs to move forward.",
  "Chase Up":
    "Write in a direct chase-up tone. This is a follow-up to previous messages that haven't been actioned. Be clear that a response is needed. Still professional, but noticeably more assertive.",
  Urgent:
    "Write with urgency. This is holding up the transaction. Be direct and make the consequence of further delay apparent without being rude.",
  "Final Reminder":
    "Write as a final reminder before escalation. Firm, clear, and unambiguous. State that this is the final chase before the matter is escalated. Professional but serious in tone.",
};

function getRecipientContext(
  side: string,
  contacts: Array<{ name: string; roleType: string; email?: string | null; phone?: string | null }>
) {
  const roleMap: Record<string, string[]> = {
    vendor: ["solicitor", "vendor"],
    purchaser: ["solicitor", "purchaser", "broker"],
  };
  const priorityRoles = roleMap[side] ?? ["solicitor"];
  const relevant = contacts.filter((c) => priorityRoles.includes(c.roleType));
  const primary = relevant.find((c) => c.roleType === "solicitor") ?? relevant[0];
  const secondary = relevant.filter((c) => c !== primary);
  return { primary, secondary };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const rateLimit = await checkAiLimit(session.user.id).catch(() => ({ success: true, reset: 0, remaining: 30 }));
  if (!rateLimit.success) {
    return NextResponse.json(rateLimitJson(rateLimit), { status: 429 });
  }

  const body = await req.json();
  const { chaseTaskId, channel, tone } = body as {
    chaseTaskId: string;
    channel: "email" | "whatsapp";
    tone: string;
  };

  if (!chaseTaskId || !channel || !tone) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const task = await prisma.chaseTask.findUnique({
    where: { id: chaseTaskId },
    include: {
      transaction: {
        include: {
          contacts: true,
          communications: {
            where: { type: "outbound" },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
        },
      },
      reminderLog: {
        include: {
          reminderRule: {
            include: { anchorMilestone: true },
          },
        },
      },
      assignedTo: true,
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Chase task not found" }, { status: 404 });
  }

  if (task.transaction.agencyId !== session.user.agencyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tx = task.transaction;
  const rule = task.reminderLog.reminderRule;
  const milestone = rule.anchorMilestone;
  const milestoneSide = milestone?.side ?? "vendor";

  const { primary, secondary } = getRecipientContext(milestoneSide, tx.contacts);

  const lastComm = tx.communications[0];
  const daysSinceLastChase = lastComm
    ? Math.floor((Date.now() - new Date(lastComm.createdAt).getTime()) / 86400000)
    : null;

  const formatPrice = (pence: number | null) =>
    pence ? `£${(pence / 100).toLocaleString("en-GB")}` : "Not provided";

  const formatDate = (d: Date | null | undefined) =>
    d
      ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "Not provided";

  const toneInstruction = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS["Friendly"];

  const channelInstruction =
    channel === "whatsapp"
      ? "This message will be sent via WhatsApp. Keep it concise, conversational and easy to read on a phone. No formal sign-offs. No subject lines. Max 3 short paragraphs."
      : "This message will be sent via email. It should be well-structured with a clear opening, body and sign-off. Professional but human. Include a subject line on the first line prefixed with 'Subject: '.";

  const prompt = `You are a sales progressor at a UK residential estate agency. You are drafting a chase message to send to a party involved in a property transaction.

TONE: ${toneInstruction}

CHANNEL: ${channelInstruction}

---

TRANSACTION CONTEXT
Property address: ${tx.propertyAddress}
Sale price: ${formatPrice(tx.purchasePrice ?? null)}
Purchase type: ${tx.purchaseType ?? "Not provided"}
Tenure: ${tx.tenure ?? "Not provided"}
Target exchange date: ${formatDate(tx.expectedExchangeDate)}

---

MILESTONE BEING CHASED
Milestone: ${milestone?.name ?? rule.name}
Side: ${milestoneSide} (${milestoneSide === "vendor" ? "seller's" : "buyer's"} side)
This milestone blocks exchange: ${milestone?.blocksExchange ? "Yes — this is holding up the transaction" : "No"}

---

CHASE HISTORY
Number of times chased: ${task.chaseCount}
Days since last chase: ${daysSinceLastChase !== null ? `${daysSinceLastChase} days` : "First chase"}
Last outbound message summary: ${lastComm?.content ? lastComm.content.slice(0, 300) + (lastComm.content.length > 300 ? "..." : "") : "None"}

---

RECIPIENT
Primary contact: ${primary?.name ?? "Unknown"} (${primary?.roleType ?? "Unknown role"})
${secondary.length > 0 ? `Also involved: ${secondary.map((c) => `${c.name} (${c.roleType})`).join(", ")}` : ""}

Sent by (your name): ${session.user.name}

---

INSTRUCTIONS
- Address the primary contact by first name only
- Do not mention specific legal advice or make promises about outcomes
- Do not reference any information about the other side of the transaction
- Do not invent facts — if something says "Not provided", omit it
- Sound human, not like a template
- Keep it focused on one clear ask: progressing this specific milestone
- Sign off with your name (${session.user.name}) and "Sales Progressor" as your title

Write only the message. No preamble, no explanation.`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!claudeResponse.ok) {
    const err = await claudeResponse.text();
    console.error("Claude API error:", err);
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }

  const claudeData = await claudeResponse.json();
  const generated = claudeData.content?.[0]?.text ?? "";

  return NextResponse.json({
    generated,
    context: {
      primaryContact: primary ? { name: primary.name, role: primary.roleType } : null,
      milestoneName: milestone?.name ?? rule.name,
      chaseCount: task.chaseCount,
      tone,
      channel,
    },
  });
}
