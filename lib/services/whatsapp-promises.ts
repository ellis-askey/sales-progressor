import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/anthropic";
import { createManualTask } from "@/lib/services/manual-tasks";
import { toUKDateStr } from "@/lib/utils";
import { PROMISE_HINT } from "@/lib/services/whatsapp-promise-hint";

// "Promises" — turn a WhatsApp message the operator SENT into a to-do, but ONLY
// when they commit to doing something themselves AND give a timeframe.
//   - Internal number (no connectionId): internal self-assigned tasks, which
//     surface on /agent/to-do for internal staff and never to agency users.
//   - An agency's own linked number (connectionId set): AGENCY-VISIBLE dated
//     to-dos on the file, but only when that agency has opted in
//     (Agency.whatsAppTasksEnabled). If not opted in, no task is created.
//
// Passive: it only READS outbound WhatsApp content and writes a private task.
// It never sends anything on WhatsApp. Each outbound message is scanned at most
// once (OutboundMessage.promiseScannedAt). Deliberately mirrors the inbound
// email interpreter (lib/services/email-interpret.ts): cheap Haiku call, scan
// stamp, conservative extraction, never acts without the task being visible.

const ACTIVE_STATUSES = ["draft", "active", "on_hold"] as const;

// Cheap pre-filter (in ./whatsapp-promise-hint, kept prisma-free so it's unit-
// tested): only spend an AI call on messages that plausibly contain a first-person
// future commitment. Everything else is stamped and skipped for free, so the
// model only ever reads the small slice that looks like a promise. (We already
// only scan OUTBOUND messages, which on the linked account are the operator's own
// sends — so other agents' group messages, which arrive as inbound, are never
// picked up.)

const SYSTEM = `You help a UK estate-agency sales progressor never forget a promise.

You read ONE WhatsApp message that the progressor SENT to a client and extract concrete commitments the sender makes to do something THEMSELVES at a stated time.

Your job is to identify DISTINCT promised actions, not every possible interpretation or paraphrase of the message.

CORE RULE:

Return ONE promise for each clearly separate action the sender explicitly commits to doing.

Do NOT split one commitment into multiple tasks.

Two promises are separate ONLY if the message clearly commits the sender to two different actions.

Examples:

"I'll chase the solicitor tomorrow."
-> ONE promise: chase the solicitor.

"I'll check in with the agents today."
-> ONE promise: check in with the agents.

"I'll check in with the agents today and see where things are."
-> ONE promise. "See where things are" describes the purpose/result of checking in; it is not another action.

"I'll chase the solicitor and call you tomorrow."
-> TWO promises because "chase the solicitor" and "call you" are two separate actions explicitly stated in the message.

"I'll email the buyer today and speak to the seller tomorrow."
-> TWO promises because both actions are independently stated and each has a timeframe.

GROUNDING RULE:

Every promise you return must be directly supported by words in the message.

For EACH proposed promise, verify all of the following:

1. The message explicitly says or clearly states that the SENDER will perform that action.
2. The action itself appears in or is directly expressed by the message.
3. A timeframe for that action appears in the message.
4. It is genuinely distinct from every other promise you are returning.

Do NOT:
- invent an additional action that is merely implied
- turn context into an action
- turn the expected result of an action into another task
- create multiple titles that describe the same underlying action
- create a broader or narrower version of an action as a second task
- paraphrase one commitment into two promises
- infer another person who should be contacted unless the message says so
- invent "ask for an update", "get an update", "follow up", "check progress", etc. as separate actions when these merely describe the purpose of an already extracted chase/check/call/email
- copy a timeframe from one action onto another action unless the wording clearly applies that timeframe to both

If two candidate promises would cause the sender to essentially do the same thing once, they are ONE promise.

When unsure whether there are one or two promises, return ONE.

When unsure whether an action was actually promised, do not return it.

TIMEFRAME RULE:

Only include a promise when that specific action has a timeframe.

Valid timeframes include:
today, tomorrow, a weekday, an explicit date, after the weekend, next week, after a specific time, first thing, morning, end of day or COB.

A timeframe may apply to multiple actions only when the sentence clearly applies it to all of them.

Example:
"I'll chase the solicitor and call you both on Friday."
-> Friday clearly applies to both actions, so return TWO promises, both for friday.

But:
"I'll chase the solicitor today. I'll also speak to the agent."
-> Return ONLY "Chase the solicitor" because only that action has a timeframe.

WHAT COUNTS AS A PROMISE:

Extract concrete actions the sender commits to taking themselves, such as:
- chase
- call
- ring
- email
- send
- check
- check in with
- speak to
- contact
- book

The wording does not need to literally say "I'll".

For example:
"Can check in with them today"
can be a commitment when, in context, the sender is clearly saying they themselves will do it.

IGNORE:

- things the client will do
- things another agent, solicitor, buyer, seller or third party will do
- questions
- status updates
- descriptions of things already done
- reassurance
- thanks
- general chit-chat
- hopes or possibilities that are not commitments
- vague "I'll let you know"
- "I'll keep you posted"
- "I'll update you when I hear"
- vague "I'll come back to you" reassurance

Do not create a task from vague communication reassurance unless the sender commits to a concrete action such as calling, chasing, emailing, sending, checking or speaking to somebody at a stated time.

TITLE:

For each promise return a short title:
- start with a verb
- approximately 8 words maximum
- describe only the action actually promised
- include the subject/reason when explicitly stated
- do not add information that is not in the message

WHEN:

"when" must be exactly ONE of:

today
tomorrow
monday
tuesday
wednesday
thursday
friday
saturday
sunday
this_weekend
next_week

OR an explicit date formatted:

YYYY-MM-DD

TIME:

"time" must be "HH:MM" in 24-hour format when a specific time is given.

Use:
- "after 3pm" -> "15:00"
- "first thing" -> "09:00"
- "in the morning" -> "09:00"
- "end of day" -> "17:00"
- "COB" -> "17:00"

Otherwise use "".

FINAL DUPLICATE CHECK:

Before returning the JSON, compare every promise against every other promise.

Ask:

"Would completing one of these tasks substantially complete the other?"

If YES, keep only the single title that most directly represents the wording of the message.

Never return two promises that are overlapping descriptions of the same commitment.

Be conservative. It is better to return one well-grounded task than two overlapping tasks.

If there is no qualifying promise, return an empty array.

Return STRICT JSON only, with no markdown, explanation or other text:

{"promises":[{"title":"...","when":"...","time":"..."}]}`;

export type ExtractedPromise = { title: string; when: string; time: string };

// One AI read of a single sent message. Pure of DB writes so it can be
// dry-run/tested in isolation. Returns [] on any parse/model failure.
export async function extractPromises(text: string, sentAt: Date): Promise<ExtractedPromise[]> {
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "Europe/London" }).format(sentAt);
  const dateStr = toUKDateStr(sentAt);
  const body = text.slice(0, 800);
  const userMessage = `Message (sent ${weekday} ${dateStr}):\n${body}`;

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
      .filter((p: unknown): p is ExtractedPromise => {
        const o = p as Record<string, unknown>;
        return !!o && typeof o.title === "string" && typeof o.when === "string";
      })
      .map((p: ExtractedPromise) => ({
        title: String(p.title).slice(0, 120).trim(),
        when: String(p.when).toLowerCase().trim(),
        time: String(p.time ?? "").trim(),
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
// the UK calendar day the message was sent on. Returns null for a token with no
// timeframe, so callers skip undated promises (feature scope: dated only).
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

// Sweep the newest unscanned outbound WhatsApp messages, extract the operator's
// own dated promises, and create internal to-dos for them. Idempotent: every
// message is stamped after processing so it's read once, and per-message task
// creation is guarded by sourceMessageId. Recency-bounded so a first run never
// backfills a mountain of historical (already-overdue) tasks.
export async function scanWhatsAppPromises(limit = 25): Promise<{ scanned: number; created: number }> {
  const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
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
      transaction: { select: { assignedUserId: true, agentUserId: true } },
    },
  });

  let scanned = 0;
  let created = 0;

  for (const m of msgs) {
    try {
      const text = m.content ?? "";
      if (PROMISE_HINT.test(text)) {
        const anchor = m.sentAt ?? m.createdAt;
        // The task belongs to whoever manages the file (set on the message at
        // ingest). Without an owner we can't create a ManualTask, so skip.
        const ownerId = m.createdById ?? m.transaction?.assignedUserId ?? m.transaction?.agentUserId ?? null;

        // Which connection captured this: null = the internal number (keeps its
        // internal self-assigned to-dos, unchanged). A connectionId means an
        // agency's own linked number — those become AGENCY-VISIBLE dated to-dos,
        // but only if that agency has opted in (whatsAppTasksEnabled). Otherwise
        // we create nothing (an agency's promises never fall into the internal pile).
        const connectionId = (m.providerWebhookData as { connectionId?: string | null } | null)?.connectionId ?? null;
        let agencyVisible = false;
        let makeTask = true;
        if (connectionId) {
          const agency = m.agencyId
            ? await prisma.agency.findUnique({ where: { id: m.agencyId }, select: { whatsAppTasksEnabled: true } })
            : null;
          if (agency?.whatsAppTasksEnabled) agencyVisible = true;
          else makeTask = false;
        }

        if (ownerId && makeTask) {
          const already = await prisma.manualTask.count({ where: { sourceMessageId: m.id } });
          if (already === 0) {
            const promises = await extractPromises(text, anchor);
            for (const p of promises) {
              const due = resolveDue(anchor, p.when, p.time);
              if (!due) continue; // undated promise — out of scope, skip
              await createManualTask({
                agencyId: agencyVisible ? m.agencyId : null,
                createdById: ownerId,
                title: p.title,
                notes: `From WhatsApp: "${text.slice(0, 160)}"`,
                transactionId: m.transactionId!,
                dueDate: due.toISOString(),
                assignedToId: agencyVisible ? ownerId : undefined,
                isInternalSelfAssigned: !agencyVisible,
                sourceMessageId: m.id,
              });
              created++;
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

  return { scanned, created };
}
