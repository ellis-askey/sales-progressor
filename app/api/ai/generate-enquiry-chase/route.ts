// app/api/ai/generate-enquiry-chase/route.ts
//
// The AI draft writer for the enquiry send-a-chase drawer. Unlike the milestone
// chase generator, this is enquiry-native: it feeds the model the real state of
// the loop — whose court it's in, how many rounds have run, how many times
// replies (full or partial) have gone across, how many times we've chased, and
// crucially whether searches are back — so the chase is right for the moment. No
// asking the buyer's solicitor if they're "satisfied" before searches are in; no
// asking for replies that already landed. The model writes greeting + body only;
// the /s/ update button + sign-off are added deterministically after.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAiLimit, rateLimitJson } from "@/lib/ratelimit";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { extractFirstName } from "@/lib/contacts/displayName";
import { resolveEnquiryChaseContext } from "@/lib/enquiries/manual-chase";

// Street line only — never send the postcode to the model.
function shortAddress(full: string): string {
  const parts = full.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[0] ?? full;
}

const TONE_GUIDANCE: Record<string, string> = {
  Friendly: "Warm and light. A gentle nudge between people who are on the same side.",
  Professional: "Polite, clear, businesslike. Cordial but not chatty.",
  "Polite Yet Firm": "Courteous but with a clear expectation of a reply. Name the time that has passed.",
  "Chase Up": "This has run on. Warm but direct that you need movement, framed around the shared goal of exchange.",
  Urgent: "Time-critical. Convey that this is now holding things up, without blame. No emojis.",
  "Final Reminder": "Last nudge before escalating by phone. Firm, spare, no emojis. Still never rude.",
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const scope = getAccessScope(session);

  const rateLimit = await checkAiLimit(session.user.id).catch(() => ({ success: true, reset: 0, remaining: 30 }));
  if (!rateLimit.success) return NextResponse.json(rateLimitJson(rateLimit), { status: 429 });

  const { transactionId, tone } = (await req.json()) as { transactionId?: string; tone?: string };
  if (!transactionId || !tone) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  // Multi-tenant guard (Law 7): the caller must own/see this file.
  const owned = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ctx = await resolveEnquiryChaseContext(transactionId);
  if (!ctx) return NextResponse.json({ error: "This enquiry loop is no longer open." }, { status: 404 });
  if (!ctx.solContact?.email) {
    return NextResponse.json({ error: `No ${ctx.seller ? "seller's" : "buyer's"} solicitor on file.` }, { status: 400 });
  }

  // ── Loop state (what makes the chase right for the moment) ──────────────────
  const tracker = await prisma.enquiryTracker.findUnique({
    where: { transactionId },
    select: {
      openedAt: true,
      lastMovementAt: true,
      partialRepliesAt: true,
      escalatedAt: true,
      movements: { where: { status: "accepted" }, select: { kind: true } },
    },
  });
  const searchMs = await prisma.milestoneCompletion.findMany({
    where: { transactionId, state: "complete", milestoneDefinition: { code: { in: ["PM8", "PM13"] } } },
    select: { milestoneDefinition: { select: { code: true } } },
  });
  const doneCodes = new Set(searchMs.map((m) => m.milestoneDefinition.code));
  const searchesOrdered = doneCodes.has("PM8");
  const searchesBack = doneCodes.has("PM13");

  const kinds = (tracker?.movements ?? []).map((m) => m.kind);
  const count = (k: string) => kinds.filter((x) => x === k).length;
  const rounds = Math.max(1, count("raised"));
  const repliesSent = count("replies_sent");
  const partialCount = count("partial_replies") + (tracker?.partialRepliesAt ? 1 : 0);
  const timesChased = ctx.chaseCount + count("chased");
  const repliedEver = repliesSent > 0 || partialCount > 0;
  const anchor = tracker?.lastMovementAt ?? tracker?.openedAt ?? new Date();
  const quietDays = Math.max(0, Math.floor((Date.now() - new Date(anchor).getTime()) / 86400000));

  // The authoritative ASK, decided in code from the loop state. The model writes
  // it up in voice; it never invents a different ask.
  let ask: string;
  if (ctx.seller) {
    // Writing TO the seller's solicitor — they owe the replies (they haven't sent
    // them to the buyer's side yet). You are chasing them for those.
    ask = partialCount > 0
      ? "You are writing to the seller's solicitor, who owes the outstanding replies to enquiries. Some have already gone across. Ask for an update on the remaining replies and when to expect them. Do not imply you prepared the replies."
      : "You are writing to the seller's solicitor, who owes the replies to the buyer's enquiries. Ask where they've got to and when to expect the replies to go across. If they're waiting on something, ask them to say when they expect to respond. Do not imply you prepared the replies.";
  } else if (!searchesBack) {
    ask = "You are writing to the buyer's solicitor, who is reviewing the seller's solicitor's replies. The property searches are NOT back yet, so they cannot confirm they're satisfied. Do NOT ask if they're satisfied or ready to exchange. Ask whether they've been able to review the replies received so far and whether anything's still outstanding on the enquiries, noting searches are still awaited.";
  } else {
    ask = "You are writing to the buyer's solicitor, who is reviewing the seller's solicitor's replies, and the searches are now back. Ask whether they're now satisfied with the seller's solicitor's replies, or whether anything remains outstanding before they can report to their client.";
  }

  const facts = [
    `- Property: ${shortAddress(ctx.tx.propertyAddress)}`,
    `- The enquiries are currently with: the ${ctx.seller ? "seller's" : "buyer's"} solicitor`,
    `- Rounds of enquiries so far: ${rounds}`,
    `- Times full replies have been sent across: ${repliesSent}`,
    `- Times partial replies have gone over: ${partialCount}`,
    `- Have any replies been received at all: ${repliedEver ? "yes" : "no, not once yet"}`,
    `- Property searches: ${searchesBack ? "back" : searchesOrdered ? "ordered, not back yet" : "not ordered yet"}`,
    `- Times this side has already been chased: ${timesChased}`,
    `- Days since anything last moved on this loop: ${quietDays}`,
  ].join("\n");

  const systemPrompt = `You write short chase emails for a UK estate agency's sales progressor, keeping a residential purchase moving through the legal enquiries stage. You are writing to a conveyancing solicitor.

# Who you are (read this first, it governs every line)
You are the sales progressor at the estate agency handling this sale. You are a NEUTRAL coordinator sitting BETWEEN the two solicitors, keeping things moving. You are NOT a solicitor or conveyancer and you take NO part in the legal work.
- You did not prepare, send, or receive any enquiries, replies, or searches. The SELLER'S solicitor sends the replies to enquiries; the BUYER'S solicitor raises the enquiries and reviews those replies.
- NEVER write "we sent our replies", "our replies", "the replies we've sent", "we're satisfied", or anything implying you did the legal work. It is the solicitors' work, never yours.
- Refer to the replies as the SELLER'S solicitor's ("the replies that have gone across", "the seller's solicitor's responses"). When writing to the buyer's solicitor, the enquiries are "your enquiries".
- Speak as one person: "I" and "me". Never "we / us / our" about the legal work. ("I'm just chasing", "let me know", "I can help move it along.")

# Voice
Warm, human, British. Never corporate, never American. The solicitor is on your team, not in your way, even when they owe something. Frame around the shared goal (getting to exchange), never blame. Keep it concise and skimmable.
- Use "just" liberally: "just chasing", "just wanted to check", "just to keep things moving".
- Soft modals: "would you be able to", "could you let me know", "would you mind".
- To a solicitor, skip explaining the "why" of conveyancing; they know it. Keep it tight.
- Open the door at the end: "let me know if there's anything I can do to help move it along".

# Never
- Never use an em dash or en dash. Use a comma or full stop.
- Never write "you need to", "you must", "you're holding this up", ultimatums, or "per my last email".
- Never ask for something that has already happened, or ask if they're satisfied when they cannot be yet (see the ASK).

# The ASK (authoritative, build the whole message around exactly this)
${ask}

# Tone: ${tone}
${TONE_GUIDANCE[tone] ?? TONE_GUIDANCE.Professional}

# Output
Write ONLY the greeting and body. Start with the greeting on its own ("Hi ${ctx.recipientFirstName ? extractFirstName(ctx.recipientFirstName) : "there"},"). Do NOT write a sign-off, your name, the agency name, or any link or button. Those are added automatically after your message. End on the open-door line. Plain text. British spelling. No em dashes.`;

  const userMessage = `Write the enquiry chase now, for this situation:\n\n${facts}\n\nBuild it around the ASK in your instructions and the ${tone} tone. Keep it to 70 to 110 words, tight.`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI service not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) {
    console.error("[generate-enquiry-chase] Claude error:", await res.text());
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }
  const data = await res.json();
  // Belt-and-braces dash strip (a dash must never reach a solicitor/client).
  const stripDashes = (s: string): string =>
    s.replace(/(\d)\s*[—–]\s*(\d)/g, "$1-$2").replace(/\s*[—–]+\s*/g, ", ").replace(/,\s*,\s*/g, ", ");
  const prose = stripDashes(data.content?.[0]?.text ?? "").trim();
  if (!prose) return NextResponse.json({ error: "AI generation failed" }, { status: 500 });

  // Prose only — greeting + body. The "Provide an update" button and the sender's
  // signature are appended by the send path (sendEnquiryChaseAction), exactly like
  // the milestone chase drawer keeps the signature out of the editor.
  return NextResponse.json({ generated: prose });
}
