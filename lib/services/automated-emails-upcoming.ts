// Upcoming forecast for /agent/automated-emails.
//
// Two distinct things, kept separate from the queue (these are PREDICTIONS, not
// records):
//   1. predicted — automated sends expected in the next 14 days. Client chases
//      come from the existing per-file projection; solicitor chases are
//      predicted here from the solicitor chase state + cadence.
//   2. exhausted — files where every configured automated chase has been sent
//      AND the milestone is still outstanding. A human-attention signal,
//      proven from chase state + the live milestone state (never inferred).
//
// Scoped through resolveEmailScope, like every other module on this surface.

import { prisma } from "@/lib/prisma";
import { resolveEmailScope, type EmailScopeInput } from "@/lib/services/automated-emails-scope";
import { getAutomatedEmailsForTransaction } from "@/lib/services/automated-emails-preview";
import { CLIENT_CHASE_COUNT_CAP } from "@/lib/services/client-chase-cron";
import { MILESTONE_LABELS } from "@/lib/email-skeletons/journey-order";
import { isLondonWeekday } from "@/lib/emails/working-hours";
import { createTtlMemo } from "@/lib/utils/ttl-memo";

const DAY = 86_400_000;
const HORIZON_DAYS = 14;

export type PredictedItem = {
  id: string;
  kind: "client" | "solicitor";
  txId: string;
  address: string;
  recipientLabel: string;
  milestoneLabel: string;
  milestoneCode: string;
  // Preview identity (upgrade phase 2): exactly what previewChaseEmailAction
  // needs to compose the REAL email this prediction will send, so the Outbox
  // can show a true-to-send preview of a future email.
  contactId: string | null;                    // client predictions
  side: "vendor" | "purchaser" | null;         // solicitor predictions
  chaseNumber: number;
  chaseMax: number;                             // cap for this lane (for "chase N of M")
  predictedFor: Date;
};

export type PredictedBatch = { key: string; label: string; items: PredictedItem[] };

export type ExhaustedItem = {
  id: string;
  kind: "client" | "solicitor";
  txId: string;
  address: string;
  recipientLabel: string;
  milestoneLabel: string;
  chasesSent: number;
  cap: number;
  daysOutstanding: number;
  lastChaseAt: Date | null;
};

export type UpcomingForecast = {
  predicted: PredictedBatch[];
  predictedTotal: number;
  // Predicted automated sends due to go out TODAY (today + overdue, which the
  // Outbox clamps into today). The "Still to send today" tile adds this to the
  // queued-sends count so it reflects what will actually go out today, not just
  // what's already materialised in the queue (critique #295A). Team hand-offs are
  // the separate `exhausted` list and never counted here.
  dueTodayCount: number;
  exhausted: ExhaustedItem[];
  // True when the per-file prediction fan-out hit its file cap — the UI says
  // so instead of silently under-reporting (upgrade phase 5).
  truncated: boolean;
};

// The prediction engine runs per file. Bound the fan-out so a huge book can't
// stampede the database or the request: at most this many files, in small
// concurrent waves. Beyond it, `truncated` is set and shown.
// WAVE SIZE MATTERS: each per-file projection runs its own ~9-query
// Promise.all, so a wave of N holds ~9N connections. The local/server Prisma
// pool is 10 — a wave of 8 exhausted it under load (verified against the dev
// server, 2026-10-21: pool-timeout errors across the whole app). 2 keeps the
// page honest AND leaves pool headroom for everything else on the request.
const FORECAST_FILE_CAP = 300;
const FANOUT_WAVE = 2;

// Run fn over items in waves of `limit` — bounded concurrency without pulling
// in a dependency.
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const wave = items.slice(i, i + limit);
    out.push(...(await Promise.all(wave.map(fn))));
  }
  return out;
}

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });
function dayKey(d: Date): string { return dayKeyFmt.format(d); }
function dayLabel(d: Date): string {
  const k = dayKey(d);
  if (k === dayKey(new Date())) return "Today";
  if (k === dayKey(new Date(Date.now() + DAY))) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "Europe/London" });
}
function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from.getTime());
  let added = 0;
  while (added < n) {
    d.setTime(d.getTime() + DAY);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}
function sideLabel(side: string): string {
  return side === "vendor" ? "Seller's solicitor" : side === "purchaser" ? "Buyer's solicitor" : "Solicitor";
}
function roleLabelFor(role: string): string {
  return role === "vendor" ? "Seller" : role === "purchaser" ? "Buyer" : role;
}
function milestoneLabel(code: string): string {
  return MILESTONE_LABELS[code] ?? code;
}

// ── Short-TTL cache (perf) ───────────────────────────────────────────────────
// The forecast is the heaviest module on /agent/automated-emails: a per-file
// projection (~9 queries each, deliberately throttled to 2 files at a time to
// spare the connection pool). It depends ONLY on scope — never on the tab,
// search, or filters — yet the page is a server component, so every tab/filter/
// toggle click (a URL change) re-ran it from scratch. That was the felt lag.
//
// This memo returns the same scope's forecast for a short window, so clicking
// around the page reuses it. ≤60s stale is fine for a predictions panel (the
// page also auto-refreshes every 2 min). Consumers only read it, never mutate.
const forecastMemo = createTtlMemo<string, UpcomingForecast>({ ttlMs: 60_000 });

function forecastScopeKey(input: EmailScopeInput): string {
  return [input.role, input.userId, input.agencyId ?? "", input.mineOnly ? 1 : 0, input.fileId ?? "", input.hasAdminPowers ? 1 : 0].join("|");
}

export function getUpcomingForecastCached(input: EmailScopeInput): Promise<UpcomingForecast> {
  return forecastMemo.get(forecastScopeKey(input), () => getUpcomingForecast(input));
}

export async function getUpcomingForecast(input: EmailScopeInput): Promise<UpcomingForecast> {
  const { txIds, txAddressById } = await resolveEmailScope(input);
  if (txIds.length === 0) return { predicted: [], predictedTotal: 0, dueTodayCount: 0, exhausted: [], truncated: false };

  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_DAYS * DAY);
  const truncated = txIds.length > FORECAST_FILE_CAP;
  const forecastTxIds = truncated ? txIds.slice(0, FORECAST_FILE_CAP) : txIds;

  // ── Predicted client chases (reuse the per-file projection) ──
  // Bounded waves, not one giant Promise.all — see FANOUT_WAVE above.
  const previews = await mapLimit(forecastTxIds, FANOUT_WAVE, (id) =>
    getAutomatedEmailsForTransaction(id).catch(() => ({
      pending: [], sentToday: [], upcoming: [],
      pauseState: { globalDisabled: false, agencyDisabled: false, fileDisabled: false, activePauseReason: null as string | null, agencyName: null as string | null },
    })),
  );
  const predicted: PredictedItem[] = [];
  previews.forEach((p, idx) => {
    const txId = forecastTxIds[idx];
    const address = txAddressById.get(txId) ?? "(unknown file)";
    for (const u of p.upcoming) {
      predicted.push({
        id: `client-${txId}-${u.contactId}-${u.milestoneCode}`,
        kind: "client",
        txId,
        address,
        recipientLabel: `${u.contactName} · ${roleLabelFor(u.contactRole)}`,
        milestoneLabel: u.milestoneLabel,
        milestoneCode: u.milestoneCode,
        contactId: u.contactId,
        side: null,
        chaseNumber: u.chaseNumber,
        chaseMax: CLIENT_CHASE_COUNT_CAP,
        predictedFor: u.predictedFireDate,
      });
    }
  });

  // ── Predicted solicitor chases (next chase for active states) ──
  const [solStates, solRules, solSettings] = await Promise.all([
    prisma.solicitorChaseState.findMany({
      where: { transactionId: { in: txIds }, status: "active", chaseCount: { gt: 0 }, lastChasedAt: { not: null } },
      select: { id: true, transactionId: true, side: true, milestoneCode: true, chaseCount: true, lastChasedAt: true },
    }),
    prisma.solicitorReminderRule.findMany({ select: { milestoneCode: true, repeatWorkingDays: true, maxChases: true } }),
    prisma.solicitorChaseSettings.findFirst({ select: { repeatDays: true, maxChases: true } }),
  ]);
  const ruleByCode = new Map(solRules.map((r) => [r.milestoneCode, r]));
  const defRepeat = solSettings?.repeatDays ?? 7;
  const defMax = solSettings?.maxChases ?? 2;
  for (const s of solStates) {
    const rule = ruleByCode.get(s.milestoneCode);
    const max = rule?.maxChases ?? defMax;
    if (s.chaseCount >= max || !s.lastChasedAt) continue;
    const repeat = rule?.repeatWorkingDays ?? defRepeat;
    const predictedFor = addWorkingDays(s.lastChasedAt, repeat);
    if (predictedFor > horizon) continue;
    predicted.push({
      id: `sol-${s.id}`,
      kind: "solicitor",
      txId: s.transactionId,
      address: txAddressById.get(s.transactionId) ?? "(unknown file)",
      recipientLabel: sideLabel(s.side),
      milestoneLabel: milestoneLabel(s.milestoneCode),
      milestoneCode: s.milestoneCode,
      contactId: null,
      side: s.side === "vendor" ? "vendor" : "purchaser",
      chaseNumber: s.chaseCount + 1,
      chaseMax: max,
      predictedFor,
    });
  }

  // Group predictions by day.
  predicted.sort((a, b) => a.predictedFor.getTime() - b.predictedFor.getTime());
  const batchMap = new Map<string, PredictedBatch>();
  for (const item of predicted) {
    const k = dayKey(item.predictedFor);
    if (!batchMap.has(k)) batchMap.set(k, { key: k, label: dayLabel(item.predictedFor), items: [] });
    batchMap.get(k)!.items.push(item);
  }

  // ── Automation exhausted ──
  const exhausted = await computeExhausted(txIds, txAddressById, ruleByCode, defMax, now);

  // "Due today" = today's batch plus any overdue batches (the next chase run
  // clears the backlog). But chases run weekdays only — on a weekend NOTHING
  // goes out today, so the figure is 0 and the backlog surfaces under the next
  // send day (Monday) in the Outbox instead of a misleading "Today". (2026-10-25)
  const todayK = dayKey(now);
  const batches = Array.from(batchMap.values());
  const dueTodayCount = isLondonWeekday(now)
    ? batches.filter((b) => b.key <= todayK).reduce((n, b) => n + b.items.length, 0)
    : 0;

  return {
    predicted: batches,
    predictedTotal: predicted.length,
    dueTodayCount,
    exhausted,
    truncated,
  };
}

async function computeExhausted(
  txIds: string[],
  txAddressById: Map<string, string>,
  solRuleByCode: Map<string, { maxChases: number }>,
  defMax: number,
  now: Date,
): Promise<ExhaustedItem[]> {
  // Candidate chase states that have hit their cap.
  const [clientStates, solStates] = await Promise.all([
    prisma.clientChaseState.findMany({
      where: { transactionId: { in: txIds }, chaseCount: { gte: CLIENT_CHASE_COUNT_CAP } },
      select: { id: true, transactionId: true, milestoneCode: true, chaseCount: true, firstChasedAt: true, lastChasedAt: true, buyerRoundId: true, contact: { select: { name: true, roleType: true } } },
    }),
    prisma.solicitorChaseState.findMany({
      where: { transactionId: { in: txIds }, chaseCount: { gt: 0 } },
      select: { id: true, transactionId: true, side: true, milestoneCode: true, chaseCount: true, firstChasedAt: true, lastChasedAt: true },
    }),
  ]);
  const solCapped = solStates.filter((s) => s.chaseCount >= (solRuleByCode.get(s.milestoneCode)?.maxChases ?? defMax));

  // Relist safety: drop a fallen-through buyer's capped CCS rows so they don't
  // show as "automation exhausted" on the new sale.
  const exRounds = await prisma.propertyTransaction.findMany({
    where: { id: { in: txIds } },
    select: { id: true, activeBuyerRoundId: true },
  });
  const activeRoundByTx = new Map(exRounds.map((t) => [t.id, t.activeBuyerRoundId]));
  const scopedClientStates = clientStates.filter(
    (c) => c.buyerRoundId == null || c.buyerRoundId === activeRoundByTx.get(c.transactionId),
  );

  // Confirm the milestone is still outstanding (state = available). Look up the
  // exact (transaction, code) pairs — never infer.
  const codes = new Set<string>([...scopedClientStates.map((c) => c.milestoneCode), ...solCapped.map((s) => s.milestoneCode)]);
  const availableKeys = await availableMilestoneKeys(txIds, [...codes]);

  const out: ExhaustedItem[] = [];
  for (const c of scopedClientStates) {
    if (!availableKeys.has(`${c.transactionId}:${c.milestoneCode}`)) continue;
    const started = c.firstChasedAt ?? c.lastChasedAt;
    out.push({
      id: `client-${c.id}`,
      kind: "client",
      txId: c.transactionId,
      address: txAddressById.get(c.transactionId) ?? "(unknown file)",
      recipientLabel: c.contact ? `${c.contact.name} · ${roleLabelFor(c.contact.roleType)}` : "Client",
      milestoneLabel: milestoneLabel(c.milestoneCode),
      chasesSent: c.chaseCount,
      cap: CLIENT_CHASE_COUNT_CAP,
      daysOutstanding: started ? Math.floor((now.getTime() - started.getTime()) / DAY) : 0,
      lastChaseAt: c.lastChasedAt,
    });
  }
  for (const s of solCapped) {
    if (!availableKeys.has(`${s.transactionId}:${s.milestoneCode}`)) continue;
    const started = s.firstChasedAt ?? s.lastChasedAt;
    out.push({
      id: `sol-${s.id}`,
      kind: "solicitor",
      txId: s.transactionId,
      address: txAddressById.get(s.transactionId) ?? "(unknown file)",
      recipientLabel: sideLabel(s.side),
      milestoneLabel: milestoneLabel(s.milestoneCode),
      chasesSent: s.chaseCount,
      cap: solRuleByCode.get(s.milestoneCode)?.maxChases ?? defMax,
      daysOutstanding: started ? Math.floor((now.getTime() - started.getTime()) / DAY) : 0,
      lastChaseAt: s.lastChasedAt,
    });
  }
  out.sort((a, b) => b.daysOutstanding - a.daysOutstanding);
  return out;
}

// Returns a set of "transactionId:code" for milestones currently in the
// `available` (outstanding) state.
async function availableMilestoneKeys(txIds: string[], codes: string[]): Promise<Set<string>> {
  if (codes.length === 0) return new Set();
  const defs = await prisma.milestoneDefinition.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const codeById = new Map(defs.map((d) => [d.id, d.code]));
  const rows = await prisma.milestoneCompletion.findMany({
    where: { transactionId: { in: txIds }, milestoneDefinitionId: { in: defs.map((d) => d.id) }, state: "available" },
    select: { transactionId: true, milestoneDefinitionId: true },
  });
  const set = new Set<string>();
  for (const r of rows) {
    const code = codeById.get(r.milestoneDefinitionId);
    if (code) set.add(`${r.transactionId}:${code}`);
  }
  return set;
}
