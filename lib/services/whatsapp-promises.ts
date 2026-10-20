import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/anthropic";
import { createManualTask } from "@/lib/services/manual-tasks";
import { toUKDateStr } from "@/lib/utils";
import { isWorthReading, buildRedactionTokens, redactForAi } from "@/lib/services/whatsapp-promise-hint";

// "Promises" — turn a WhatsApp message the operator SENT into a to-do when they
// commit to doing something themselves.
//
// Intention rebuild (founder-approved 2026-10-19):
//   - No phrase gate: every sent message gets the AI read unless it obviously
//     can't contain a commitment (isWorthReading). Intention, not phrasing.
//   - Context: the model sees the few preceding messages so short replies
//     ("Yep, first thing tomorrow") resolve to what was asked. Third-party
//     context is REDACTED before the model sees it (privacy option B) — only
//     the sender's own words travel unredacted.
//   - Verdicts: a certain, dated promise becomes a normal to-do. An undated or
//     unsure one becomes a quiet "possible" (ManualTask.isPossible) that waits
//     in a folded pile on the file's To-Do tab — never the main list.
//   - Resilience: look back 7 days (was 2), but only create dated tasks whose
//     due date hasn't already passed — an outage can't dump stale to-dos.
//   - FOUNDER TEST GATE: while WHATSAPP_PROMISES_INTERNAL_ONLY isn't "false",
//     connection-captured messages (agencies / business members) are stamped
//     and skipped entirely — only the internal number produces tasks, and
//     those are internal-self-assigned (visible to internal staff only).
//
// Passive: it only READS captured WhatsApp content and writes a private task.
// It never sends anything on WhatsApp. Each outbound message is scanned at most
// once (OutboundMessage.promiseScannedAt).

const ACTIVE_STATUSES = ["draft", "active", "on_hold"] as const;

const internalOnly = () => process.env.WHATSAPP_PROMISES_INTERNAL_ONLY !== "false";

const SYSTEM = `You help a UK estate-agency sales progressor never forget a promise.

You read ONE WhatsApp message that the progressor SENT (the "Message to judge") and extract concrete commitments the sender makes to do something THEMSELVES.

You may also be shown a few earlier messages from the same conversation, labelled "You:" (the sender) and "Them:" (the other side). These are CONTEXT ONLY:
- Never extract a promise from the earlier messages themselves.
- Use them solely to resolve what a short reply commits to. "Yep, first thing tomorrow" after "can you chase the solicitor?" is a promise to chase the solicitor tomorrow.
- Earlier messages may contain [redacted] placeholders. Never guess what they hide. Refer to people by role (the solicitor, the buyer, the seller, the agent) or generically.

Your job is to identify DISTINCT promised actions, not every possible interpretation or paraphrase of the message.

CORE RULE:

Return ONE promise for each clearly separate action the sender explicitly commits to doing.

Do NOT split one commitment into multiple tasks.

Two promises are separate ONLY if the message clearly commits the sender to two different actions.

Examples:

"I'll chase the solicitor tomorrow."
-> ONE promise: chase the solicitor.

"I'll check in with the agents today and see where things are."
-> ONE promise. "See where things are" describes the purpose/result of checking in; it is not another action.

"I'll chase the solicitor and call you tomorrow."
-> TWO promises because "chase the solicitor" and "call you" are two separate actions explicitly stated in the message.

GROUNDING RULE:

Every promise you return must be directly supported by the Message to judge (with context used only to resolve references).

For EACH proposed promise, verify all of the following:

1. The message explicitly says or clearly states that the SENDER will perform that action.
2. The action appears in, or is directly resolved from context by, the message.
3. It is genuinely distinct from every other promise you are returning.

Do NOT:
- invent an additional action that is merely implied
- turn context into an action the final message didn't commit to
- turn the expected result of an action into another task
- create multiple titles that describe the same underlying action
- create a broader or narrower version of an action as a second task
- infer another person who should be contacted unless the message or its context says so
- invent "ask for an update", "get an update", "follow up", "check progress", etc. as separate actions when these merely describe the purpose of an already extracted chase/check/call/email
- copy a timeframe from one action onto another action unless the wording clearly applies that timeframe to both

If two candidate promises would cause the sender to essentially do the same thing once, they are ONE promise.

When unsure whether there are one or two promises, return ONE.

WHAT COUNTS AS A PROMISE:

Concrete actions the sender commits to taking themselves: chase, call, ring, email, send, check, check in with, speak to, contact, book, and similar. The wording does not need to say "I'll" — judge the intention. "On it", "Chasing first thing", "Will get that over to you", "Leave it with me, sorting today" can all be commitments when the sender is clearly saying they themselves will act.

IGNORE:
- things the client or any third party will do
- questions, status updates, descriptions of things already done
- reassurance, thanks, chit-chat
- hopes or possibilities that are not commitments
- vague "I'll let you know" / "I'll keep you posted" / "I'll update you when I hear" — communication reassurance is not an action unless a concrete act (call, chase, email, send, check, speak to) is committed.

TIMEFRAME:

"when" must be exactly ONE of:
today, tomorrow, monday, tuesday, wednesday, thursday, friday, saturday, sunday, this_weekend, next_week
OR an explicit date formatted YYYY-MM-DD
OR the empty string "" when the action is clearly promised but NO timeframe is given.

"time" must be "HH:MM" (24-hour) when a specific time is given:
"after 3pm" -> "15:00"; "first thing" -> "09:00"; "in the morning" -> "09:00"; "end of day" / "COB" -> "17:00". Otherwise "".

CERTAINTY:

For each promise, set "certainty":
- "certain" — the sender unambiguously committed to this specific action, and the title plainly restates their words.
- "unsure" — a promise is probably there but something is genuinely ambiguous: what exactly they'll do, who it concerns, or whether it was a real commitment rather than loose talk.

Be conservative with "certain". A wrong task on the to-do list is worse than one waiting in the review pile.

TITLE:

For each promise return a short title: start with a verb, approximately 8 words maximum, describe only the action actually promised, include the subject/reason when stated, never add information that is not in the message or its context, and never include [redacted] — use roles instead.

FINAL DUPLICATE CHECK:

Before returning, compare every promise against every other. If completing one would substantially complete the other, keep only the one that most directly represents the wording.

If there is no qualifying promise, return an empty array.

Return STRICT JSON only, with no markdown, explanation or other text:

{"promises":[{"title":"...","when":"...","time":"...","certainty":"certain"}]}`;

export type ExtractedPromise = { title: string; when: string; time: string; certainty: "certain" | "unsure" };

// One AI read of a single sent message, with optional (already-redacted)
// context lines. Pure of DB writes so it can be dry-run/tested in isolation.
// Returns [] on any parse/model failure.
export async function extractPromises(
  text: string,
  sentAt: Date,
  contextLines: string[] = [],
): Promise<ExtractedPromise[]> {
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "Europe/London" }).format(sentAt);
  const dateStr = toUKDateStr(sentAt);
  const body = text.slice(0, 800);
  const contextBlock = contextLines.length
    ? `Earlier messages (context only — do not extract promises from these):\n${contextLines.join("\n")}\n\n`
    : "";
  const userMessage = `${contextBlock}Message to judge (sent ${weekday} ${dateStr}):\n${body}`;

  let raw: string;
  try {
    raw = await callClaude(SYSTEM, userMessage, 300);
  } catch {
    return [];
  }
  try {
    const parsed = JSON.parse(raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
    const arr = Array.isArray(parsed?.promises) ? parsed.promises : [];
    return arr
      .filter((p: unknown): p is Record<string, unknown> => {
        const o = p as Record<string, unknown>;
        return !!o && typeof o.title === "string" && typeof o.when === "string";
      })
      .map((p: Record<string, unknown>) => ({
        title: String(p.title).slice(0, 120).trim(),
        when: String(p.when).toLowerCase().trim(),
        time: String(p.time ?? "").trim(),
        // Missing/unknown certainty defaults to "unsure" — the pile, never the list.
        certainty: p.certainty === "certain" ? ("certain" as const) : ("unsure" as const),
      }))
      .filter((p: ExtractedPromise) => p.title.length > 0);
  } catch {
    return [];
  }
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

// Turn a "when" token (+ optional time) into a concrete due date, anchored to
// the UK calendar day the message was sent on. Returns null for an empty/unknown
// token (an undated promise — those go to the possibles pile, not the list).
export function resolveDue(anchor: Date, when: string, time: string): Date | null {
  const [y, m, d] = toUKDateStr(anchor).split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d)); // UK calendar day at 00:00
  const dow = base.getUTCDay();

  let target: Date;
  if (when === "today") target = base;
  else if (when === "tomorrow") target = addDays(base, 1);
  else if (when === "this_weekend") target = addDays(base, (6 - dow + 7) % 7);
  else if (when === "next_week") target = addDays(base, ((1 - dow + 7) % 7) || 7);
  else if (WEEKDAYS[when] !== undefined) target = addDays(base, (WEEKDAYS[when] - dow + 7) % 7);
  else if (/^\d{4}-\d{2}-\d{2}$/.test(when)) {
    const [yy, mm, dd] = when.split("-").map(Number);
    target = new Date(Date.UTC(yy, mm - 1, dd));
  } else return null;

  let hour = 9, min = 0;
  const t = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (t) {
    hour = Math.min(23, Math.max(0, Number(t[1])));
    min = Math.min(59, Math.max(0, Number(t[2])));
  }
  target.setUTCHours(hour, min, 0, 0);
  return target;
}

// Midnight (UTC-anchored) of the current UK calendar day — the staleness line.
// A dated promise whose due date is before this is old news: with the 7-day
// look-back an outage recovery could otherwise dump a pile of already-overdue
// tasks. Exported for tests.
export function startOfTodayUK(now = new Date()): Date {
  const [y, m, d] = toUKDateStr(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// The preceding few messages of the same chat, oldest first, ready for the
// model: the sender's own lines verbatim, the other side's lines REDACTED.
async function fetchContextLines(
  m: { sentAt: Date | null; createdAt: Date; providerWebhookData: unknown },
  redactionTokens: string[],
): Promise<string[]> {
  const waChatId = (m.providerWebhookData as { waChatId?: string } | null)?.waChatId;
  if (!waChatId) return [];
  const anchor = m.sentAt ?? m.createdAt;
  const prev = await prisma.outboundMessage.findMany({
    where: {
      method: "whatsapp",
      sentAt: { lt: anchor },
      providerWebhookData: { path: ["waChatId"], equals: waChatId },
    },
    orderBy: { sentAt: "desc" },
    take: 3,
    select: { type: true, content: true },
  });
  return prev
    .reverse()
    .filter((p) => (p.content ?? "").trim().length > 0)
    .map((p) => {
      const text = (p.content ?? "").slice(0, 200);
      return p.type === "outbound" ? `You: "${text}"` : `Them: "${redactForAi(text, redactionTokens)}"`;
    });
}

// Sweep the newest unscanned outbound WhatsApp messages, extract the operator's
// own promises, and create to-dos (certain + dated) or quiet possibles
// (undated / unsure). Idempotent: every message is stamped after processing so
// it's read once, and per-message task creation is guarded by sourceMessageId.
export async function scanWhatsAppPromises(limit = 25): Promise<{ scanned: number; created: number; possibles: number }> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const msgs = await prisma.outboundMessage.findMany({
    where: {
      method: "whatsapp",
      type: "outbound",
      promiseScannedAt: null,
      transactionId: { not: null },
      sentAt: { gte: cutoff },
      transaction: { status: { in: [...ACTIVE_STATUSES] } },
    },
    orderBy: { sentAt: "asc" },
    take: limit,
    select: {
      id: true,
      content: true,
      sentAt: true,
      createdAt: true,
      transactionId: true,
      createdById: true,
      agencyId: true,
      providerWebhookData: true,
      transaction: {
        select: {
          assignedUserId: true,
          agentUserId: true,
          propertyAddress: true,
          contacts: { select: { name: true } },
        },
      },
    },
  });

  let scanned = 0;
  let created = 0;
  let possibles = 0;
  const staleLine = startOfTodayUK();

  for (const m of msgs) {
    try {
      const text = m.content ?? "";
      if (isWorthReading(text)) {
        const anchor = m.sentAt ?? m.createdAt;
        // The task belongs to whoever manages the file (set on the message at
        // ingest). Without an owner we can't create a ManualTask, so skip.
        const ownerId = m.createdById ?? m.transaction?.assignedUserId ?? m.transaction?.agentUserId ?? null;

        // Which connection captured this: null = the internal number. A
        // connectionId means an agency's (or business member's) own linked
        // number — currently SKIPPED entirely (founder test week); when the
        // gate lifts, agency messages become agency-visible to-dos only where
        // the agency opted in (whatsAppTasksEnabled).
        const connectionId = (m.providerWebhookData as { connectionId?: string | null } | null)?.connectionId ?? null;
        let agencyVisible = false;
        let makeTask = true;
        if (connectionId) {
          if (internalOnly()) {
            makeTask = false;
          } else {
            const agency = m.agencyId
              ? await prisma.agency.findUnique({ where: { id: m.agencyId }, select: { whatsAppTasksEnabled: true } })
              : null;
            if (agency?.whatsAppTasksEnabled) agencyVisible = true;
            else makeTask = false;
          }
        }

        if (ownerId && makeTask) {
          const already = await prisma.manualTask.count({ where: { sourceMessageId: m.id } });
          if (already === 0) {
            const redactionTokens = buildRedactionTokens({
              propertyAddress: m.transaction?.propertyAddress,
              names: (m.transaction?.contacts ?? []).map((c) => c.name),
            });
            const context = await fetchContextLines(m, redactionTokens).catch(() => []);
            const promises = await extractPromises(text, anchor, context);
            for (const p of promises) {
              const due = resolveDue(anchor, p.when, p.time);
              // Stale dated promise (7-day look-back after an outage): skip —
              // old news, not a to-do and not a possible.
              if (due && due < staleLine) continue;
              const isPossible = !due || p.certainty !== "certain";
              await createManualTask({
                agencyId: agencyVisible ? m.agencyId : null,
                createdById: ownerId,
                title: p.title,
                notes: `From WhatsApp: "${text.slice(0, 160)}"`,
                transactionId: m.transactionId!,
                dueDate: due ? due.toISOString() : undefined,
                assignedToId: agencyVisible ? ownerId : undefined,
                isInternalSelfAssigned: !agencyVisible,
                isPossible,
                sourceMessageId: m.id,
              });
              if (isPossible) possibles++;
              else created++;
            }
          }
        }
      }
    } catch (err) {
      console.error("[whatsapp-promises] scan failed for", m.id, (err as Error).message);
    }
    // Stamp regardless of outcome so a poison message can't stall the sweep
    // (mirrors the email interpreter). A rare lost promise is preferable to an
    // infinite retry loop.
    await prisma.outboundMessage.update({ where: { id: m.id }, data: { promiseScannedAt: new Date() } }).catch(() => {});
    scanned++;
  }

  return { scanned, created, possibles };
}
