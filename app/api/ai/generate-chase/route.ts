// app/api/ai/generate-chase/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAiLimit, rateLimitJson } from "@/lib/ratelimit";
import { getMilestoneContext } from "@/lib/chase/milestone-glossary";

// Prompt strings are verbatim from PROMPT_SPEC.md §5 and §6 — do not edit here; edit the spec first.

const TONE_KEY_MAP: Record<string, string> = {
  "Friendly": "friendly",
  "Professional": "professional",
  "Polite Yet Firm": "polite_yet_firm",
  "Chase Up": "chase_up",
  "Urgent": "urgent",
  "Final Reminder": "final_reminder",
};

const CHANNEL_GUIDANCE: Record<string, string> = {
  whatsapp: `This is a WhatsApp message. Keep it brief: 50–80 words is the target, three short paragraphs maximum. Opener is shorter and more informal than email — "Morning [Name]," or "Hi [Name]," or "Good morning [Name]," (no "Dear"). No formal sign-off; end with the open-door line or trail off naturally. One emoji is fine for lighter tones.`,
  email: `This is an email. Length: 80–150 words, three to five short paragraphs. Opener is more structured than WhatsApp: "Good morning," or "Hi [Name],". Follow with "Hope you're well" or a context-aware variant. If multiple parties are addressed, use @Name mentions to direct specific questions. Sign off with "Best regards, {senderFirstName}" or "Kind regards, {senderFirstName}" — choose to fit the tone band.`,
};

const TONE_GUIDANCE: Record<string, string> = {
  friendly: `Friendly tone. Use this when there's no time pressure, the recipient has been responsive recently, or you're checking in for rapport. Lean into warmth — context-aware opener ("hope you had a lovely weekend"), one emoji at the end, genuinely conversational. No urgency cues.`,
  professional: `Professional tone. Use this for first contact with a new party, or when the message will be seen by multiple cc'd parties. Keep all the warmth — the opener, the "just," the open-door close — but drop playful touches. Slightly more neutral phrasing throughout. Fully on-voice, just calmer.`,
  polite_yet_firm: `Polite-yet-firm tone. Use this when a milestone has slipped past its expected date but the situation is recoverable, and one prior chase has gone unanswered. Name the slippage factually with a date if available ("I emailed on the 23rd just to check on this"), acknowledge possible reasons gracefully ("I know things have been busy"), then restate the ask plainly. End warmly. Never blame.`,
  chase_up: `Chase-up tone. Use this when a previous message has gone unanswered for several days and a fresh nudge is needed. Reference the previous correspondence ("just following up on the below" or "circling back on the message I sent on the X"). Keep it short — this is a nudge, not a fresh ask. Ask one clear question. Open-door close is essential.`,
  urgent: `Urgent tone. No emoji whatsoever — not even one. No exclamation marks. Use this when the exchange date or another hard deadline is genuinely at risk. Open by surfacing the SHARED goal ("we're aiming for exchange on {expectedExchangeDate}, so I'm just trying to tie up the last few bits this week"). Then explain factually what's outstanding. Then ask plainly for the action. Then volunteer to do your part: "once X is in I can push everything through with the solicitor." Tone stays warm — urgency comes from the deadline, not pressure on the recipient. Sign off with name and firm.`,
  final_reminder: `Final-reminder tone. Use this when multiple chases over a sustained period have gone unanswered and the transaction is at material risk. Name the timeline of attempted contact factually and without accusation ("I've sent messages on the 14th, 21st and 28th"). State the consequence plainly and as a SHARED outcome ("if I don't hear back this week, I'll need to update the chain that we may not make exchange on the {expectedExchangeDate}"). Still no blame — the message is "I want to avoid this together." Sign off professionally with full name and firm.`,
};

function getRecipientContext(
  side: string,
  contacts: Array<{ id: string; name: string; roleType: string; email?: string | null; phone?: string | null }>
) {
  const clientRoles = side === "vendor" ? ["vendor"] : ["purchaser", "broker"];
  const client = contacts.find((c) => clientRoles.includes(c.roleType)) ?? null;
  const solicitor = contacts.find((c) => c.roleType === "solicitor") ?? null;
  return { client, solicitor };
}

function resolveRecipientRole(roleType: string, side: string): string {
  if (roleType === "solicitor") return side === "vendor" ? "vendor's solicitor" : "purchaser's solicitor";
  if (roleType === "broker") return "mortgage broker";
  return roleType;
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
  const { chaseTaskId, chaseTaskIds, channel, tone, includeSolicitorCc = true } = body as {
    chaseTaskId?: string;
    chaseTaskIds?: string[];
    channel: "email" | "whatsapp";
    tone: string;
    includeSolicitorCc?: boolean;
  };

  const isMulti = Array.isArray(chaseTaskIds) && chaseTaskIds.length > 0;
  const primaryTaskId = isMulti ? chaseTaskIds[0] : chaseTaskId;

  if (!primaryTaskId || !channel || !tone) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const primaryTask = await prisma.chaseTask.findUnique({
    where: { id: primaryTaskId },
    include: {
      transaction: {
        include: {
          contacts: true,
          agency: { select: { name: true } },
          communications: {
            where: { type: "outbound" },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          milestoneCompletions: {
            where: {
              milestoneDefinition: { code: { in: ["VM18", "PM25"] } },
              state: "complete",
            },
            select: { milestoneDefinition: { select: { code: true } } },
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

  if (!primaryTask) {
    return NextResponse.json({ error: "Chase task not found" }, { status: 404 });
  }

  if (primaryTask.transaction.agencyId !== session.user.agencyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const extraTasks =
    isMulti && chaseTaskIds.length > 1
      ? await prisma.chaseTask.findMany({
          where: { id: { in: chaseTaskIds.slice(1) } },
          include: {
            transaction: {
              include: {
                contacts: true,
                agency: { select: { name: true } },
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
        })
      : [];

  for (const t of extraTasks) {
    if (t.transaction.agencyId !== session.user.agencyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const allTasks = [primaryTask, ...extraTasks];
  const tx = primaryTask.transaction;

  const formatPrice = (pence: number | null) =>
    pence ? `£${(pence / 100).toLocaleString("en-GB")}` : "Not provided";

  const formatDate = (d: Date | null | undefined) =>
    d
      ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "Not provided";

  // Sender and firm
  const senderFirstName = session.user.name?.split(" ")[0] ?? session.user.name ?? "Your progressor";
  const firmName = tx.agency?.name ?? "our agency";

  // Recipient side and chase count
  const recipientSide = allTasks[0].reminderLog.reminderRule.anchorMilestone?.side ?? "vendor";
  const maxChaseCount = isMulti
    ? Math.max(...allTasks.map((t) => t.chaseCount))
    : primaryTask.chaseCount;

  const { client, solicitor } = getRecipientContext(recipientSide, tx.contacts);
  const primaryRecipient = client ?? solicitor;
  const showCc = channel === "email" && includeSolicitorCc && solicitor !== null;

  const recipientFirstName = primaryRecipient?.name?.split(" ")[0] ?? "there";
  const recipientRole = primaryRecipient
    ? resolveRecipientRole(primaryRecipient.roleType, recipientSide)
    : recipientSide;

  // Other contacts (exclude primary recipient)
  const otherContactsList = tx.contacts
    .filter((c) => c.id !== primaryRecipient?.id)
    .map((c) => `- ${c.name} — ${resolveRecipientRole(c.roleType, recipientSide)}`);
  const otherContacts = otherContactsList.length > 0 ? otherContactsList.join("\n") : null;

  // Exchange date — only surfaced when both solicitor gate milestones (VM18 + PM25) are confirmed
  const gateCodes = tx.milestoneCompletions.map((c) => c.milestoneDefinition.code);
  const exchangeGatesConfirmed = gateCodes.includes("VM18") && gateCodes.includes("PM25");
  const expectedExchangeDateStr = formatDate(tx.expectedExchangeDate);
  const daysToExpectedExchange = tx.expectedExchangeDate
    ? Math.ceil((new Date(tx.expectedExchangeDate).getTime() - Date.now()) / 86400000)
    : null;
  const daysToExchangeStr =
    daysToExpectedExchange !== null ? `${daysToExpectedExchange} days away` : "unknown";

  // Resolved guidance strings (substitutions applied)
  const toneKey = TONE_KEY_MAP[tone] ?? "friendly";
  const channelGuidance = CHANNEL_GUIDANCE[channel].replace(/\{senderFirstName\}/g, senderFirstName);
  const toneGuidance = (TONE_GUIDANCE[toneKey] ?? TONE_GUIDANCE.friendly).replace(
    /\{expectedExchangeDate\}/g,
    exchangeGatesConfirmed && tx.expectedExchangeDate ? expectedExchangeDateStr : "our exchange target"
  );

  // System prompt (§5 verbatim)
  const systemPrompt = `You are writing a chase message on behalf of ${senderFirstName}, a sales progressor at ${firmName}, an estate agency. Your job is to keep a residential property transaction moving toward exchange and completion on behalf of all parties involved.

# Framing — read this first, it shapes every message

The recipient is on your team, not in your way. Even when the recipient is the person who needs to take an action, every message frames the progressor as someone working alongside them to clear what's outstanding — never as a chase against them for failing.

When time pressure is real, surface the SHARED stake (the exchange date, the chain, the lender's offer expiry, the momentum), not blame. The recipient and the progressor want the same outcome.

# Voice

Warm, human, British. Never corporate. Never American.

Opening: greeting + the recipient's first name (if known) + a brief "Hope you're well" or context-aware variant ("Hope you had a lovely weekend" / "Hope you're having a good week" / "Hope you had a lovely bank holiday"). The opener is never skipped.

Distinctive vocabulary:
- "Just" is the most important word in this voice. Use it liberally: "just wanted to," "just a quick," "just checking in," "just chasing up," "just to keep you posted." Multiple uses per message is fine.
- Soft modals for any ask: "would you be able to," "could you let me know," "would you mind," "if you get a chance."
- Explain the WHY of any ask in one short clause: "just so I can keep things moving," "just helps me keep our records up to date."
- Volunteer help where plausible: "happy to follow up directly if it helps," "let me know and I'll handle it from here," "if you need me to chase the broker on your behalf, just say."

Closing: open the door. "Let me know if you need anything," "Here to help if you need anything at all," "If you need anything from me in the meantime, please let me know."

Emojis: at most one per message in lighter tones only (🙂 🙏🏼 🤝🏻 🙌🏼 ✌🏼 🌞 🤞🏻). None whatsoever in Urgent or Final Reminder tones — these are fully emoji-free regardless of anything else in this prompt.

# Things you must NEVER write

These break the voice and the framing. Do not produce them under any circumstance:

- Hyphen-dash (— or –) as a sentence connector or clause separator. Use a comma, a full stop, or a conjunction instead.
- "We're stuck waiting on your side"
- "You're holding this up" / "the delay is on your end"
- "You need to" / "You must" / "You have to"
- "If this isn't sorted by X, then Y" (no ultimatums)
- "As discussed" used to imply prior wrongdoing
- "Can you get this sorted today" (too imperative)
- "I'm reaching out because…" (corporate, not the voice)
- "Per my last email" or other passive-aggressive callbacks

# Confidentiality boundaries

You will be given context about the transaction, the milestone, and the recipient. Use ALL of it as factual grounding for what to write — but only share with the recipient what they would already know or could appropriately be told.

In particular:
- Do not surface internal sentiment, frustration, or commentary about other parties.
- Do not reveal details about the other side's internal status that the recipient wouldn't already know (e.g. specific things the other party hasn't yet done internally).
- Do not introduce financial details beyond what's directly relevant to the milestone being chased.

If you're given a "PREVIOUS MESSAGE TO THIS RECIPIENT" snippet, treat it as factual continuity only. Do NOT mirror its tone, length, or phrasing — your output is governed by this prompt and the tone modifier, not by what came before.

# Channel — ${channel === "whatsapp" ? "WhatsApp" : "email"}

${channelGuidance}

# Tone — ${tone}

${toneGuidance}

# Output format

Return only the message body. No preamble, no explanation, no "Here is the message:". Plain text. Sender's name appears in the sign-off only when channel guidance specifies.`;

  // Milestone(s) block — loop per §6
  const milestonesBlock = (() => {
    const lines = allTasks.map((t, i) => {
      const ms = t.reminderLog.reminderRule.anchorMilestone;
      const name = ms?.name ?? t.reminderLog.reminderRule.name;
      const side = ms?.side ?? "vendor";
      const daysOuts = Math.max(
        0,
        Math.floor((Date.now() - new Date(t.reminderLog.nextDueDate).getTime()) / 86400000)
      );
      const blocks = ms?.blocksExchange ? "yes" : "no";
      return `${i + 1}. ${name}\n   - Side: ${side}\n   - Days outstanding: ${daysOuts}\n   - Blocks exchange: ${blocks}`;
    });
    const base = lines.join("\n");
    if (!isMulti) return base;
    const wordTarget =
      allTasks.length === 2
        ? channel === "whatsapp" ? "80–120" : "120–160"
        : channel === "whatsapp" ? "120–160" : "150–200";
    return `${base}\n\nAddress all milestones in the message. Follow the multi-item structure guidance: one paragraph per milestone, connective phrases between paragraphs, single unified opener and closer. Do not produce separate messages. Target length: ${wordTarget} words.`;
  })();

  // Milestone context — per-milestone glossary lookup (§6, PROMPT_SPEC.md)
  const milestoneContextParts = allTasks
    .map((t) => {
      const ms = t.reminderLog.reminderRule.anchorMilestone;
      const msCode = ms?.code ?? null;
      const msName = ms?.name ?? t.reminderLog.reminderRule.name;
      if (!msCode) return null;
      const ctx = getMilestoneContext(msCode);
      if (!ctx) return null;
      return [
        `${msName} (${msCode}):`,
        `- What it tracks: ${ctx.tracks}`,
        `- What outstanding means: ${ctx.outstanding}`,
        `- Also called: ${ctx.alsoCalled}`,
        `- Common misframings to avoid: ${ctx.misframings}`,
      ].join("\n");
    })
    .filter((p): p is string => p !== null);
  const milestoneContextBlock =
    milestoneContextParts.length > 0 ? milestoneContextParts.join("\n\n") : null;

  // Chase history
  const lastComm = tx.communications[0] ?? null;
  const daysSinceLastContact = lastComm
    ? Math.floor((Date.now() - new Date(lastComm.createdAt).getTime()) / 86400000)
    : null;
  const lastOutboundMessage = lastComm?.content
    ? lastComm.content.slice(0, 300) + (lastComm.content.length > 300 ? "..." : "")
    : null;

  // User message (§6 structure)
  const userMessageParts: string[] = [
    `Generate ${channel === "whatsapp" ? "a WhatsApp" : "an email"} chase message for the following situation.`,
    ``,
    `# Transaction`,
    `- Property: ${tx.propertyAddress}`,
    `- Tenure: ${tx.tenure ?? "Not provided"}`,
    `- Purchase type: ${tx.purchaseType ?? "Not provided"}`,
    `- Sale price: ${formatPrice(tx.purchasePrice ?? null)}`,
    ...(exchangeGatesConfirmed && tx.expectedExchangeDate
      ? [`- Expected exchange date: ${expectedExchangeDateStr} (${daysToExchangeStr})`]
      : []),
    ``,
    `# Milestone(s) being chased`,
    milestonesBlock,
    ``,
    ...(milestoneContextBlock
      ? [`# Milestone context`, ``, milestoneContextBlock, ``]
      : []),
    `# Chase history`,
    `- Number of previous chases for this milestone: ${maxChaseCount}`,
    ...(daysSinceLastContact !== null
      ? [`- Days since last contact with this recipient: ${daysSinceLastContact}`]
      : []),
    ``,
    `# Recipient`,
    `- Name: ${recipientFirstName}`,
    `- Role: ${recipientRole}`,
    ...(showCc && solicitor ? [`- Also CC: ${solicitor.name} (solicitor) — they will see this message`] : []),
  ];

  if (otherContacts) {
    userMessageParts.push(``);
    userMessageParts.push(
      `# Other parties on this transaction (for context only — only mention if relevant)`
    );
    userMessageParts.push(otherContacts);
  }

  if (lastOutboundMessage) {
    userMessageParts.push(``);
    userMessageParts.push(
      `# Previous message to this recipient (for factual continuity only — do NOT mirror its tone, length, or phrasing)`
    );
    userMessageParts.push(`"${lastOutboundMessage}"`);
  }

  userMessageParts.push(``);
  userMessageParts.push(`Write the message now.`);

  const userMessage = userMessageParts.join("\n");

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
      max_tokens: isMulti ? 800 : 600,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
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
      primaryContact: primaryRecipient
        ? { name: primaryRecipient.name, role: primaryRecipient.roleType }
        : null,
      milestoneName: isMulti
        ? `${allTasks.length} milestones`
        : (primaryTask.reminderLog.reminderRule.anchorMilestone?.name ??
          primaryTask.reminderLog.reminderRule.name),
      chaseCount: maxChaseCount,
      tone,
      channel,
    },
  });
}
