import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/anthropic";
import { createManualTask } from "@/lib/services/manual-tasks";
import { toUKDateStr } from "@/lib/utils";

// "Promises" — turn a WhatsApp message the progressor SENT into an internal
// to-do, but ONLY when they commit to doing something themselves AND give a
// timeframe. Internal-only (isInternalSelfAssigned tasks, which surface on
// /agent/to-do for internal staff and never to customer-agency users).
//
// Passive: it only READS outbound WhatsApp content and writes a private task.
// It never sends anything on WhatsApp. Each outbound message is scanned at most
// once (OutboundMessage.promiseScannedAt). Deliberately mirrors the inbound
// email interpreter (lib/services/email-interpret.ts): cheap Haiku call, scan
// stamp, conservative extraction, never acts without the task being visible.

const ACTIVE_STATUSES = ["draft", "active", "on_hold"] as const;

// Cheap pre-filter: only spend an AI call on messages that plausibly contain a
// first-person future commitment. Everything else is stamped and skipped for
// free, so the model only ever reads the small slice that looks like a promise.
// (We already only scan OUTBOUND messages, which on the linked account are the
// operator's own sends — so other agents' group messages, which arrive as
// inbound, are never picked up.)
const PROMISE_HINT =
  /\b(i'?ll|i will|i'?m going to|i am going to|let me|leave it with me|will (?:chase|call|email|follow|check|come back|do it|get|sort|look|speak|ring|update|send|note|nudge|report))\b/i;

const SYSTEM = `You help a UK estate-agency sales progressor never forget a promise. You read ONE WhatsApp message that the progressor SENT to a client, and extract any commitment the progressor makes to do something THEMSELVES — but only when a timeframe is given.

Rules:
- Only extract things the SENDER promises to do themselves ("I'll chase the solicitor", "I'll call you after 3", "leave it with me and I'll come back Monday"). Ignore anything the client or another party will do.
- Only include a promise if it has a timeframe (today, tomorrow, a weekday, a date, "after the weekend", "next week", "after 3pm", "first thing", "end of day"). If there is NO timeframe, do not include it.
- Ignore questions, status updates, reassurance, thanks, and general chit-chat.
- Do NOT create a task for a vague "I'll let you know / keep you posted / update you when I hear / come back to you" reassurance — those are not actions with a deadline. Only extract a concrete action the sender will take: chase, call, email, ring, book, send, check, or speak to a named party.
- One message can contain more than one promise — return each separately.
- Be conservative. If unsure, return an empty list.

For each promise return:
- "title": a short action starting with a verb, max ~8 words, e.g. "Chase the solicitor re: enquiries". Include what it is about if the message says so.
- "when": exactly one of: today, tomorrow, monday, tuesday, wednesday, thursday, friday, saturday, sunday, this_weekend, next_week, or an ISO date "YYYY-MM-DD" when an explicit date is given.
- "time": "HH:MM" 24h if a specific time is given ("after 3pm" -> "15:00", "first thing"/"in the morning" -> "09:00", "end of day"/"COB" -> "17:00"); otherwise "".

Return STRICT JSON only, no other text:
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
        if (ownerId) {
          const already = await prisma.manualTask.count({ where: { sourceMessageId: m.id } });
          if (already === 0) {
            const promises = await extractPromises(text, anchor);
            for (const p of promises) {
              const due = resolveDue(anchor, p.when, p.time);
              if (!due) continue; // undated promise — out of scope, skip
              await createManualTask({
                agencyId: null,
                createdById: ownerId,
                title: p.title,
                notes: `From WhatsApp — "${text.slice(0, 160)}"`,
                transactionId: m.transactionId!,
                dueDate: due.toISOString(),
                isInternalSelfAssigned: true,
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
