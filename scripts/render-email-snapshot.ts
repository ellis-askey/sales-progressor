// Render-all email snapshot tool — v2.
//
// Two output modes, both generated from the same Model B skeletons so
// they can't drift from the code:
//
//   1. Per-milestone snapshots — one file per authored milestone,
//      every recipient × shape × route × direction assembled and
//      rendered as inbox-ready text. Used for tight per-milestone
//      voice review (the seams check).
//
//   2. Per-shape journey docs — six files, one per tenure × funding
//      combination, each walking every milestone in journey order
//      showing the vendor + purchaser bodies that fire for that shape.
//      Suppressed milestones (auto-NR for the shape) are shown
//      explicitly as "No email — not applicable for this shape" so
//      the deliberate silence is visible. Bilateral milestones show
//      their route + direction variants inline. Not-yet-authored
//      milestones show as "[not yet authored — legacy copy in
//      portal-copy.ts]".
//
// Run:  npx ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true}' \
//         scripts/render-email-snapshot.ts
// Output:
//   docs/active/email-snapshots/{CODE}.md                — per-milestone
//   docs/active/email-snapshots/journey-{tenure}-{funding}.md  — per-shape

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  assembleEmail,
  interpolate,
  type FileShape,
  type ConfirmerRoute,
  type HandoffDirection,
  type RecipientEmailSkeleton,
  type AssembledEmail,
  type MilestoneSkeleton,
} from "../lib/email-assembler";
import { SKELETON_REGISTRY } from "../lib/email-skeletons/registry";
import {
  JOURNEY_ORDER,
  PHASE_HEADINGS,
  MILESTONE_LABELS,
  BILATERAL_HANDOFF_CODES,
  HANDOFF_DEFAULT_ACTOR,
  AGENT_ONLY_CONFIRM_CODES,
} from "../lib/email-skeletons/journey-order";
import { computeAutoNrCodes } from "../lib/milestone-auto-nr";

type Tenure = "freehold" | "leasehold";
type PurchaseType = "mortgage" | "cash_buyer" | "cash_from_proceeds";

const TENURES: Tenure[] = ["freehold", "leasehold"];
const PURCHASE_TYPES: PurchaseType[] = ["mortgage", "cash_buyer", "cash_from_proceeds"];
const ROUTES: ConfirmerRoute[] = ["client_portal", "agent", "sales_progressor"];

const SHAPE_LABELS: Record<Tenure, string> = {
  freehold: "Freehold",
  leasehold: "Leasehold",
};
const FUNDING_LABELS: Record<PurchaseType, string> = {
  mortgage: "Mortgage",
  cash_buyer: "Cash buyer",
  cash_from_proceeds: "Cash from proceeds",
};
const ROUTE_LABELS: Record<ConfirmerRoute, string> = {
  client_portal: "Buyer/seller via portal",
  agent: "Agent on behalf",
  sales_progressor: "Sales Progressor on behalf",
};

// PM6's physical/desktop sub-state is rendered as runtime placeholders
// rather than a fifth condition key — these defaults give a representative
// "physical valuation on a specific date" rendering for snapshot review.
// In production these are populated by the send path from the booking
// metadata; here they're stable sample values so the snapshots are
// reproducible.
const SNAPSHOT_VARS = {
  address: "22 Example Road, London SW1A 1AA",
  First: "Alex",
  eventDate: "Tuesday 3 June",
  eventDateClause: " for Tuesday 3 June",
  vendorVisitNote:
    "The surveyor will visit the property to carry out the inspection. They'll be in touch directly to arrange access if they haven't already — typically a 30 to 60 minute visit.",
  purchaserPhysicalNote:
    "This is a physical valuation, so the surveyor will visit the property in person. The seller's side will coordinate access directly with the surveyor.",
};

// ── Render primitives ─────────────────────────────────────────────────────

function renderEmail(assembled: AssembledEmail, vars: Record<string, string>): string {
  const subject = interpolate(assembled.subject, vars);
  const opening = interpolate(assembled.opening, vars);
  const whatHappened = interpolate(assembled.whatHappened, vars);
  const whatNext = interpolate(assembled.whatNext, vars);
  const action = interpolate(assembled.action, vars);

  const lines: string[] = [];
  lines.push(`**Subject:** ${subject}`);
  lines.push("");
  lines.push("```");
  lines.push(`Hi ${vars.First},`);
  lines.push("");
  lines.push(opening);
  if (whatHappened) { lines.push(""); lines.push(whatHappened); }
  if (whatNext)     { lines.push(""); lines.push(whatNext); }
  lines.push("");
  lines.push(`→ ${action}`);
  lines.push("```");
  return lines.join("\n");
}

// Returns the suppression reason for a code on a given shape, or null
// if not suppressed.
function suppressionReason(code: string, shape: FileShape): string | null {
  const autoNr = computeAutoNrCodes(shape.purchaseType, shape.tenure);
  if (!autoNr.has(code)) return null;

  // Find the reason — derived from which set the code is in.
  if (shape.tenure === "freehold" && (code === "VM8" || code === "VM9" || code === "PM12")) {
    return "not applicable on freehold properties (no management pack required)";
  }
  if (shape.purchaseType === "cash_buyer" && (code === "PM5" || code === "PM6" || code === "PM11")) {
    return "not applicable for cash buyers (no mortgage)";
  }
  if (shape.purchaseType === "cash_from_proceeds") {
    if (code === "PM5" || code === "PM6" || code === "PM11") {
      return "not applicable for cash-from-proceeds buyers (no mortgage)";
    }
    if (code === "PM24") {
      return "not applicable for cash-from-proceeds buyers (deposit comes from the concurrent sale's equity, not a fresh transfer)";
    }
  }
  return "not applicable for this shape";
}

// ── Per-milestone snapshot block builders ─────────────────────────────────

function renderActedSideBlock(
  recipientLabel: string,
  skeleton: RecipientEmailSkeleton,
  // For non-bilateral milestones, route is irrelevant — pass undefined to
  // collapse to one body per shape (6 instead of 18).
  iterateRoutes: boolean,
): string[] {
  const out: string[] = [];
  if (iterateRoutes) {
    out.push(`## ${recipientLabel} — acted-side acknowledgement`);
    out.push("");
    out.push("Varies by **direction × route × tenure × purchaseType** (2 × 3 × 2 × 3 = 36 bodies). Natural-order copy fires when this code confirms first in its pair; inverse-order copy fires when the counterpart confirmed first.");
    out.push("");
    const DIRECTIONS: HandoffDirection[] = ["default", "inverse"];
    const DIR_LABELS: Record<HandoffDirection, string> = {
      default: "Natural order (this code confirmed first)",
      inverse: "Inverse order (counterpart confirmed first)",
    };
    for (const direction of DIRECTIONS) {
      out.push(`### Direction: ${DIR_LABELS[direction]} (\`${direction}\`)`);
      out.push("");
      for (const route of ROUTES) {
        out.push(`#### Route: ${ROUTE_LABELS[route]} (\`${route}\`)`);
        out.push("");
        for (const tenure of TENURES) {
          for (const pt of PURCHASE_TYPES) {
            const shape: FileShape = { tenure, purchaseType: pt, route, direction };
            const assembled = assembleEmail(skeleton, shape);
            out.push(`##### ${SHAPE_LABELS[tenure]} × ${FUNDING_LABELS[pt]}`);
            out.push("");
            out.push(renderEmail(assembled, SNAPSHOT_VARS));
            out.push("");
          }
        }
      }
    }
  } else {
    out.push(`## ${recipientLabel} — confirmation email`);
    out.push("");
    out.push("Varies by **tenure × purchaseType** (2 × 3 = 6 bodies). No route conditioning — this milestone is not bilateral.");
    out.push("");
    for (const tenure of TENURES) {
      for (const pt of PURCHASE_TYPES) {
        const shape: FileShape = { tenure, purchaseType: pt };
        const assembled = assembleEmail(skeleton, shape);
        out.push(`### ${SHAPE_LABELS[tenure]} × ${FUNDING_LABELS[pt]}`);
        out.push("");
        out.push(renderEmail(assembled, SNAPSHOT_VARS));
        out.push("");
      }
    }
  }
  return out;
}

function renderHandoffBlock(
  recipientLabel: string,
  skeleton: RecipientEmailSkeleton,
  direction: HandoffDirection,
): string[] {
  const out: string[] = [];
  const dirLabel = direction === "default"
    ? "Default direction (natural first-actor confirmed first)"
    : "Inverse direction (counterpart confirmed first — late hand-off)";
  out.push(`## ${recipientLabel} — hand-off nudge (${dirLabel})`);
  out.push("");
  out.push("Direction-stable, varies by **tenure × purchaseType** (2 × 3 = 6 bodies).");
  out.push("");
  for (const tenure of TENURES) {
    for (const pt of PURCHASE_TYPES) {
      const shape: FileShape = { tenure, purchaseType: pt, direction };
      const assembled = assembleEmail(skeleton, shape);
      out.push(`### ${SHAPE_LABELS[tenure]} × ${FUNDING_LABELS[pt]}`);
      out.push("");
      out.push(renderEmail(assembled, SNAPSHOT_VARS));
      out.push("");
    }
  }
  return out;
}

function renderInternalBlock(recipientLabel: string, skeleton: RecipientEmailSkeleton): string[] {
  const out: string[] = [];
  out.push(`## ${recipientLabel} — internal log (shape-stable)`);
  out.push("");
  const shape: FileShape = { tenure: "freehold", purchaseType: "mortgage" };
  const assembled = assembleEmail(skeleton, shape);
  out.push(renderEmail(assembled, SNAPSHOT_VARS));
  out.push("");
  return out;
}

// Per-CODE acted-side: derived from code prefix. VM* codes are seller-
// side events (vendor acts); PM* codes are buyer-side events (purchaser
// acts). Independent of the pair's "natural first-actor" — that's a
// pair-level concept used only to determine hand-off direction.
function actedSideForCode(code: string): "vendor" | "purchaser" {
  return code.startsWith("V") ? "vendor" : "purchaser";
}

// True if THIS code is its pair's natural first-actor — i.e. the code
// that, when confirmed, kicks off the default-direction hand-off to the
// opposite side. The OTHER code in the pair is the second-actor; if its
// confirmation fires first (the edge case), the opposite-side gets the
// inverse-direction hand-off.
function isNaturalFirstActorCode(code: string): boolean {
  const pairFirstActor = HANDOFF_DEFAULT_ACTOR[code];
  if (!pairFirstActor) return false;
  return actedSideForCode(code) === pairFirstActor;
}

function renderMilestoneSnapshot(code: string, label: string, ms: MilestoneSkeleton): string {
  const isBilateral = BILATERAL_HANDOFF_CODES.has(code);
  const actedSide = actedSideForCode(code);
  const isFirstActor = isNaturalFirstActorCode(code);
  // For the opposite-side recipient on a bilateral code:
  //   - if THIS code is the natural first-actor → default-direction hand-off
  //   - if THIS code is the second-actor → inverse-direction hand-off (edge case)
  const oppositeDirection: HandoffDirection = isFirstActor ? "default" : "inverse";

  const out: string[] = [];
  out.push(`# ${code} — ${label}`);
  out.push("");
  out.push(`Generated from \`lib/email-skeletons/${code.toLowerCase()}.ts\` by \`scripts/render-email-snapshot.ts\`. Every recipient × shape (× route × direction for bilateral) combination assembled and rendered as it would land in the inbox.`);
  out.push("");
  out.push("---");
  out.push("");

  if (ms.purchaser) {
    if (isBilateral && actedSide === "purchaser") {
      // Purchaser is the acted-side — route variants
      out.push(...renderActedSideBlock("Purchaser", ms.purchaser, true));
    } else if (isBilateral) {
      // Purchaser is the opposite-side — hand-off in the relevant direction
      out.push(...renderHandoffBlock("Purchaser", ms.purchaser, oppositeDirection));
    } else {
      // Non-bilateral — 6 shape variants, no routes
      out.push(...renderActedSideBlock("Purchaser", ms.purchaser, false));
    }
    out.push("---");
    out.push("");
  }

  if (ms.vendor) {
    if (isBilateral && actedSide === "vendor") {
      // Vendor is the acted-side — route variants
      out.push(...renderActedSideBlock("Vendor", ms.vendor, true));
    } else if (isBilateral) {
      // Vendor is the opposite-side — hand-off in the relevant direction
      out.push(...renderHandoffBlock("Vendor", ms.vendor, oppositeDirection));
    } else {
      // Non-bilateral
      out.push(...renderActedSideBlock("Vendor", ms.vendor, false));
    }
    out.push("---");
    out.push("");
  }

  if (ms.vendorAgent) {
    out.push(...renderInternalBlock("Vendor Agent", ms.vendorAgent));
    out.push("---");
    out.push("");
  }

  if (ms.progressor) {
    out.push(...renderInternalBlock("Progressor", ms.progressor));
    out.push("---");
    out.push("");
  }

  return out.join("\n");
}

// ── Per-shape journey doc builder ─────────────────────────────────────────

function renderRecipientForJourney(
  code: string,
  recipientLabel: "Vendor" | "Purchaser",
  skeleton: RecipientEmailSkeleton,
  shape: FileShape,
  isBilateral: boolean,
  isActedSide: boolean,
  isFirstActorCode: boolean,
): string[] {
  const out: string[] = [];

  if (isBilateral && isActedSide) {
    // Acted-side: route variants always fire for this code's confirmation.
    out.push(`**${recipientLabel} — acted-side, varies by confirm route:**`);
    out.push("");
    for (const route of ROUTES) {
      const localShape: FileShape = { ...shape, route };
      const assembled = assembleEmail(skeleton, localShape);
      out.push(`*Route: ${ROUTE_LABELS[route]}*`);
      out.push("");
      out.push(renderEmail(assembled, SNAPSHOT_VARS));
      out.push("");
    }
  } else if (isBilateral && !isActedSide) {
    // Opposite-side. Whether an email fires in the default-order journey
    // depends on whether THIS code is its pair's natural first-actor:
    //   - First-actor code: opposite-side gets the default-direction
    //     hand-off nudge NOW.
    //   - Second-actor code: the hand-off already fired earlier in this
    //     journey (on the first-actor code's confirmation). Render
    //     silence note instead of an email — the inverse-direction
    //     variant the skeleton may define is the edge case where the
    //     second-actor confirms first, which doesn't apply in default
    //     journey order.
    if (isFirstActorCode) {
      out.push(`**${recipientLabel} — hand-off nudge (default direction):**`);
      out.push("");
      const localShape: FileShape = { ...shape, direction: "default" };
      const assembled = assembleEmail(skeleton, localShape);
      out.push(renderEmail(assembled, SNAPSHOT_VARS));
      out.push("");
    } else {
      out.push(`> ℹ️ **No email to ${recipientLabel}** on this code in the default journey order. The hand-off nudge to the ${recipientLabel.toLowerCase()} side already fired earlier when the pair's natural first-actor code was confirmed. The skeleton defines an inverse-direction variant for the edge case where this code confirms BEFORE its counterpart — see the per-milestone snapshot for that body.`);
      out.push("");
    }
  } else {
    // Non-bilateral — single body, no route or direction conditioning.
    out.push(`**${recipientLabel}:**`);
    out.push("");
    const assembled = assembleEmail(skeleton, shape);
    out.push(renderEmail(assembled, SNAPSHOT_VARS));
    out.push("");
  }

  return out;
}

function renderJourneyDoc(tenure: Tenure, purchaseType: PurchaseType): string {
  const shape: FileShape = { tenure, purchaseType };
  const out: string[] = [];

  out.push(`# Journey: ${SHAPE_LABELS[tenure]} × ${FUNDING_LABELS[purchaseType]}`);
  out.push("");
  out.push(`Generated by \`scripts/render-email-snapshot.ts\` from the live Model B skeletons in \`lib/email-skeletons/\`. Every milestone in the transaction journey shown in order, with the **vendor and purchaser** emails that actually fire on this shape — assembled, interpolated, ready to land in an inbox.`);
  out.push("");
  out.push("Suppressed milestones (auto-NR'd for this shape) are shown **explicitly** as no-email entries, so the deliberate silence is visible. Bilateral milestones show their route variants inline. Internal-recipient emails (vendorAgent, progressor) are excluded — this doc tracks **client-facing** email only.");
  out.push("");
  out.push(`Authored so far: ${Object.keys(SKELETON_REGISTRY).length} / ${JOURNEY_ORDER.length} milestones. Unauthored milestones show as placeholders.`);
  out.push("");
  out.push("---");
  out.push("");

  for (const code of JOURNEY_ORDER) {
    const label = MILESTONE_LABELS[code] ?? code;

    // Phase heading
    if (PHASE_HEADINGS[code]) {
      out.push(`## ${PHASE_HEADINGS[code]}`);
      out.push("");
    }

    out.push(`### ${code} — ${label}`);
    out.push("");

    // Suppression check
    const suppression = suppressionReason(code, shape);
    if (suppression) {
      out.push(`> 🚫 **No email — ${suppression}.** This milestone is auto-marked Not Required at file creation for this shape. No client-facing email fires on this file.`);
      out.push("");
      continue;
    }

    // Agent-only confirm note
    if (AGENT_ONLY_CONFIRM_CODES.has(code)) {
      out.push(`> ℹ️ Agent-only confirm: clients can't trigger this milestone via portal. An agent or Sales Progressor confirms it, which then fires the client-facing emails below.`);
      out.push("");
    }

    // Skeleton lookup
    const ms = SKELETON_REGISTRY[code];
    if (!ms) {
      out.push(`> 📝 **Not yet authored** — this milestone still uses the legacy flat-string copy in \`lib/portal-copy.ts\`. Will be rendered here once the Model B skeleton is added to \`lib/email-skeletons/${code.toLowerCase()}.ts\`.`);
      out.push("");
      continue;
    }

    // Render client-facing variants (vendor + purchaser only)
    const isBilateral = BILATERAL_HANDOFF_CODES.has(code);
    const codeActedSide = actedSideForCode(code);
    const isFirstActor = isNaturalFirstActorCode(code);

    if (ms.vendor) {
      const vendorIsActedSide = codeActedSide === "vendor";
      out.push(...renderRecipientForJourney(code, "Vendor", ms.vendor, shape, isBilateral, vendorIsActedSide, isFirstActor));
    } else {
      out.push(`*Vendor: no email defined for this milestone (asymmetric variant set).*`);
      out.push("");
    }

    if (ms.purchaser) {
      const purchaserIsActedSide = codeActedSide === "purchaser";
      out.push(...renderRecipientForJourney(code, "Purchaser", ms.purchaser, shape, isBilateral, purchaserIsActedSide, isFirstActor));
    } else {
      out.push(`*Purchaser: no email defined for this milestone (asymmetric variant set).*`);
      out.push("");
    }

    out.push("---");
    out.push("");
  }

  return out.join("\n");
}

// ── Run ───────────────────────────────────────────────────────────────────

const SNAPSHOT_DIR = resolve(process.cwd(), "docs/active/email-snapshots");
mkdirSync(SNAPSHOT_DIR, { recursive: true });

// Per-milestone snapshots
let perMilestoneCount = 0;
for (const [code, ms] of Object.entries(SKELETON_REGISTRY)) {
  const label = MILESTONE_LABELS[code] ?? code;
  const body = renderMilestoneSnapshot(code, label, ms);
  const path = resolve(SNAPSHOT_DIR, `${code}.md`);
  writeFileSync(path, body);
  perMilestoneCount++;
}
console.log(`Wrote ${perMilestoneCount} per-milestone snapshot${perMilestoneCount === 1 ? "" : "s"} to ${SNAPSHOT_DIR}`);

// Per-shape journey docs
let journeyCount = 0;
for (const tenure of TENURES) {
  for (const pt of PURCHASE_TYPES) {
    const body = renderJourneyDoc(tenure, pt);
    const path = resolve(SNAPSHOT_DIR, `journey-${tenure}-${pt}.md`);
    writeFileSync(path, body);
    journeyCount++;
  }
}
console.log(`Wrote ${journeyCount} per-shape journey docs to ${SNAPSHOT_DIR}`);
