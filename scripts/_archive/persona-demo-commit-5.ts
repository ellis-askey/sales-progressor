// Commit 5 — persona demonstrations against the two-round staging fixture.
//
// Reads the sentinel-tagged file seeded by scripts/seed-two-round-fixture.ts
// and exercises every portal read path with the three persona tokens, so
// the round-scoping invariant is demonstrated end-to-end (not asserted).
//
// Run with: npx ts-node --require tsconfig-paths/register scripts/persona-demo-commit-5.ts
// (The repo uses the same harness pattern as scripts/seed-two-round-fixture.ts.)

// React.cache polyfill — see scripts/parity-harness-mc-reads.ts for context.
// Production imports transitively touch lib/agent-session.ts which uses
// react.cache; in this Node script we patch it to identity.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require("react");
React.cache = (fn: unknown) => fn;

import {
  getPortalData,
  getPortalMilestones,
  getPortalTimeline,
  getPortalUpdates,
  portalOwnSideScope,
  portalOtherSideScope,
} from "../lib/services/portal";

const TOKENS = {
  old:    "e26e281a-f86f-4fd7-8039-a6e5624b2551",
  new:    "3e8a301d-86ae-41e6-b1a5-bba363274897",
  vendor: "ec5130bb-62e3-46f7-9666-5120b35a484b",
};

function header(label: string) {
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(`  ${label}`);
  console.log("══════════════════════════════════════════════════════════════════════");
}

async function persona(label: string, token: string) {
  header(label);
  const result = await getPortalData(token);

  if (result === null) {
    console.log("getPortalData → null  (token not found)");
    return;
  }
  if (result.kind === "deadRound") {
    console.log("getPortalData → kind: \"deadRound\"");
    console.log("  contactName: ", result.contactName);
    console.log("  agencyName:  ", result.agencyName);
    console.log("  address:     ", result.address);
    console.log("\n(The portal layout renders DeadRoundNotice and short-circuits");
    console.log(" all downstream reads. Demonstrating skip for the rest.)");
    return;
  }

  const { contact, transaction } = result.data;
  console.log("getPortalData → kind: \"ok\"");
  console.log("  contact.id:        ", contact.id);
  console.log("  contact.name:      ", contact.name);
  console.log("  contact.roleType:  ", contact.roleType);
  console.log("  contact.buyerRound:", contact.buyerRoundId ?? "(file-level)");
  console.log("  tx.activeBuyerRd:  ", transaction.activeBuyerRoundId ?? "(none)");

  const side      = contact.roleType === "vendor" ? "vendor" : "purchaser";
  const otherSide = side === "vendor" ? "purchaser" : "vendor";

  const own   = await getPortalMilestones(transaction.id, side,      portalOwnSideScope(contact, transaction));
  const other = await getPortalMilestones(transaction.id, otherSide, portalOtherSideScope(contact, transaction));

  const fmt = (m: { code: string; isComplete: boolean; isNotRequired: boolean; isAvailable: boolean }) => {
    const state = m.isComplete ? "complete" : m.isNotRequired ? "not_required" : m.isAvailable ? "available" : "locked";
    return `${m.code}=${state}`;
  };

  console.log("\ngetPortalMilestones (own side =", side + "):");
  console.log("  count:", own.length);
  console.log("  visible non-locked rows:", own.filter((m) => m.isComplete || m.isAvailable || m.isNotRequired).map(fmt).join(", ") || "(none)");

  console.log("\ngetPortalMilestones (other side =", otherSide + "):");
  console.log("  count:", other.length);
  console.log("  visible non-locked rows:", other.filter((m) => m.isComplete || m.isAvailable || m.isNotRequired).map(fmt).join(", ") || "(none)");

  const timeline = await getPortalTimeline(transaction.id, side, contact.id, {
    buyerRoundId: contact.buyerRoundId,
    activeBuyerRoundId: transaction.activeBuyerRoundId,
  });
  console.log("\ngetPortalTimeline:");
  console.log("  total entries:", timeline.length);
  const ms = timeline.filter((e) => e.type === "milestone");
  const up = timeline.filter((e) => e.type === "update");
  console.log("  milestone entries:", ms.length, ms.map((e: any) => `${e.side}:${e.label}`).slice(0, 8));
  console.log("  update entries:   ", up.length, up.map((e: any) => (e.content as string).slice(0, 60)).slice(0, 4));

  const updates = await getPortalUpdates(transaction.id, side, contact.id, { buyerRoundId: contact.buyerRoundId });
  console.log("\ngetPortalUpdates:");
  console.log("  count:", updates.length);
  for (const u of updates.slice(0, 4)) {
    console.log("    -", u.content.slice(0, 80));
  }
}

(async () => {
  await persona("PERSONA 1 — OLD PURCHASER (round 1, withdrawn)", TOKENS.old);
  await persona("PERSONA 2 — NEW PURCHASER (round 2, active)",    TOKENS.new);
  await persona("PERSONA 3 — VENDOR (file-level)",                 TOKENS.vendor);
  console.log("\n══════════════════════════════════════════════════════════════════════");
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
