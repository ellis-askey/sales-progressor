// Bilateral pair behaviour trace.
//
// For each of the 5 bilateral pairs + 2 agent-only auto-pairs, simulates
// the 4 event sequences and reports what fires to each recipient.
//
//   - bilateral pairs (suppression-eligible):
//       VM7/PM7, PM14/VM10, VM12/PM15, PM17/VM13, VM15/PM18
//   - agent-only auto-pairs (no suppression; both sides notified):
//       VM19/PM26, VM20/PM27

import {
  computeBilateralSuppressedRecipient,
  HANDOFF_DEFAULT_ACTOR,
  BILATERAL_PAIR_OF,
} from "@/lib/email-skeletons/journey-order";
import { SKELETON_REGISTRY } from "@/lib/email-skeletons/registry";

type HandoffDirection = "default" | "inverse";

// Mirror lib/services/portal.ts:computeHandoffDirection.
function computeHandoffDirection(
  code: string,
  counterpartComplete: boolean,
): HandoffDirection {
  const pairFirstActor = HANDOFF_DEFAULT_ACTOR[code];
  if (!pairFirstActor) {
    // For agent-only pairs not in HANDOFF_DEFAULT_ACTOR we still want a
    // synthetic direction for the trace; treat as "default".
    return "default";
  }
  const currentActedSide: "vendor" | "purchaser" =
    code.startsWith("V") ? "vendor" : "purchaser";
  const currentIsNaturalFirst = pairFirstActor === currentActedSide;
  if (currentIsNaturalFirst) return counterpartComplete ? "inverse" : "default";
  return counterpartComplete ? "default" : "inverse";
}

// For each (code, direction), introspect SKELETON_REGISTRY[code] to see
// which sections of vendor / purchaser would actually render. We don't
// need to assemble the full body — just whether each side would produce
// non-empty output. We approximate this by checking whether any subject
// section's `when` matches the shape.
function wouldFireForRecipient(
  code: string,
  recipient: "vendor" | "purchaser",
  direction: HandoffDirection,
): boolean {
  const skel = SKELETON_REGISTRY[code];
  const slot = skel?.[recipient];
  if (!slot) return false;
  // Subject = "is there a section that matches this direction (and
  // tenure=leasehold, purchaseType=cash_buyer as a representative shape)"
  // For the trace we use a "did anything pass with this direction" check.
  const shape = {
    tenure: "leasehold" as const,
    purchaseType: "cash_buyer" as const,
    route: "client_portal" as const,
    direction,
  };
  // Reuse the `matches` predicate via dynamic import to avoid pulling
  // assemble.ts (which has more deps) into this script.
  // Simple substitute: check if any subject section's when matches:
  for (const section of slot.subject) {
    if (!section.when) return true;
    const w = section.when;
    let ok = true;
    if (w.direction !== undefined && w.direction !== shape.direction) ok = false;
    if (w.route !== undefined) {
      const r = w.route;
      if (typeof r === "string") ok = ok && r === shape.route;
      else if ("in" in r) ok = ok && r.in.includes(shape.route);
    }
    if (w.tenure !== undefined) {
      const t = w.tenure;
      if (typeof t === "string") ok = ok && t === shape.tenure;
      else if ("in" in t) ok = ok && t.in.includes(shape.tenure);
      else if ("not" in t) ok = ok && t.not !== shape.tenure;
    }
    if (w.purchaseType !== undefined) {
      const p = w.purchaseType;
      if (typeof p === "string") ok = ok && p === shape.purchaseType;
      else if ("in" in p) ok = ok && p.in.includes(shape.purchaseType);
      else if ("not" in p) ok = ok && p.not !== shape.purchaseType;
    }
    if (ok) return true;
  }
  return false;
}

function simulatePair(codeA: string, codeB: string): void {
  console.log(`\n══════════════════════════════════════════════════════════════════════`);
  console.log(`PAIR: ${codeA} ↔ ${codeB}`);
  console.log(`Natural first-actor: ${HANDOFF_DEFAULT_ACTOR[codeA] ?? "(n/a — agent-only pair)"}`);
  console.log(`══════════════════════════════════════════════════════════════════════`);

  const scenarios: Array<{ first: string; second: string }> = [
    { first: codeA, second: codeB },
    { first: codeB, second: codeA },
  ];

  for (const { first, second } of scenarios) {
    const firstActedSide = first.startsWith("V") ? "vendor" : "purchaser";
    const secondActedSide = second.startsWith("V") ? "vendor" : "purchaser";

    // ─ Event 1: first confirmation
    const firstDir = computeHandoffDirection(first, false);
    const firstSuppressed = computeBilateralSuppressedRecipient(first, firstDir);

    console.log(`\n── ${first} confirmed (counterpart not complete)`);
    console.log(`   direction=${firstDir}, suppressedRecipient=${firstSuppressed ?? "none"}`);

    for (const side of ["vendor", "purchaser"] as const) {
      if (side === firstSuppressed) {
        console.log(`   - ${side.padEnd(9)}: SKIPPED (PR 2 suppression)`);
        continue;
      }
      const fires = wouldFireForRecipient(first, side, firstDir);
      const role = side === firstActedSide ? "acted-side" : "hand-off";
      console.log(`   - ${side.padEnd(9)}: ${fires ? "✓ fires" : "○ no copy"}  (${role})`);
    }

    // ─ Event 2: second confirmation completing the pair
    const secondDir = computeHandoffDirection(second, true);
    const secondSuppressed = computeBilateralSuppressedRecipient(second, secondDir);

    console.log(`── ${second} confirmed second (counterpart now complete)`);
    console.log(`   direction=${secondDir}, suppressedRecipient=${secondSuppressed ?? "none"}`);

    for (const side of ["vendor", "purchaser"] as const) {
      if (side === secondSuppressed) {
        console.log(`   - ${side.padEnd(9)}: SKIPPED (PR 2 suppression — already notified at ${first})`);
        continue;
      }
      const fires = wouldFireForRecipient(second, side, secondDir);
      const role = side === secondActedSide ? "acted-side" : "hand-off";
      console.log(`   - ${side.padEnd(9)}: ${fires ? "✓ fires" : "○ no copy"}  (${role})`);
    }
  }
}

const BILATERAL_PAIRS: Array<[string, string]> = [
  ["VM7", "PM7"],
  ["PM14", "VM10"],
  ["VM12", "PM15"],
  ["PM17", "VM13"],
  ["VM15", "PM18"],
];

const AGENT_ONLY_PAIRS: Array<[string, string]> = [
  ["VM19", "PM26"],
  ["VM20", "PM27"],
];

console.log("============================================================");
console.log("BILATERAL PAIRS (suppression-eligible)");
console.log("============================================================");
for (const [a, b] of BILATERAL_PAIRS) simulatePair(a, b);

console.log("\n\n============================================================");
console.log("AGENT-ONLY AUTO-PAIRS (no suppression; both sides notified)");
console.log("Note: these are NOT in BILATERAL_PAIR_OF — auto-counterpart is");
console.log("handled in app/actions/milestones.ts and lib/services/portal.ts,");
console.log("not by the suppression helper. Both codes fire to both sides.");
console.log("============================================================");
for (const [a, b] of AGENT_ONLY_PAIRS) simulatePair(a, b);

console.log("\n\n=== BILATERAL_PAIR_OF coverage check ===");
for (const code of [...BILATERAL_PAIRS.flat(), ...AGENT_ONLY_PAIRS.flat()]) {
  const inMap = BILATERAL_PAIR_OF[code];
  console.log(`  ${code}: BILATERAL_PAIR_OF=${inMap ?? "(not in map)"}`);
}
