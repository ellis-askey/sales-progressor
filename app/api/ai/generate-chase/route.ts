// app/api/ai/generate-chase/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAiLimit, rateLimitJson } from "@/lib/ratelimit";
import { getMilestoneContext } from "@/lib/chase/milestone-glossary";
import { getAccessScope, canReadTransaction } from "@/lib/security/access-scope";
import { greetingName } from "@/lib/utils";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";

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
  whatsapp: `This is a WhatsApp message. Keep it brief: 50 to 80 words is the target, three short paragraphs maximum. Opener is shorter and more informal than email, so "Morning [Name]," or "Hi [Name]," or "Good morning [Name]," (no "Dear"). No formal sign-off; end with the open-door line or trail off naturally. One emoji is fine for lighter tones.`,
  email: `This is an email. Length: 80 to 150 words, three to five short paragraphs. Opener is more structured than WhatsApp: "Good morning," or "Hi [Name],". Follow with "Hope you're well" or a context-aware variant. If multiple parties are addressed, use @Name mentions to direct specific questions. Sign off with "Best regards, {senderFirstName}" or "Kind regards, {senderFirstName}", choosing to fit the tone band.`,
};

const TONE_GUIDANCE: Record<string, string> = {
  friendly: `Friendly tone. Use this when there's no time pressure, the recipient has been responsive recently, or you're checking in for rapport. Lean into warmth, with a context-aware opener ("hope you had a lovely weekend"), one emoji at the end, genuinely conversational. No urgency cues.`,
  professional: `Professional tone. Use this for first contact with a new party, or when the message will be seen by multiple cc'd parties. Keep all the warmth (the opener, the "just," the open-door close), but drop playful touches. Slightly more neutral phrasing throughout. Fully on-voice, just calmer.`,
  polite_yet_firm: `Polite-yet-firm tone. Use this when a milestone has slipped past its expected date but the situation is recoverable, and one prior chase has gone unanswered. Name the slippage factually with a date if available ("I emailed on the 23rd just to check on this"), acknowledge possible reasons gracefully ("I know things have been busy"), then restate the ask plainly. End warmly. Never blame.`,
  chase_up: `Chase-up tone. Use this when a previous message has gone unanswered for several days and a fresh nudge is needed. Reference the previous correspondence ("just following up on the below" or "circling back on the message I sent on the X"). Keep it short. This is a nudge, not a fresh ask. Ask one clear question. Open-door close is essential.`,
  urgent: `Urgent tone. No emoji whatsoever, not even one. No exclamation marks. Use this when the exchange date or another hard deadline is genuinely at risk. Open by surfacing the SHARED goal ("we're aiming for exchange on {expectedExchangeDate}, so I'm just trying to tie up the last few bits this week"). Then explain factually what's outstanding. Then ask plainly for the action. Then volunteer to do your part: "once X is in I can push everything through with the solicitor." Tone stays warm. Urgency comes from the deadline, not pressure on the recipient. Sign off with name and firm.`,
  final_reminder: `Final-reminder tone. Use this when multiple chases over a sustained period have gone unanswered and the transaction is at material risk. Name the timeline of attempted contact factually and without accusation ("I've sent messages on the 14th, 21st and 28th"). State the consequence plainly and as a SHARED outcome ("if I don't hear back this week, I'll need to update the chain that we may not make exchange on the {expectedExchangeDate}"). Still no blame. The message is "I want to avoid this together." Sign off professionally with full name and firm.`,
};

// Who the message is going TO shapes how much you explain and how long it runs.
// A solicitor runs these steps daily, so explaining the process reads as talking
// down to them; a client (buyer/seller) may not follow it, so a light "why" helps.
const RECIPIENT_GUIDANCE: Record<"solicitor" | "client", string> = {
  solicitor: `You are writing to a solicitor: a conveyancing professional who runs these steps every day. Be brief and direct. Make the ask and stop. Do NOT explain what the step is, what happens next, or why it matters, and never narrate the process (no "so the buyer's side can then begin their review" clauses). They already know all of it, and spelling it out reads as talking down to them. Keep a short greeting, a "just", and a brief open-door line, but trim everything else. Keep it shorter than a client message: two to four short sentences of substance is plenty. This brevity takes precedence over the channel word count.`,
  client: `You are writing to a member of the public (the buyer or seller), who may not follow the conveyancing process. One short clause on why the ask helps is welcome and reassuring. Keep it warm, plain, and free of legal jargon.`,
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
  const scope = getAccessScope(session);

  const rateLimit = await checkAiLimit(session.user.id).catch(() => ({ success: true, reset: 0, remaining: 30 }));
  if (!rateLimit.success) {
    return NextResponse.json(rateLimitJson(rateLimit), { status: 429 });
  }

  const body = await req.json();
  const { chaseTaskId, chaseTaskIds, channel, tone, includeCc = false, recipientId, recipientRole } = body as {
    chaseTaskId?: string;
    chaseTaskIds?: string[];
    channel: "email" | "whatsapp";
    tone: string;
    // Opt-in CC (default off): CC the solicitor on a client send, or the client on
    // a solicitor send. Which one is derived server-side from the recipient.
    includeCc?: boolean;
    // Recipient chosen in the drawer's "To" selector. recipientRole==="solicitor"
    // means write TO the side's solicitor; otherwise recipientId is a Contact id.
    // Both omitted (chase-all) -> fall back to milestone-side inference.
    recipientId?: string;
    recipientRole?: string;
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
          // Real solicitors for CC / solicitor-recipient generation (they aren't
          // Contact rows). Side = which FK column they sit in.
          vendorSolicitorContact: { select: { id: true, name: true } },
          purchaserSolicitorContact: { select: { id: true, name: true } },
          vendorSolicitorFirm: { select: { name: true } },
          purchaserSolicitorFirm: { select: { name: true } },
          agency: { select: { name: true } },
          communications: {
            where: { type: "outbound" },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          // PHASE 1 4e — exchange-ready gates VM18/PM25; the nested
          // where can't reference the parent's activeBuyerRoundId, so
          // the gate read is round-resolved in a separate fetch below
          // after primaryTask resolves. Keeping the empty include for
          // type compatibility with downstream consumers.
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

  if (!canReadTransaction(scope, primaryTask.transaction)) {
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
    if (!canReadTransaction(scope, t.transaction)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const allTasks = [primaryTask, ...extraTasks];
  const tx = primaryTask.transaction;

  const formatDate = (d: Date | null | undefined) =>
    d
      ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "Not provided";

  // PII minimisation — send a shortened property reference (street line only)
  // instead of the full address with postcode. The AI doesn't reproduce the
  // postcode in chase messages; the street line is enough to anchor the
  // reference. Drops town + postcode when a UK postcode is detected; falls
  // back to dropping just the last comma-separated segment otherwise.
  const shortenAddress = (full: string): string => {
    const parts = full.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length <= 1) return full;
    const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
    const hasPostcode = POSTCODE_RE.test(parts[parts.length - 1]);
    if (hasPostcode && parts.length >= 3) return parts.slice(0, -2).join(", ");
    return parts.slice(0, -1).join(", ");
  };

  // Sender and firm
  const senderFirstName = session.user.name ? greetingName(session.user.name) : "Your progressor";
  const firmName = tx.agency?.name ?? "our agency";

  // Recipient side and chase count
  const recipientSide = allTasks[0].reminderLog.reminderRule.anchorMilestone?.side ?? "vendor";
  const maxChaseCount = isMulti
    ? Math.max(...allTasks.map((t) => t.chaseCount))
    : primaryTask.chaseCount;

  const { client } = getRecipientContext(recipientSide, tx.contacts);
  // Real solicitor for the milestone side comes from the FK columns, not from
  // contacts (solicitors aren't Contact rows).
  const sideSolicitor =
    recipientSide === "vendor" ? tx.vendorSolicitorContact : tx.purchaserSolicitorContact;

  // Resolve who this is written TO. The drawer's "To" selector supplies the
  // recipient; when absent (chase-all) we fall back to the milestone-side client,
  // then the side solicitor. resolvedRecipientSide starts at the milestone side
  // and is overridden to the SELECTED solicitor's true side, so the role label and
  // CC wording never disagree with who the agent actually picked.
  let resolvedRecipientSide: "vendor" | "purchaser" = recipientSide === "purchaser" ? "purchaser" : "vendor";
  let primaryRecipient: { name: string; roleType: string } | null = client
    ? { name: client.name, roleType: client.roleType }
    : null;
  let primaryRecipientId: string | null = client?.id ?? null;
  let recipientIsSolicitor = false;
  if (recipientRole === "solicitor") {
    // Trust the exact solicitor the agent picked: match the id across BOTH FK
    // columns so we get the right person AND the right side, regardless of the
    // milestone-side inference (which can disagree with the chosen solicitor).
    let chosen: { name: string } | null = null;
    if (tx.vendorSolicitorContact && tx.vendorSolicitorContact.id === recipientId) {
      chosen = tx.vendorSolicitorContact;
      resolvedRecipientSide = "vendor";
    } else if (tx.purchaserSolicitorContact && tx.purchaserSolicitorContact.id === recipientId) {
      chosen = tx.purchaserSolicitorContact;
      resolvedRecipientSide = "purchaser";
    } else {
      chosen = sideSolicitor; // fallback: milestone-side solicitor
    }
    primaryRecipient = chosen ? { name: chosen.name, roleType: "solicitor" } : null;
    primaryRecipientId = null;
    recipientIsSolicitor = true;
  } else if (recipientId) {
    const picked = tx.contacts.find((c) => c.id === recipientId);
    if (picked) {
      primaryRecipient = { name: picked.name, roleType: picked.roleType };
      primaryRecipientId = picked.id;
    }
  }
  if (!primaryRecipient && sideSolicitor) {
    primaryRecipient = { name: sideSolicitor.name, roleType: "solicitor" };
    recipientIsSolicitor = true;
  }

  // CC is symmetric and opt-in (includeCc). Solicitor recipient -> CC the client
  // on the resolved side; client recipient -> CC that side's solicitor.
  const resolvedSideSolicitor =
    resolvedRecipientSide === "vendor" ? tx.vendorSolicitorContact : tx.purchaserSolicitorContact;
  const { client: resolvedClient } = getRecipientContext(resolvedRecipientSide, tx.contacts);
  const ccExists = recipientIsSolicitor ? resolvedClient !== null : resolvedSideSolicitor !== null;
  const showCc = channel === "email" && includeCc && ccExists;

  const recipientFirstName = greetingName(primaryRecipient?.name ?? "");
  const recipientRoleLabel = primaryRecipient
    ? resolveRecipientRole(primaryRecipient.roleType, resolvedRecipientSide)
    : resolvedRecipientSide;

  // Other contacts (exclude primary recipient AND the CC'd solicitor — that's
  // surfaced separately on its own line). PII minimisation: send role label +
  // count only, never full names. The AI's only legitimate use is knowing
  // which roles exist on the transaction (e.g. "is there a broker on this
  // deal?") — not naming them in the message body. Confidentiality Boundaries
  // in the system prompt already forbid surfacing other parties' internal status.
  const otherContactsByRole = new Map<string, number>();
  for (const c of tx.contacts) {
    if (c.id === primaryRecipientId) continue;
    const role = resolveRecipientRole(c.roleType, recipientSide);
    otherContactsByRole.set(role, (otherContactsByRole.get(role) ?? 0) + 1);
  }
  const otherContacts =
    otherContactsByRole.size > 0
      ? Array.from(otherContactsByRole.entries())
          .map(([role, count]) => `- ${count} ${role}${count === 1 ? "" : "s"}`)
          .join("\n")
      : null;

  // PHASE 1 4e — Exchange date is only surfaced when both gates VM18
  // (vendor) + PM25 (purchaser) are confirmed. Round-scope the gate
  // read so a relisted file doesn't surface the OLD buyer's PM25 as
  // "exchange ready" — that would generate misleading AI wording the
  // agent might not catch. Replaces the unscoped nested include result
  // (which kept the original include for type compatibility).
  const aiGateTxRow = await prisma.propertyTransaction.findUnique({
    where: { id: tx.id },
    select: { activeBuyerRoundId: true },
  });
  const aiGateScope = forRound(aiGateTxRow?.activeBuyerRoundId ?? null, tx.id);
  const aiGateCompletions = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId: tx.id,
      milestoneDefinition: { code: { in: ["VM18", "PM25"] } },
      state: "complete",
      ...milestoneScopeWhere(aiGateScope),
    },
    select: { milestoneDefinition: { select: { code: true } } },
  });
  const gateCodes = aiGateCompletions.map((c) => c.milestoneDefinition.code);
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

  // Terser + no process-explaining for solicitors; warmer + light "why" for clients.
  const recipientGuidance = recipientIsSolicitor ? RECIPIENT_GUIDANCE.solicitor : RECIPIENT_GUIDANCE.client;

  // System prompt (§5 verbatim)
  const systemPrompt = `You are writing a chase message on behalf of ${senderFirstName}, a sales progressor at ${firmName}, an estate agency. Your job is to keep a residential property transaction moving toward exchange and completion on behalf of all parties involved.

# Framing (read this first, it shapes every message)

The recipient is on your team, not in your way. Even when the recipient is the person who needs to take an action, every message frames the progressor as someone working alongside them to clear what's outstanding, never as a chase against them for failing.

When time pressure is real, surface the SHARED stake (the exchange date, the chain, the lender's offer expiry, the momentum), not blame. The recipient and the progressor want the same outcome.

# What you are chasing (stay on this exact step)

Each milestone in the context below has a "THE ASK" line. Your message asks the recipient to do, or confirm, exactly that step, and calls it the name given in "How to name it". Ask for that one thing.

Never move the ask onto a different step. Do not chase the earlier steps that had to happen before this one, and do not chase the later steps that follow it. A neighbouring step may be mentioned in at most one short clause, and only when it is genuinely useful shared context. The thing you actually ask the recipient for is always THIS milestone's own action, never a prerequisite or a follow-on.

# Who you're writing to

${recipientGuidance}

# Voice

Warm, human, British. Never corporate. Never American.

Opening: greeting + the recipient's first name (if known) + a brief "Hope you're well" or context-aware variant ("Hope you had a lovely weekend" / "Hope you're having a good week" / "Hope you had a lovely bank holiday"). The opener is never skipped.

Distinctive vocabulary:
- "Just" is the most important word in this voice. Use it liberally: "just wanted to," "just a quick," "just checking in," "just chasing up," "just to keep you posted." Multiple uses per message is fine.
- Soft modals for any ask: "would you be able to," "could you let me know," "would you mind," "if you get a chance."
- With a CLIENT, explain the WHY of any ask in one short clause: "just so I can keep things moving," "just helps me keep our records up to date." With a SOLICITOR, skip the why entirely (see "Who you're writing to").
- Volunteer help where plausible: "happy to follow up directly if it helps," "let me know and I'll handle it from here," "if you need me to chase the broker on your behalf, just say."

Closing: open the door. "Let me know if you need anything," "Here to help if you need anything at all," "If you need anything from me in the meantime, please let me know."

Emojis: at most one per message in lighter tones only (🙂 🙏🏼 🤝🏻 🙌🏼 ✌🏼 🌞 🤞🏻). None whatsoever in Urgent or Final Reminder tones, which are fully emoji-free regardless of anything else in this prompt.

# Things you must NEVER write

These break the voice and the framing. Do not produce them under any circumstance:

- The em dash or en dash (the long dash characters) as a sentence connector or clause separator. Never use them, not once. Use a comma, a full stop, or a conjunction instead.
- "We're stuck waiting on your side"
- "You're holding this up" / "the delay is on your end"
- "You need to" / "You must" / "You have to"
- "If this isn't sorted by X, then Y" (no ultimatums)
- "As discussed" used to imply prior wrongdoing
- "Can you get this sorted today" (too imperative)
- "I'm reaching out because…" (corporate, not the voice)
- "Per my last email" or other passive-aggressive callbacks

# Confidentiality boundaries

You will be given context about the transaction, the milestone, and the recipient. Use ALL of it as factual grounding for what to write, but only share with the recipient what they would already know or could appropriately be told.

In particular:
- Do not surface internal sentiment, frustration, or commentary about other parties.
- Do not reveal details about the other side's internal status that the recipient wouldn't already know (e.g. specific things the other party hasn't yet done internally).
- Do not introduce financial details beyond what's directly relevant to the milestone being chased.

If you're given a "PREVIOUS MESSAGE TO THIS RECIPIENT" snippet, treat it as factual continuity only. Do NOT mirror its tone, length, or phrasing. Your output is governed by this prompt and the tone modifier, not by what came before.

# Channel: ${channel === "whatsapp" ? "WhatsApp" : "email"}

${channelGuidance}

# Tone: ${tone}

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
        ? channel === "whatsapp" ? "80 to 120" : "120 to 160"
        : channel === "whatsapp" ? "120 to 160" : "150 to 200";
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
        // Lead with the ask — this is the single thing the message must be about.
        `- THE ASK (what this message must be about): ${ctx.outstanding}`,
        `- What this step is: ${ctx.tracks}`,
        // The naming steer — kept the message on this step and calls it the
        // right thing (previously parsed but dropped before the model saw it).
        ...(ctx.howToRefer ? [`- How to name it with this recipient: ${ctx.howToRefer}`] : []),
        `- Also called: ${ctx.alsoCalled}`,
        `- Pitfalls to avoid: ${ctx.misframings}`,
      ].join("\n");
    })
    .filter((p): p is string => p !== null);
  const milestoneContextBlock =
    milestoneContextParts.length > 0 ? milestoneContextParts.join("\n\n") : null;

  // Chase history — timing data only. The verbatim 300-char snippet of the
  // last outbound message was REMOVED for PII minimisation (it could contain
  // any PII the agent had previously typed: names, phone numbers, addresses,
  // financial details). The tone guidance only ever needs WHEN previous
  // contact was, not WHAT was said — "circling back on the message I sent
  // N days ago" works fine from days-only continuity.
  const lastComm = tx.communications[0] ?? null;
  const daysSinceLastContact = lastComm
    ? Math.floor((Date.now() - new Date(lastComm.createdAt).getTime()) / 86400000)
    : null;

  // User message (§6 structure, PII-minimised).
  //
  // Fields deliberately NOT sent to Anthropic:
  //   - Full property address (only street line — town + postcode dropped)
  //   - Sale price (not used by any tone band; removed entirely)
  //   - Full names of contacts who aren't the primary recipient (role + count only)
  //   - Full name of CC'd solicitor (role label only)
  //   - Verbatim previous-message text (timing-only continuity signal)
  //   - Email addresses, phone numbers, internal notes (never sent — were not in prior version either)
  //
  // Fields that DO go (each load-bearing for output quality):
  //   - Recipient's first name (opener pattern requires it)
  //   - Sending agent's first name + agency name (sign-off attribution)
  //   - Property reference (first line only)
  //   - Tenure / purchase type / expected exchange date (transaction framing)
  //   - Milestone names / codes / days outstanding / blocks-exchange flag
  //   - Milestone glossary text (from lib/chase/milestone-glossary.ts)
  //   - Chase counts + days since last contact (structured continuity)
  //   - Recipient role + role list of other parties (no names)
  //
  // Keep this list in sync with Terms §5 and the Privacy data-inventory.
  const recipientShortAddress = shortenAddress(tx.propertyAddress);
  // Who's being CC'd, phrased for the AI. Solicitor recipient -> the client is
  // CC'd; client recipient -> that side's solicitor is CC'd.
  const ccRoleLabel = recipientIsSolicitor
    ? (resolvedRecipientSide === "vendor" ? "the seller" : "the buyer")
    : (resolvedRecipientSide === "vendor" ? "vendor's solicitor" : "purchaser's solicitor");

  const vendorFirmName = tx.vendorSolicitorFirm?.name ?? null;
  const purchaserFirmName = tx.purchaserSolicitorFirm?.name ?? null;

  const userMessageParts: string[] = [
    `Generate ${channel === "whatsapp" ? "a WhatsApp" : "an email"} chase message for the following situation.`,
    ``,
    `# Transaction`,
    `- Property reference: ${recipientShortAddress}`,
    `- Tenure: ${tx.tenure ?? "Not provided"}`,
    `- Purchase type: ${tx.purchaseType ?? "Not provided"}`,
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
    ...(vendorFirmName || purchaserFirmName
      ? [
          `# Legal representatives`,
          ...(vendorFirmName ? [`- Seller's solicitor: ${vendorFirmName}`] : []),
          ...(purchaserFirmName ? [`- Buyer's solicitor: ${purchaserFirmName}`] : []),
          `When you refer to the OTHER side's solicitor, you may name their firm where it reads naturally (e.g. "over to ${purchaserFirmName ?? vendorFirmName}"). Do not name the recipient's own firm back to them.`,
          ``,
        ]
      : []),
    `# Chase history`,
    `- Number of previous chases for this milestone: ${maxChaseCount}`,
    ...(daysSinceLastContact !== null
      ? [`- Days since last contact with this recipient: ${daysSinceLastContact}`]
      : []),
    ``,
    `# Recipient`,
    `- First name: ${recipientFirstName}`,
    `- Role: ${recipientRoleLabel}`,
    ...(showCc ? [`- Also CC: ${ccRoleLabel}, they will see this message`] : []),
  ];

  if (otherContacts) {
    userMessageParts.push(``);
    userMessageParts.push(
      `# Other parties on this transaction (role context only, no names sent)`
    );
    userMessageParts.push(otherContacts);
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
  // Belt-and-braces: the prompt forbids em/en dashes, but strip any that slip
  // through so a dash NEVER reaches a client. A dash between digits keeps a
  // hyphen (date/number ranges); anywhere else it becomes a comma.
  const stripDashes = (s: string): string =>
    s
      .replace(/(\d)\s*[—–]\s*(\d)/g, "$1-$2")
      .replace(/\s*[—–]+\s*/g, ", ")
      .replace(/,\s*,\s*/g, ", ");
  const generated = stripDashes(claudeData.content?.[0]?.text ?? "");

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
