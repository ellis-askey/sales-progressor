// The "By sale" cockpit for /agent/automated-emails (internal staff only, for
// now). Re-groups the data the page already loads — per-file coverage
// (getAutomationFiles), needs-attention items, and the chase forecast — into a
// file-centric operational view: what's stuck, what's chasing, what's quiet.
// See docs/active/auto-emails-cockpit/PLAN.md.
//
// The assembler is PURE (unit-tested); getBySaleCockpit is the thin IO shell
// that signs photos and calls it. No new heavy queries — the heavy modules are
// fetched once by the page and passed in.

import { prisma } from "@/lib/prisma";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { nextChaseSendDay, isLondonWeekday } from "@/lib/emails/working-hours";
import type { FileAutomationRow } from "@/lib/services/automated-emails-coverage";
import type { NeedsAttentionItem } from "@/lib/services/automated-emails-overview";
import type { PredictedItem, ExhaustedItem, UpcomingForecast } from "@/lib/services/automated-emails-upcoming";
import type { EmailScopeInput } from "@/lib/services/automated-emails-scope";

export type CockpitNeedKind = "bounced" | "missing" | "errored" | "chased_out";
export type CockpitNeedRow = {
  txId: string; address: string; photoUrl: string | null;
  kind: CockpitNeedKind;
  pillLabel: string;       // the deviation badge ("Email bounced" etc.)
  headline: string;        // the one-line situation
  actionLabel: string;     // the single safe action (navigates to the file)
};
export type CockpitChaseRow = {
  txId: string; address: string; photoUrl: string | null;
  who: string;             // "Buyer's solicitor", "Kim Bowling · Buyer", …
  isSolicitor: boolean;
  isBuyerSide: boolean;
  milestone: string;
  nextLabel: string;       // the send day for THIS row ("Mon 26 Oct")
  onDefaultRun: boolean;   // true when it goes with the common next run
  chaseNumber: number; chaseMax: number;
};
export type CockpitQuietRow = { txId: string; address: string; photoUrl: string | null; nextLabel: string | null };

export type Cockpit = {
  needsYou: CockpitNeedRow[];
  chasing: CockpitChaseRow[];
  chasingRunLabel: string | null; // the common next-run label for the group header
  allSet: CockpitQuietRow[];
  paused: CockpitQuietRow[];
};

// ── Day formatting (London) ──────────────────────────────────────────────────
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });
const dayNiceFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" });
function dayKey(d: Date): string { return dayKeyFmt.format(d); }
function dayLabel(d: Date, now: Date): string {
  const k = dayKey(d);
  if (k === dayKey(now)) return "Today";
  if (k === dayKey(new Date(now.getTime() + 86_400_000))) return "Tomorrow";
  return dayNiceFmt.format(d);
}

type AssembleInput = {
  files: FileAutomationRow[];
  needsItems: NeedsAttentionItem[];
  predicted: PredictedItem[];
  exhausted: ExhaustedItem[];
  photoByTx: Map<string, string | null>;
};

// Most-urgent-first within "Needs you".
const NEED_RANK: Record<CockpitNeedKind, number> = { bounced: 0, missing: 1, errored: 2, chased_out: 3 };

function sideFromLabel(label: string): { isSolicitor: boolean; isBuyer: boolean } {
  const l = label.toLowerCase();
  const isSolicitor = l.includes("solicitor");
  const isBuyer = l.includes("buyer") || l.includes("purchaser");
  return { isSolicitor, isBuyer };
}

export function assembleCockpit(input: AssembleInput, now: Date): Cockpit {
  const { files, needsItems, predicted, exhausted, photoByTx } = input;
  const photo = (id: string) => photoByTx.get(id) ?? null;
  const fileById = new Map(files.map((f) => [f.txId, f]));

  // ── Per-file "stuck" signals ──
  type Stuck = { kind: CockpitNeedKind; reason: string | null };
  const stuckByFile = new Map<string, Stuck>();
  const consider = (txId: string, kind: CockpitNeedKind, reason: string | null) => {
    const cur = stuckByFile.get(txId);
    if (!cur || NEED_RANK[kind] < NEED_RANK[cur.kind]) stuckByFile.set(txId, { kind, reason });
  };
  for (const it of needsItems) {
    if (it.status === "bounced" || it.status === "blocked") consider(it.transactionId, "bounced", it.reason);
    else if (it.status === "missing") consider(it.transactionId, "missing", it.recipientRole);
    else if (it.status === "failed" || it.status === "errored" || it.status === "deferred") consider(it.transactionId, "errored", it.reason);
  }
  // A file-level missing-email gap (needInfo) that didn't surface as an item.
  for (const f of files) if (f.status === "needInfo" && !stuckByFile.has(f.txId)) consider(f.txId, "missing", null);
  for (const ex of exhausted) consider(ex.txId, "chased_out", `${ex.chasesSent} of ${ex.cap} chases sent · ${ex.milestoneLabel} still open (${ex.daysOutstanding}d)`);

  const addressOf = (txId: string, fallback: string) => fileById.get(txId)?.address ?? fallback;

  const needsYou: CockpitNeedRow[] = [...stuckByFile.entries()].map(([txId, s]) => {
    const addr = addressOf(txId, needsItems.find((n) => n.transactionId === txId)?.transactionAddress
      ?? exhausted.find((e) => e.txId === txId)?.address ?? "this sale");
    const base = { txId, address: addr, photoUrl: photo(txId), kind: s.kind };
    switch (s.kind) {
      case "bounced": return { ...base, pillLabel: "Email bounced", headline: "A client's email bounced. Chasing is paused until it's fixed.", actionLabel: "Update email" };
      case "missing": return { ...base, pillLabel: "Needs an email", headline: `No ${s.reason ? s.reason + " " : ""}email on file, so nothing can send yet.`, actionLabel: "Add email" };
      case "errored": return { ...base, pillLabel: "Send failed", headline: s.reason?.trim() || "A send failed and needs a look.", actionLabel: "Review" };
      case "chased_out": return { ...base, pillLabel: "Chased out", headline: s.reason?.trim() || "Every automated chase has been sent and the step is still open.", actionLabel: "Log a call" };
    }
  }).sort((a, b) => NEED_RANK[a.kind] - NEED_RANK[b.kind] || a.address.localeCompare(b.address));

  // ── Chasing now: soonest predicted chase per file, excluding stuck/paused ──
  const soonest = new Map<string, PredictedItem>();
  for (const p of predicted) {
    if (stuckByFile.has(p.txId)) continue;
    if (fileById.get(p.txId)?.status === "paused") continue;
    const cur = soonest.get(p.txId);
    if (!cur || p.predictedFor.getTime() < cur.predictedFor.getTime()) soonest.set(p.txId, p);
  }
  // The common next run = the most frequent effective send day among chasers.
  const effectiveNext = (p: PredictedItem): Date => nextChaseSendDay(p.predictedFor.getTime() > now.getTime() ? p.predictedFor : now);
  const dayCounts = new Map<string, number>();
  for (const p of soonest.values()) { const k = dayKey(effectiveNext(p)); dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1); }
  let runKey: string | null = null; let runMax = -1;
  for (const [k, n] of dayCounts) if (n > runMax) { runMax = n; runKey = k; }
  const chasingRunLabel = runKey ? dayLabel([...soonest.values()].map(effectiveNext).find((d) => dayKey(d) === runKey)!, now) : null;

  const chasing: CockpitChaseRow[] = [...soonest.values()].map((p) => {
    const d = effectiveNext(p);
    const { isSolicitor, isBuyer } = sideFromLabel(p.recipientLabel);
    return {
      txId: p.txId, address: addressOf(p.txId, p.address), photoUrl: photo(p.txId),
      who: p.recipientLabel, isSolicitor, isBuyerSide: isBuyer,
      milestone: p.milestoneLabel,
      nextLabel: dayLabel(d, now), onDefaultRun: dayKey(d) === runKey,
      chaseNumber: p.chaseNumber, chaseMax: p.chaseMax,
    };
  }).sort((a, b) => a.address.localeCompare(b.address));

  // ── Paused + All set (from the per-file rollup) ──
  const surfaced = new Set<string>([...stuckByFile.keys(), ...soonest.keys()]);
  const paused: CockpitQuietRow[] = [];
  const allSet: CockpitQuietRow[] = [];
  for (const f of files) {
    if (surfaced.has(f.txId)) continue;
    const row: CockpitQuietRow = { txId: f.txId, address: f.address, photoUrl: photo(f.txId), nextLabel: f.nextSendAt ? dayLabel(nextChaseSendDay(f.nextSendAt), now) : null };
    if (f.status === "paused") paused.push(row); else allSet.push(row);
  }
  paused.sort((a, b) => a.address.localeCompare(b.address));
  allSet.sort((a, b) => a.address.localeCompare(b.address));

  return { needsYou, chasing, chasingRunLabel, allSet, paused };
}

// IO shell: sign photos for the cockpit files, then assemble. Reuses the page's
// already-fetched needs + forecast; `files` is fetched on the By-sale tab.
export async function getBySaleCockpit(
  _scope: EmailScopeInput,
  files: FileAutomationRow[],
  needsItems: NeedsAttentionItem[],
  forecast: UpcomingForecast | null,
): Promise<Cockpit> {
  const txIds = files.map((f) => f.txId);
  const photoByTx = new Map<string, string | null>();
  if (txIds.length) {
    const rows = await prisma.propertyTransaction.findMany({ where: { id: { in: txIds } }, select: { id: true, photoStoragePath: true } });
    const signed = await getSignedUrlMap(rows.map((r) => r.photoStoragePath).filter((p): p is string => !!p));
    for (const r of rows) photoByTx.set(r.id, r.photoStoragePath ? signed.get(r.photoStoragePath) ?? null : null);
  }
  return assembleCockpit({
    files,
    needsItems,
    predicted: (forecast?.predicted ?? []).flatMap((b) => b.items),
    exhausted: forecast?.exhausted ?? [],
    photoByTx,
  }, new Date());
}

// Internal-staff gate — the cockpit is TSP-only until it's perfected, then this
// relaxes to roll it out to agencies + external SP.
export function cockpitEnabledForRole(role: string): boolean {
  return role === "sales_progressor" || role === "admin" || role === "superadmin";
}

// Re-exported so callers can keep weekday logic in one place if needed.
export { isLondonWeekday };
