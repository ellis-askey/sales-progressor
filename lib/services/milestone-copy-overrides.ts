// lib/services/milestone-copy-overrides.ts
//
// Resolves the effective milestone email copy for a given scenario, layering
// any saved Command Centre overrides on top of the code default in
// lib/portal-copy.ts. Precedence (most specific wins):
//   exact tenure + method  >  one axis specific  >  any/any  >  code default.
//
// Used by the live send paths (lib/services/portal.ts) and by the Command
// Centre matrix page for preview.

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
    const d = score(b) - score(a);
    if (d !== 0) return d;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
  return matching[0];
}

/** All override rows for a milestone code (both sides). */
export async function getOverridesForCode(code: string): Promise<OverrideRow[]> {
  return prisma.milestoneEmailOverride.findMany({
    where: { code },
    select: {
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
