// lib/command/timeframes.ts
//
// Command Centre → Timeframes. Live median + mean + sample-size for the elapsed
// time between milestone steps across real sales, so the founder can calibrate
// the app's hardcoded stage assumptions (MILESTONE_DURATION_MEDIANS in
// lib/services/fees.ts).
//
// Inclusion model (deliberately NOT the app's blanket exclusion):
//   - We include organic, migrated AND claimed sales. A migrated sale's dates
//     are real historical dates; a claimed sale that started fresh is organic.
//   - Each step uses its REAL date where we have it: eventDate ?? completedAt.
//   - The one thing we drop is an UNKNOWABLE date: a step reconciled at claim
//     with no event date (its completedAt is the claim day, not the real day).
//     Those single gaps are skipped; the rest of that sale still counts.
//   - "Sale added" is anchored on the sale's TRUE start (earliest reconciled
//     event date for claimed files) via computeEffectiveStartDate, so a claimed
//     sale counts as if it was on the system from the beginning.
//   - Negative (out-of-order) gaps are skipped.
// Toggles let the founder view organic-only, or exclude ever-held files.

import { commandDb } from "@/lib/command/prisma";
import type { Prisma } from "@prisma/client";
import { computeEffectiveStartDate, MILESTONE_DURATION_MEDIANS } from "@/lib/services/fees";
import type { CommandMode } from "@/lib/command/scope";

const DAY_MS = 86_400_000;

// ─── Segments ────────────────────────────────────────────────────────────────

export type SegmentKey = "all" | "fh_mtg" | "fh_cash" | "lh_mtg" | "lh_cash";
export const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: "all", label: "All sales" },
  { key: "fh_mtg", label: "Freehold · Mortgage" },
  { key: "fh_cash", label: "Freehold · Cash" },
  { key: "lh_mtg", label: "Leasehold · Mortgage" },
  { key: "lh_cash", label: "Leasehold · Cash" },
];
export function parseSegment(v: string | undefined): SegmentKey {
  return SEGMENTS.some((s) => s.key === v) ? (v as SegmentKey) : "all";
}

// Cash = cash buyer AND cash from proceeds (founder's grouping).
function methodOf(pt: string | null): "mtg" | "cash" | null {
  if (pt === "mortgage") return "mtg";
  if (pt === "cash_buyer" || pt === "cash_from_proceeds") return "cash";
  return null;
}
function tenureOf(t: string | null): "fh" | "lh" | null {
  if (t === "freehold") return "fh";
  if (t === "leasehold") return "lh";
  return null;
}
function txInSegment(tenure: string | null, purchaseType: string | null, seg: SegmentKey): boolean {
  if (seg === "all") return true;
  const [t, m] = seg.split("_");
  return tenureOf(tenure) === t && methodOf(purchaseType) === m;
}

// ─── Measure config ──────────────────────────────────────────────────────────

type Anchor = { kind: "start" } | { kind: "code"; codes: string[]; useEventDate?: boolean };

type MeasureDef = {
  key: string;
  label: string;
  group: string;
  from: Anchor;
  to: string[]; // fallback order — first present + usable wins
  // Codes whose per-step app assumptions sum to this interval (the "assumed" column).
  assumedCodes: string[];
  // When the app's assumption for this span is dynamic / not in the constant
  // map (e.g. the leasehold management pack, 35d), state it explicitly.
  assumedOverride?: number;
  applies: "all" | "mortgage" | "leasehold";
  headline?: boolean;
};

const START: Anchor = { kind: "start" };
const code = (codes: string[], useEventDate = false): Anchor => ({ kind: "code", codes, useEventDate });

// The founder's requested spans + additions. `to` carries a fallback list so a
// one-number measure resolves from whichever side confirmed it.
export const MEASURES: MeasureDef[] = [
  // Headline
  { key: "sale_exchange", label: "Sale added → exchanged", group: "Headline", from: START, to: ["PM26", "VM19"], assumedCodes: [], applies: "all", headline: true },
  { key: "sale_completion", label: "Sale added → completed", group: "Headline", from: START, to: ["PM27", "VM20"], assumedCodes: [], applies: "all", headline: true },

  // Getting started
  { key: "sale_dcp", label: "Sale added → contract pack out", group: "Getting started", from: START, to: ["VM7", "PM7"], assumedCodes: ["VM1", "VM3", "VM4", "VM5", "VM6", "VM7"], applies: "all" },
  { key: "forms_return", label: "Property forms received → returned", group: "Getting started", from: code(["VM5"]), to: ["VM6"], assumedCodes: ["VM6"], applies: "all" },
  { key: "sale_mortgage", label: "Sale added → mortgage applied", group: "Getting started", from: START, to: ["PM5"], assumedCodes: ["PM5"], applies: "mortgage" },

  // Searches & mortgage
  { key: "dcp_searches", label: "Contract pack → searches ordered", group: "Searches & mortgage", from: code(["VM7", "PM7"]), to: ["PM8"], assumedCodes: ["PM8"], applies: "all" },
  { key: "searches_back", label: "Searches ordered → results back", group: "Searches & mortgage", from: code(["PM8"]), to: ["PM13"], assumedCodes: ["PM13"], applies: "all" },
  { key: "mortgage_valuation", label: "Mortgage applied → valuation", group: "Searches & mortgage", from: code(["PM5"]), to: ["PM6"], assumedCodes: ["PM6"], applies: "mortgage" },
  { key: "valuation_offer", label: "Valuation day → offer received", group: "Searches & mortgage", from: code(["PM6"], true), to: ["PM11"], assumedCodes: ["PM11"], applies: "mortgage" },
  { key: "survey_report", label: "Survey done → report received", group: "Searches & mortgage", from: code(["PM9"], true), to: ["PM10"], assumedCodes: ["PM10"], applies: "all" },

  // Leasehold
  { key: "mgmt_pack", label: "Management pack requested → received", group: "Leasehold", from: code(["VM8"]), to: ["VM9", "PM12"], assumedCodes: [], assumedOverride: 35, applies: "leasehold" },

  // Enquiries
  { key: "dcp_enquiries", label: "Contract pack → enquiries raised", group: "Enquiries", from: code(["VM7", "PM7"]), to: ["PM14", "VM10"], assumedCodes: ["PM14"], applies: "all" },
  { key: "enquiries_satisfied", label: "Enquiries raised → satisfied", group: "Enquiries", from: code(["PM14", "VM10"]), to: ["PM20", "VM21"], assumedCodes: ["PM20"], applies: "all" },

  // To exchange
  { key: "satisfied_report", label: "Enquiries satisfied → final report", group: "To exchange", from: code(["PM20", "VM21"]), to: ["PM21"], assumedCodes: ["PM21"], applies: "all" },
  { key: "report_contract", label: "Final report → contract issued", group: "To exchange", from: code(["PM21"]), to: ["PM22", "VM16"], assumedCodes: ["PM22"], applies: "all" },
  { key: "contract_sign", label: "Contract issued → signed", group: "To exchange", from: code(["PM22", "VM16"]), to: ["PM23", "VM17"], assumedCodes: ["PM23"], applies: "all" },
  { key: "sign_exchange", label: "Signed → exchanged", group: "To exchange", from: code(["PM23", "VM17"]), to: ["PM26", "VM19"], assumedCodes: ["PM24", "PM25", "PM26"], applies: "all" },
  { key: "ready_exchange", label: "Ready to exchange → exchanged", group: "To exchange", from: code(["PM25", "VM18"]), to: ["PM26", "VM19"], assumedCodes: ["PM26"], applies: "all" },
  { key: "exchange_completion", label: "Exchanged → completed", group: "To exchange", from: code(["PM26", "VM19"]), to: ["PM27", "VM20"], assumedCodes: ["PM27"], applies: "all" },
];

export const MEASURE_GROUPS = ["Getting started", "Searches & mortgage", "Leasehold", "Enquiries", "To exchange"];

function measureAppliesToSegment(applies: MeasureDef["applies"], seg: SegmentKey): boolean {
  if (applies === "all") return true;
  if (applies === "mortgage") return seg === "all" || seg === "fh_mtg" || seg === "lh_mtg";
  return seg === "all" || seg === "lh_mtg" || seg === "lh_cash"; // leasehold
}

function assumedDays(codes: string[]): number | null {
  if (codes.length === 0) return null;
  return codes.reduce((s, c) => s + (MILESTONE_DURATION_MEDIANS[c] ?? 0), 0);
}

// ─── Stats ───────────────────────────────────────────────────────────────────

function median(v: number[]): number | null {
  if (v.length === 0) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
function mean(v: number[]): number | null {
  if (v.length === 0) return null;
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}

export type MeasureResult = {
  key: string;
  label: string;
  group: string;
  assumed: number | null;
  median: number | null;
  mean: number | null;
  n: number;
};

export type TimeframesResult = {
  segment: SegmentKey;
  includeEstimated: boolean;
  excludeHeld: boolean;
  totalSales: number; // sales in the segment considered
  usableSales: number; // sales that contributed at least one gap
  headline: MeasureResult[];
  groups: { group: string; measures: MeasureResult[] }[];
  perStep: { code: string; name: string; side: "vendor" | "purchaser"; assumed: number | null; median: number | null; mean: number | null; n: number }[];
};

type CompletionLite = { code: string; predecessorCode: string | null; date: Date; usable: boolean; eventDate: Date | null };

export async function getStageTimeframes(opts: {
  segment: SegmentKey;
  includeEstimated: boolean;
  excludeHeld: boolean;
  mode: CommandMode;
  agencyIds: string[];
}): Promise<TimeframesResult> {
  const { segment, includeEstimated, excludeHeld, mode, agencyIds } = opts;

  // Transaction scope: real files only (exclude internal agencies + demo +
  // drafts). Optionally drop migrated/claimed for an organic-only view.
  const txWhere: Prisma.PropertyTransactionWhereInput = {
    status: { not: "draft" },
    isDemo: false,
    agency: { isInternal: false },
  };
  if (agencyIds.length > 0) txWhere.agencyId = { in: agencyIds };
  else if (mode === "sp") txWhere.serviceType = "self_managed";
  else if (mode === "pm") txWhere.serviceType = "outsourced";
  if (!includeEstimated) {
    txWhere.isMigrated = false;
    txWhere.claimedInProgress = false;
  }

  const defs = await commandDb.milestoneDefinition.findMany({
    select: { code: true, name: true, side: true, orderIndex: true, predecessorCode: true },
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
  });
  const predByCode = new Map(defs.map((d) => [d.code, d.predecessorCode]));

  const txs = await commandDb.propertyTransaction.findMany({
    where: txWhere,
    select: {
      id: true,
      createdAt: true,
      tenure: true,
      purchaseType: true,
      _count: { select: { holdPeriods: true } },
      milestoneCompletions: {
        where: { state: "complete" },
        select: {
          completedAt: true,
          eventDate: true,
          reconciledAtClaim: true,
          milestoneDefinition: { select: { code: true } },
        },
      },
    },
  });

  // Accumulators
  const measureValues = new Map<string, number[]>();
  for (const m of MEASURES) measureValues.set(m.key, []);
  const perStepValues = new Map<string, number[]>();
  for (const d of defs) perStepValues.set(d.code, []);

  let totalSales = 0;
  let usableSales = 0;

  for (const tx of txs) {
    if (!txInSegment(tx.tenure, tx.purchaseType, segment)) continue;
    if (excludeHeld && tx._count.holdPeriods > 0) continue;
    totalSales++;

    // Build code → completion map. effDate prefers the real event date.
    const byCode = new Map<string, CompletionLite>();
    for (const c of tx.milestoneCompletions) {
      const code = c.milestoneDefinition.code;
      const date = c.eventDate ?? c.completedAt;
      if (!date) continue;
      // Unknowable: reconciled at claim with no real date → its completedAt is
      // the claim day, so any gap touching it is meaningless. Mark unusable.
      const usable = !(c.reconciledAtClaim && !c.eventDate);
      byCode.set(code, { code, predecessorCode: predByCode.get(code) ?? null, date, usable, eventDate: c.eventDate });
    }

    const effStart = computeEffectiveStartDate(
      tx.createdAt,
      tx.milestoneCompletions.map((c) => ({ eventDate: c.eventDate, reconciledAtClaim: c.reconciledAtClaim })),
    );

    let contributed = false;

    // Resolve an anchor to a usable date.
    const resolveAnchor = (a: Anchor): Date | null => {
      if (a.kind === "start") return effStart;
      for (const cd of a.codes) {
        const hit = byCode.get(cd);
        if (!hit || !hit.usable) continue;
        if (a.useEventDate) {
          if (!hit.eventDate) continue; // this measure needs the real event day
          return hit.eventDate;
        }
        return hit.date;
      }
      return null;
    };

    // Measures
    for (const m of MEASURES) {
      if (!measureAppliesToSegment(m.applies, segment)) continue;
      const from = resolveAnchor(m.from);
      if (!from) continue;
      let toDate: Date | null = null;
      for (const cd of m.to) {
        const hit = byCode.get(cd);
        if (hit && hit.usable) { toDate = hit.date; break; }
      }
      if (!toDate) continue;
      const days = Math.round((toDate.getTime() - from.getTime()) / DAY_MS);
      if (days < 0) continue;
      measureValues.get(m.key)!.push(days);
      contributed = true;
    }

    // Per-step grid — each confirmed step vs its direct predecessor (or the
    // sale start when it has none). Mirrors how MILESTONE_DURATION_MEDIANS is
    // defined (per step, since predecessor).
    for (const [cd, hit] of byCode) {
      if (!hit.usable) continue;
      const pred = hit.predecessorCode;
      let fromDate: Date | null;
      if (!pred) fromDate = effStart;
      else {
        const p = byCode.get(pred);
        fromDate = p && p.usable ? p.date : null;
      }
      if (!fromDate) continue;
      const days = Math.round((hit.date.getTime() - fromDate.getTime()) / DAY_MS);
      if (days < 0) continue;
      perStepValues.get(cd)?.push(days);
    }

    if (contributed) usableSales++;
  }

  const toResult = (m: MeasureDef): MeasureResult => {
    const v = measureValues.get(m.key)!;
    const assumed = m.assumedOverride ?? assumedDays(m.assumedCodes);
    return { key: m.key, label: m.label, group: m.group, assumed, median: median(v), mean: mean(v), n: v.length };
  };

  const headline = MEASURES.filter((m) => m.headline).map(toResult);
  const groups = MEASURE_GROUPS.map((g) => ({
    group: g,
    measures: MEASURES.filter((m) => m.group === g && measureAppliesToSegment(m.applies, segment)).map(toResult),
  })).filter((g) => g.measures.length > 0);

  const perStep = defs
    .filter((d) => (MILESTONE_DURATION_MEDIANS[d.code] ?? null) !== null) // live steps only (retired ones aren't in the map)
    .map((d) => {
      const v = perStepValues.get(d.code) ?? [];
      return {
        code: d.code,
        name: d.name,
        side: d.side as "vendor" | "purchaser",
        assumed: MILESTONE_DURATION_MEDIANS[d.code] ?? null,
        median: median(v),
        mean: mean(v),
        n: v.length,
      };
    });

  return { segment, includeEstimated, excludeHeld, totalSales, usableSales, headline, groups, perStep };
}
