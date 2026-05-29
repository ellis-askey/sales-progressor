// Coverage matrix audit for the milestone-confirmation flow.
//
// Mechanically introspects:
//   - SKELETON_REGISTRY (lib/email-skeletons/registry.ts) — which
//     (code × side) blocks the skeleton defines
//   - emailCopy in portal-copy.ts — which (code × side) legacy entries
//     remain
//   - computeAutoNrCodes (lib/milestone-auto-nr.ts) — which shapes each
//     code fires on
//   - BILATERAL_HANDOFF_CODES, AGENT_ONLY_CONFIRM_CODES, HANDOFF_DEFAULT_ACTOR
//     (lib/email-skeletons/journey-order.ts) — milestone classification
//
// Output: one row per milestone code with all of the above.
//
// Run:
//   npx ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true,"baseUrl":".","paths":{"@/*":["./*"]}}' --require tsconfig-paths/register scripts/audit-coverage-matrix.ts

import { SKELETON_REGISTRY } from "@/lib/email-skeletons/registry";
import {
  JOURNEY_ORDER,
  BILATERAL_HANDOFF_CODES,
  AGENT_ONLY_CONFIRM_CODES,
  HANDOFF_DEFAULT_ACTOR,
  MILESTONE_LABELS,
} from "@/lib/email-skeletons/journey-order";
import { getMilestoneCopy } from "@/lib/portal-copy";
const legacyCopyFor = (code: string) => getMilestoneCopy(code).emailCopy;
import { computeAutoNrCodes } from "@/lib/milestone-auto-nr";

type Tenure = "freehold" | "leasehold";
type PurchaseType = "cash_buyer" | "mortgage" | "cash_from_proceeds";

const ALL_SHAPES: Array<[Tenure, PurchaseType]> = [
  ["freehold", "cash_buyer"], ["freehold", "mortgage"], ["freehold", "cash_from_proceeds"],
  ["leasehold", "cash_buyer"], ["leasehold", "mortgage"], ["leasehold", "cash_from_proceeds"],
];

const SHAPE_KEYS = ["F/C", "F/M", "F/CFP", "L/C", "L/M", "L/CFP"];

function firesOnShapes(code: string): string[] {
  return ALL_SHAPES.map(([t, pt], i) => {
    const autoNr = computeAutoNrCodes(pt, t);
    return autoNr.has(code) ? "·" : SHAPE_KEYS[i];
  }).filter((k) => k !== "·");
}

function classify(code: string): string {
  if (AGENT_ONLY_CONFIRM_CODES.has(code)) return "agent-only";
  if (BILATERAL_HANDOFF_CODES.has(code)) {
    const pairFirst = HANDOFF_DEFAULT_ACTOR[code];
    const actedSide = code.startsWith("V") ? "vendor" : "purchaser";
    return pairFirst === actedSide ? "bilateral-first" : "bilateral-second";
  }
  return "unilateral";
}

function skeletonSides(code: string): string {
  const skel = SKELETON_REGISTRY[code];
  if (!skel) return "[NO SKELETON]";
  const sides: string[] = [];
  if (skel.vendor)       sides.push("V");
  if (skel.purchaser)    sides.push("P");
  if (skel.vendorAgent)  sides.push("A");
  if (skel.progressor)   sides.push("Pr");
  return sides.join("+") || "(none)";
}

function legacySides(code: string): string {
  const c = legacyCopyFor(code);
  if (!c) return "[NO LEGACY]";
  const sides: string[] = [];
  if (c.vendor)       sides.push("V");
  if (c.purchaser)    sides.push("P");
  if (c.vendorAgent)  sides.push("A");
  if (c.progressor)   sides.push("Pr");
  return sides.join("+") || "(none)";
}

// Print header
console.log("CODE  | Class             | Skeleton    | Legacy      | Fires on shapes               | Label");
console.log("------|-------------------|-------------|-------------|-------------------------------|---------------------------");

for (const code of JOURNEY_ORDER) {
  const cls   = classify(code).padEnd(17);
  const skel  = skeletonSides(code).padEnd(11);
  const leg   = legacySides(code).padEnd(11);
  const shapes = firesOnShapes(code).join(",").padEnd(29);
  const label = MILESTONE_LABELS[code] ?? "?";
  console.log(`${code.padEnd(5)} | ${cls} | ${skel} | ${leg} | ${shapes} | ${label}`);
}

// ── Mismatch checks ─────────────────────────────────────────────────────

console.log("\n\n=== MISMATCH CHECKS ===\n");

let issues = 0;

// Issue A: skeleton block present but missing legacy fallback (or vice versa)
//   - If skeleton defines a side and legacy doesn't, the fan-out works
//     correctly via the skeleton when EMAIL_SKELETON_MODE is on.
//   - If legacy defines a side and skeleton doesn't, the fallback fires —
//     this is INTENTIONAL for one-side-only codes after Job A, but worth
//     flagging if we expected the FINAL skeleton to take over.
// Per Job A: the six deleted codes (PM16/PM19/VM19/VM20/PM26/PM27)
// intentionally have a side missing in legacy. We should NOT see other
// codes where the skeleton has a side but legacy is the only entry.

console.log("[A] Skeleton blocks vs legacy parity (vendor/purchaser only)\n");

const POST_JOB_A_ONE_SIDED: Record<string, "vendor" | "purchaser"> = {
  // Code: the side that SHOULD be present (legacy + skeleton)
  PM16: "purchaser",
  PM19: "purchaser",
  VM19: "vendor",
  VM20: "vendor",
  PM26: "purchaser",
  PM27: "purchaser",
};

for (const code of JOURNEY_ORDER) {
  if (POST_JOB_A_ONE_SIDED[code]) continue; // expected one-sided
  const skel = SKELETON_REGISTRY[code];
  const legacy = legacyCopyFor(code);
  for (const side of ["vendor", "purchaser"] as const) {
    const inSkel = !!skel?.[side];
    const inLegacy = !!legacy?.[side];
    // What WE want to flag: any case where skeleton has it but legacy doesn't,
    // OR legacy has it but skeleton doesn't (excluding the Job A intentional
    // deletes which are pre-filtered above).
    if (inSkel && !inLegacy) {
      console.log(`  ⚠️  ${code}.${side}: skeleton has block, legacy DOES NOT — Job A scope creep?`);
      issues++;
    }
    if (!inSkel && inLegacy) {
      console.log(`  ⚠️  ${code}.${side}: legacy has block, skeleton DOES NOT — relies on fallback`);
      issues++;
    }
  }
}

if (issues === 0) console.log("  ✓ all non-Job-A codes have skeleton + legacy parity for vendor/purchaser");

// Issue B: Confirm Job A's six are actually missing the right side in legacy
console.log("\n[B] Job A deletes: verifying legacy is missing the right side\n");
for (const [code, presentSide] of Object.entries(POST_JOB_A_ONE_SIDED)) {
  const otherSide = presentSide === "vendor" ? "purchaser" : "vendor";
  const legacy = legacyCopyFor(code);
  const presentInLegacy = !!legacy?.[presentSide];
  const otherInLegacy = !!legacy?.[otherSide];
  const tag = (presentInLegacy && !otherInLegacy) ? "✓" : "⚠️";
  console.log(`  ${tag} ${code}: legacy.${presentSide} present=${presentInLegacy}, legacy.${otherSide} present=${otherInLegacy}`);
  if (!(presentInLegacy && !otherInLegacy)) issues++;
}

// Issue C: Bilateral pair completeness — every bilateral code has its
// counterpart's hand-off block and vice versa
console.log("\n[C] Bilateral pair acted-side + hand-off coverage\n");

const BILATERAL_PAIRS: Array<[string, string]> = [
  ["VM7", "PM7"],
  ["PM14", "VM10"],
  ["VM12", "PM15"],
  ["PM17", "VM13"],
  ["VM15", "PM18"],
];

for (const [a, b] of BILATERAL_PAIRS) {
  const skelA = SKELETON_REGISTRY[a];
  const skelB = SKELETON_REGISTRY[b];
  const actedA = a.startsWith("V") ? "vendor" : "purchaser";
  const actedB = b.startsWith("V") ? "vendor" : "purchaser";
  const oppA = actedA === "vendor" ? "purchaser" : "vendor";
  const oppB = actedB === "vendor" ? "purchaser" : "vendor";

  const aActedOk = !!skelA?.[actedA];
  const aHandOffOk = !!skelA?.[oppA];
  const bActedOk = !!skelB?.[actedB];
  const bHandOffOk = !!skelB?.[oppB];

  const allOk = aActedOk && aHandOffOk && bActedOk && bHandOffOk;
  console.log(`  ${allOk ? "✓" : "⚠️"} ${a}/${b}: ${a}.acted(${actedA})=${aActedOk}, ${a}.handoff(${oppA})=${aHandOffOk}, ${b}.acted(${actedB})=${bActedOk}, ${b}.handoff(${oppB})=${bHandOffOk}`);
  if (!allOk) issues++;
}

console.log(`\n${issues === 0 ? "✓ ZERO mismatches" : `⚠️ ${issues} mismatches flagged`}`);
