// Audit every prod-live portal tip against the customer's actual
// milestone state. For each active/completed file, for both sides,
// list every tip currently visible (post-stage + post-per-tip filter)
// and flag any tip whose copy is contradicted by the milestone data
// (i.e. it talks about a future event the customer has already passed,
// OR a precondition the customer hasn't met).
//
// Read-only. Used to verify the 2026-06-19 fix + identify any tips
// that still need tighter gating.
import { PrismaClient } from "@prisma/client";
import { detectStage, filterTipsForMilestones } from "@/lib/portal-tips";
const p = new PrismaClient();

// Reproduce the TIPS table here (read-only mirror — only ever read,
// never written). Audit operates against the raw pool, not the picked-3,
// so we see every tip that *could* render.
import type { PortalRole, PortalStage } from "@/lib/portal-tips";

// Audit-specific contract checks. Each entry says: "if this tip text
// matches a pool entry AND the listed code is complete on a given file,
// the tip is lying about a future event that has already happened."
// Intentionally STRICTER than the hideOnceDone rules currently shipped
// so we can spot tips that should be tightened.
const STRICT_HIDES: Array<{ match: RegExp; expectGone: string[]; reason: string }> = [
  // Onboarding
  { match: /welcome pack and questionnaire/i, expectGone: ["VM3", "PM3"], reason: "welcome pack already received" },
  { match: /ID verification is a legal requirement/i, expectGone: ["VM4", "PM3"], reason: "ID already verified" },
  { match: /Start gathering documents you may need/i, expectGone: ["VM6"], reason: "property info forms already returned (docs gathered)" },
  { match: /Check your mortgage agreement in principle/i, expectGone: ["PM5"], reason: "mortgage already submitted" },
  // Early
  { match: /management pack has been requested/i, expectGone: ["VM9"], reason: "management pack already received" },
  { match: /Searches are ordered by your solicitor/i, expectGone: ["PM13"], reason: "search results already received" },
  { match: /mortgage lender will book a valuation/i, expectGone: ["PM6", "PM11"], reason: "lender valuation already booked or mortgage offer already received" },
  { match: /Consider booking an independent survey/i, expectGone: ["PM9"], reason: "survey already booked" },
  // Active
  { match: /Once search results arrive, your solicitor will review/i, expectGone: ["PM13"], reason: "results already received" },
  { match: /mortgage offer should follow the lender's valuation/i, expectGone: ["PM11"], reason: "mortgage offer already received" },
  // Pre-exchange
  { match: /Your solicitor will send you the contract to sign/i, expectGone: ["VM16"], reason: "contract already sent to seller" },
  { match: /Transfer your deposit to your solicitor/i, expectGone: ["PM24"], reason: "deposit already transferred" },
  // Exchanged
  { match: /Leave manuals, warranties, and service records/i, expectGone: ["VM20"], reason: "sale already completed" },
  { match: /booked your removal firm, now's the time/i, expectGone: ["PM27"], reason: "sale already completed" },
  { match: /Start redirecting important post/i, expectGone: ["PM27"], reason: "sale already completed" },
];

const STRICT_REQUIRES: Array<{ match: RegExp; needs: string[]; reason: string }> = [
  { match: /management pack has been requested/i, needs: ["VM8"], reason: "claims it has been requested but VM8 not done" },
  { match: /Searches are ordered by your solicitor/i, needs: ["PM8"], reason: "claims they are ordered but PM8 not done" },
  { match: /mortgage lender will book a valuation/i, needs: ["PM5"], reason: "anticipates lender behaviour but mortgage not submitted" },
  { match: /Once search results arrive, your solicitor will review/i, needs: ["PM8"], reason: "anticipates result arrival but searches not ordered" },
  { match: /mortgage offer should follow the lender's valuation/i, needs: ["PM6"], reason: "premise is the valuation has been booked" },
];

// Pull tips currently in the file via the module. We don't have direct
// export of TIPS; reproduce via getStageTips with all-empty filter to
// see the raw pool. Actually getStageTips picks 3; we need the full
// pool. Replicate the structure here by reading directly via filter
// on an empty milestone set.
function rawPoolFor(stage: PortalStage, side: PortalRole): { text: string }[] {
  // Use filterTipsForMilestones with empty Set → returns the full pool
  // as TipDef[]. We strip to text-only for matching.
  const pool: { text: string }[] = [];
  // Workaround: there's no exported TIPS, but filterTipsForMilestones
  // is exported. We pass an inline reconstruction... actually no.
  // Easier: just import via require. Skip — instead, render all stages
  // for the side by exhausting picker rotation, which we already do
  // in the unit test.
  // Cleaner approach: walk all tokens until pool is observed full.
  const seen = new Map<string, true>();
  for (const t of ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p"]) {
    // Stub: call detectStage with a milestone list that forces `stage`,
    // then getStageTips. detectStage maps codes → stage, so we need a
    // canonical "pick stage" trick. Instead, just import getStageTips
    // and pass empty milestones (forces onboarding). For higher stages,
    // we'd need the matching code. Build a code-stuffing helper:
    const milestones = stageFloorMilestones(stage, side);
    const doneCodes = new Set(milestones.filter((m) => m.isComplete).map((m) => m.code));
    const { getStageTips: gst } = require("@/lib/portal-tips");
    const tips = gst(stage, side, t, doneCodes);
    for (const tip of tips) seen.set(tip.text, true);
  }
  for (const text of seen.keys()) pool.push({ text });
  return pool;
}

// Return the minimum milestones to force detectStage into a given stage
// for a given side, without unintentionally triggering any per-tip hide.
function stageFloorMilestones(stage: PortalStage, side: PortalRole): { code: string; isComplete: boolean }[] {
  const codes: string[] = [];
  if (stage === "completed") codes.push(side === "vendor" ? "VM20" : "PM27");
  else if (stage === "exchanged") codes.push(side === "vendor" ? "VM19" : "PM26");
  else if (stage === "pre_exchange") codes.push(side === "vendor" ? "VM18" : "PM25");
  else if (stage === "active") codes.push(side === "vendor" ? "VM10" : "PM14");
  else if (stage === "early") codes.push(side === "vendor" ? "VM1" : "PM1");
  // onboarding: no codes
  return codes.map((c) => ({ code: c, isComplete: true }));
}

async function main() {
  const txs = await p.propertyTransaction.findMany({
    where: { status: { in: ["active", "completed"] } },
    select: { id: true, propertyAddress: true, status: true, activeBuyerRoundId: true },
    orderBy: { propertyAddress: "asc" },
  });
  const defs = await p.milestoneDefinition.findMany({ select: { id: true, code: true } });
  const codeById = new Map(defs.map((d) => [d.id, d.code]));

  type Lie = { tx: string; side: PortalRole; stage: string; tipText: string; reason: string; doneCodes: string[] };
  const lies: Lie[] = [];

  for (const tx of txs) {
    const comps = await p.milestoneCompletion.findMany({
      where: {
        transactionId: tx.id,
        state: "complete",
        OR: [{ buyerRoundId: null }, { buyerRoundId: tx.activeBuyerRoundId }],
      },
      select: { milestoneDefinitionId: true },
    });
    const doneCodes = new Set(comps.map((c) => codeById.get(c.milestoneDefinitionId)!).filter(Boolean));
    const doneList = [...doneCodes].sort();

    for (const side of ["vendor", "purchaser"] as PortalRole[]) {
      const ms = [...doneCodes].map((code) => ({ code, isComplete: true }));
      const stage = detectStage(ms, side);
      if (stage === "completed") continue;

      // Render the full pool the customer could see.
      const { getStageTips: gst } = require("@/lib/portal-tips") as typeof import("@/lib/portal-tips");
      const visibleTips = new Set<string>();
      for (const tok of ["a","b","c","d","e","f","g","h"]) {
        for (const tip of gst(stage, side, tok, doneCodes)) visibleTips.add(tip.text);
      }

      for (const text of visibleTips) {
        for (const rule of STRICT_HIDES) {
          if (!rule.match.test(text)) continue;
          const violation = rule.expectGone.filter((c) => doneCodes.has(c));
          if (violation.length > 0) {
            lies.push({ tx: tx.propertyAddress, side, stage, tipText: text.slice(0, 90), reason: `${rule.reason} (done: ${violation.join(",")})`, doneCodes: doneList });
          }
        }
        for (const rule of STRICT_REQUIRES) {
          if (!rule.match.test(text)) continue;
          const missing = rule.needs.filter((c) => !doneCodes.has(c));
          if (missing.length > 0) {
            lies.push({ tx: tx.propertyAddress, side, stage, tipText: text.slice(0, 90), reason: `${rule.reason} (missing: ${missing.join(",")})`, doneCodes: doneList });
          }
        }
      }
    }
  }

  console.log(`Total files audited: ${txs.length}`);
  console.log(`Lies found: ${lies.length}\n`);

  // Group by reason for quick triage
  const byReason = new Map<string, Lie[]>();
  for (const l of lies) {
    const key = l.reason.split(" (")[0];
    const arr = byReason.get(key) ?? [];
    arr.push(l);
    byReason.set(key, arr);
  }
  for (const [reason, group] of byReason) {
    console.log(`\n## ${reason}  (${group.length} cases)`);
    for (const l of group.slice(0, 8)) {
      console.log(`  ${l.side.padEnd(9)} ${l.stage.padEnd(13)} ${l.tx}`);
      console.log(`    "${l.tipText}..."`);
      console.log(`    ${l.reason}`);
    }
    if (group.length > 8) console.log(`  ... and ${group.length - 8} more`);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
