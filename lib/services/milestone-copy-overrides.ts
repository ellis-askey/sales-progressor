// lib/services/milestone-copy-overrides.ts
//
// Resolves the effective milestone email copy for a given scenario, layering
// any saved overrides on top of the code default in lib/portal-copy.ts.
//
// Two layers, resolved agency-first:
//   1. the agency's own override rows (agencyId = the file's agency), then
//   2. the Sales Progressor default rows (agencyId = null),
// and within each layer the most-specific scenario wins:
//   exact tenure + method  >  one axis specific  >  any/any  >  code default.
// An agency row (at ANY specificity) beats a default row — if an agency has
// customised a milestone, their wording ships even where our default has a
// more tenure-specific variant.
//
// Used by the live send paths (lib/services/portal.ts, which passes the file's
// agencyId) and by the Command Centre matrix (which edits the null-agency
// default layer, so it calls with no agencyId).

import "server-only";
import type { PurchaseType, Tenure } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMilestoneCopy } from "@/lib/portal-copy";
import type { RecipientEmailCopy, MilestoneEmailCopy } from "@/lib/portal-copy";

export type CopySide = "vendor" | "purchaser" | "vendorAgent" | "progressor";
export type ScenarioTenure = "freehold" | "leasehold" | null;
export type ScenarioMethod = "mortgage" | "cash" | null;
export type Scenario = { tenure: ScenarioTenure; method: ScenarioMethod };

/** Maps the DB PurchaseType enum onto the two-way scenario axis. */
export function normalizeMethod(pt: PurchaseType | null | undefined): ScenarioMethod {
  if (!pt) return null;
  return pt === "mortgage" ? "mortgage" : "cash";
}

export function normalizeTenure(t: Tenure | null | undefined): ScenarioTenure {
  return t ?? null;
}

type OverrideRow = {
  agencyId: string | null;
  side: string;
  tenure: string;
  purchaseType: string;
  subject: string;
  heroLabel: string;
  opening: string;
  whatHappened: string;
  whatNext: string | null;
  action: string | null;
  updatedAt: Date;
};

function axisMatch(overrideVal: string, scenarioVal: string | null): boolean {
  if (overrideVal === "any") return true;
  if (scenarioVal == null) return false;
  return overrideVal === scenarioVal;
}

function score(row: OverrideRow): number {
  let s = 0;
  if (row.tenure !== "any") s += 2;
  if (row.purchaseType !== "any") s += 1;
  return s;
}

function toCopy(row: OverrideRow): RecipientEmailCopy {
  return {
    subject: row.subject,
    heroLabel: row.heroLabel,
    opening: row.opening,
    whatHappened: row.whatHappened,
    whatNext: row.whatNext,
    action: row.action,
  };
}

/** Picks the most-specific override row matching the scenario for one side. */
function pickBest(rows: OverrideRow[], side: CopySide, scenario: Scenario): OverrideRow | null {
  const matching = rows.filter(
    (r) =>
      r.side === side &&
      axisMatch(r.tenure, scenario.tenure) &&
      axisMatch(r.purchaseType, scenario.method)
  );
  if (matching.length === 0) return null;
  matching.sort((a, b) => {
    // Agency layer beats the SP-default layer, regardless of scenario specificity.
    const agencyDelta = (b.agencyId ? 1 : 0) - (a.agencyId ? 1 : 0);
    if (agencyDelta !== 0) return agencyDelta;
    const d = score(b) - score(a);
    if (d !== 0) return d;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
  return matching[0];
}

/**
 * Override rows for a milestone code (both sides).
 * - agencyId omitted/null → the Sales Progressor default layer only (used by the
 *   Command Centre matrix, which edits the defaults).
 * - agencyId set → that agency's rows PLUS the default rows, so pickBest can
 *   resolve agency-first-then-default at send time.
 */
export async function getOverridesForCode(
  code: string,
  agencyId: string | null = null,
): Promise<OverrideRow[]> {
  return prisma.milestoneEmailOverride.findMany({
    where: agencyId
      ? { code, OR: [{ agencyId: null }, { agencyId }] }
      : { code, agencyId: null },
    select: {
      agencyId: true,
      side: true,
      tenure: true,
      purchaseType: true,
      subject: true,
      heroLabel: true,
      opening: true,
      whatHappened: true,
      whatNext: true,
      action: true,
      updatedAt: true,
    },
  });
}

/**
 * Returns a MilestoneEmailCopy where each side is the scenario's effective copy
 * (override if one matches, else the code default). Pass pre-fetched rows to
 * avoid a query when sending to several recipients of the same milestone.
 */
export function applyOverridesToEmailCopy(
  emailCopy: MilestoneEmailCopy,
  scenario: Scenario,
  rows: OverrideRow[]
): MilestoneEmailCopy {
  const sides: CopySide[] = ["vendor", "purchaser", "vendorAgent", "progressor"];
  const merged: MilestoneEmailCopy = { ...emailCopy };
  for (const side of sides) {
    const best = pickBest(rows, side, scenario);
    if (best) merged[side] = toCopy(best);
  }
  return merged;
}

/** Effective copy for one side+scenario (override if any, else code default). Used by the preview. */
export async function resolveEffectiveRecipientCopy(
  code: string,
  side: CopySide,
  scenario: Scenario
): Promise<RecipientEmailCopy | undefined> {
  const rows = await getOverridesForCode(code);
  const best = pickBest(rows, side, scenario);
  if (best) return toCopy(best);
  return getMilestoneCopy(code).emailCopy?.[side];
}

export type EffectiveDescription = {
  effective: RecipientEmailCopy | null; // resolved copy (override or default); null = no email to this side
  source: "default" | "override";
  matchedTenure?: string; // the scope the winning override was saved at
  matchedMethod?: string;
  base: RecipientEmailCopy | null; // the code default (for "reset"/compare)
};

/** Full description for the Command Centre matrix: what sends, and why. */
export async function describeEffective(
  code: string,
  side: CopySide,
  scenario: Scenario
): Promise<EffectiveDescription> {
  const rows = await getOverridesForCode(code);
  const base = getMilestoneCopy(code).emailCopy?.[side] ?? null;
  const best = pickBest(rows, side, scenario);
  if (best) {
    return {
      effective: toCopy(best),
      source: "override",
      matchedTenure: best.tenure,
      matchedMethod: best.purchaseType,
      base,
    };
  }
  return { effective: base, source: "default", base };
}

export type AgencyEffectiveDescription = {
  effective: RecipientEmailCopy | null; // agency > SP-default > code default; null = no email to this side
  source: "agency" | "sp_default" | "default";
  matchedTenure?: string; // scope of the winning AGENCY row (for reset), when source==="agency"
  matchedMethod?: string;
  resetBase: RecipientEmailCopy | null; // what "Reset to Sales Progressor" reverts to (SP default, else code default)
};

/**
 * Full description for the agency-facing Account editor: the copy that would
 * send for THIS agency, whether it's the agency's own version / our default /
 * the built-in default, and the copy a reset would revert to.
 */
export async function describeEffectiveForAgency(
  code: string,
  side: CopySide,
  scenario: Scenario,
  agencyId: string
): Promise<AgencyEffectiveDescription> {
  const rows = await getOverridesForCode(code, agencyId); // agency rows + SP-default (null) rows
  const codeDefault = getMilestoneCopy(code).emailCopy?.[side] ?? null;

  // Effective across both layers — pickBest ranks the agency layer first.
  const best = pickBest(rows, side, scenario);
  // What a reset reverts to: best of the SP-default (null) rows, else code default.
  const spBest = pickBest(rows.filter((r) => r.agencyId === null), side, scenario);
  const resetBase = spBest ? toCopy(spBest) : codeDefault;

  if (best && best.agencyId === agencyId) {
    return {
      effective: toCopy(best),
      source: "agency",
      matchedTenure: best.tenure,
      matchedMethod: best.purchaseType,
      resetBase,
    };
  }
  if (best) {
    return { effective: toCopy(best), source: "sp_default", resetBase };
  }
  return { effective: codeDefault, source: "default", resetBase };
}
