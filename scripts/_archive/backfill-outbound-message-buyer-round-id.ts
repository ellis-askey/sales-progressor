// Phase-2 PR 3 backfill: stamp OutboundMessage.buyerRoundId on historical
// rows whose write-path stamping never ran.
//
// Classification rule (Ellis-locked 2026-06-05, REFINED post-staging-review):
//   - A row "belongs to" a sale when at least one contact in contactIds[]
//     is a purchaser-role Contact AND all purchaser-role contacts on the
//     row share the same non-null buyerRoundId. Other-role co-recipients
//     (vendor / solicitor / broker) neither stamp nor block — the
//     purchaser's round attribution is unambiguous.
//   - Solicitor / vendor-only messages stay file-level (no purchaser
//     present → cannot be attributed to a single sale).
//   - createdAt-window inference is NOT used here. Attribution via the
//     contactIds → Contact relation is unambiguous; window matching would
//     break the "no guesses, list unmatched" invariant.
//
// This refinement mirrors the same change to decideBuyerSideStamp in
// lib/services/comms.ts — write path and backfill stay in lockstep.
//
// Unmatched buckets:
//   - no-contacts: contactIds is []  → file-level by design (system
//                  status-change notes, internal_notes with no
//                  attribution, etc.). Listed as such, not stamped.
//   - missing-contact: at least one id in contactIds doesn't resolve.
//                  Listed for manual review (suggests a deleted contact).
//   - mixed-roles: contactIds resolves to a mix of roleTypes. File-level
//                  by design; listed for transparency.
//   - mixed-rounds: all-purchaser but on different buyerRoundIds
//                  (shouldn't happen — flag for investigation).
//   - all-null-round: all-purchaser but none have a buyerRoundId.
//                  Section 2 Contact backfill should have caught these
//                  — flag for cross-check.
//
// Run order (per the Phase-2 per-PR template):
//   1. Staging dry-run.   tsx scripts/backfill-outbound-message-buyer-round-id.ts
//   2. Ellis approves the report.
//   3. Staging --apply.   tsx scripts/backfill-outbound-message-buyer-round-id.ts --apply
//   4. Re-run dry-run, confirm the matched set is empty (or only the
//      stable-design "unmatched by design" buckets remain).
//   5. Browser verification on Emily relist fixture.
//   6. Prod conversation.

import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type StampedRow = {
  msgId: string;
  type: string;
  contactIdsCount: number;
  stampedRoundId: string;
};

type UnmatchedRow = {
  msgId: string;
  type: string;
  contactIdsCount: number;
  reason:
    | "no-contacts"
    | "missing-contact"
    | "no-purchaser"   // no purchaser contacts at all (all-vendor, all-solicitor, etc.)
    | "mixed-roles"    // truly mixed: at least one purchaser + at least one other role
    | "mixed-rounds"
    | "all-null-round";
};

async function main() {
  const startedAt = new Date();
  const stamped: StampedRow[] = [];
  const unmatched: UnmatchedRow[] = [];

  // Candidates: every OutboundMessage with NULL buyerRoundId. The rule
  // discriminates which ones get stamped vs left file-level.
  const candidates = await prisma.outboundMessage.findMany({
    where: { buyerRoundId: null },
    select: { id: true, type: true, contactIds: true },
    orderBy: { createdAt: "asc" },
  });

  // Note: do NOT early-return on zero candidates — the report file is the
  // durable audit artifact and must be written even for "nothing to do"
  // runs. The empty-list branches in the report builder handle this.

  // Batch-load all contacts referenced across all candidate rows so we
  // don't hammer the DB with one query per row. ~50 candidate rows times
  // ~3 contacts each = ~150 unique contact ids in the worst pre-launch
  // case; well below an `in` clause's practical limit.
  const allContactIds = new Set<string>();
  for (const c of candidates) for (const id of c.contactIds) allContactIds.add(id);
  const contactsLookup = allContactIds.size > 0
    ? await prisma.contact.findMany({
        where: { id: { in: [...allContactIds] } },
        select: { id: true, roleType: true, buyerRoundId: true },
      })
    : [];
  const contactById = new Map(contactsLookup.map((c) => [c.id, c]));

  for (const m of candidates) {
    if (m.contactIds.length === 0) {
      unmatched.push({ msgId: m.id, type: m.type, contactIdsCount: 0, reason: "no-contacts" });
      continue;
    }
    const resolved = m.contactIds.map((id) => contactById.get(id));
    if (resolved.some((c) => !c)) {
      unmatched.push({ msgId: m.id, type: m.type, contactIdsCount: m.contactIds.length, reason: "missing-contact" });
      continue;
    }
    const contacts = resolved as { id: string; roleType: string; buyerRoundId: string | null }[];
    const purchasers = contacts.filter((c) => c.roleType === "purchaser");
    if (purchasers.length === 0) {
      // No purchaser contacts at all — vendor-only, solicitor-only, etc.
      // File-level by design; not attributable to any sale.
      unmatched.push({ msgId: m.id, type: m.type, contactIdsCount: m.contactIds.length, reason: "no-purchaser" });
      continue;
    }
    // Refined rule: only the PURCHASER contacts' buyerRoundId matters.
    // Other-role co-recipients neither stamp nor block.
    if (purchasers.some((c) => c.buyerRoundId === null)) {
      unmatched.push({ msgId: m.id, type: m.type, contactIdsCount: m.contactIds.length, reason: "all-null-round" });
      continue;
    }
    const distinctRounds = new Set(purchasers.map((c) => c.buyerRoundId));
    if (distinctRounds.size > 1) {
      unmatched.push({ msgId: m.id, type: m.type, contactIdsCount: m.contactIds.length, reason: "mixed-rounds" });
      continue;
    }
    const roundId = purchasers[0].buyerRoundId!;
    stamped.push({ msgId: m.id, type: m.type, contactIdsCount: m.contactIds.length, stampedRoundId: roundId });
  }

  // ── Apply ──────────────────────────────────────────────────────────
  let appliedCount = 0;
  if (APPLY && stamped.length > 0) {
    const byRound = new Map<string, string[]>();
    for (const s of stamped) {
      const list = byRound.get(s.stampedRoundId) ?? [];
      list.push(s.msgId);
      byRound.set(s.stampedRoundId, list);
    }
    for (const [roundId, ids] of byRound) {
      const res = await prisma.outboundMessage.updateMany({
        where: { id: { in: ids }, buyerRoundId: null },
        data: { buyerRoundId: roundId },
      });
      appliedCount += res.count;
    }
  }

  // ── Report ────────────────────────────────────────────────────────
  const finishedAt = new Date();
  const lines: string[] = [];
  lines.push("=".repeat(78));
  lines.push("Phase-2 PR 3 backfill — OutboundMessage.buyerRoundId");
  lines.push("=".repeat(78));
  lines.push(`Mode:          ${APPLY ? "APPLY (writes committed)" : "DRY-RUN (no writes)"}`);
  lines.push(`Started:       ${startedAt.toISOString()}`);
  lines.push(`Finished:      ${finishedAt.toISOString()}`);
  lines.push(`Candidates:    ${candidates.length} (buyerRoundId IS NULL)`);
  lines.push(`Stamped:       ${stamped.length}`);
  lines.push(`Unmatched:     ${unmatched.length}`);
  if (APPLY) lines.push(`Rows written:  ${appliedCount}`);
  lines.push("");
  lines.push("Rule: all contactIds resolve to purchaser-role Contacts AND share");
  lines.push("      the same non-null buyerRoundId → stamp doc.buyerRoundId.");
  lines.push("      Mixed roles / mixed rounds / missing contacts / no contacts");
  lines.push("      → leave NULL (file-level / unmatched-by-design).");
  lines.push("");

  lines.push("-".repeat(78));
  lines.push(`STAMPED ROWS (${stamped.length})`);
  lines.push("-".repeat(78));
  if (stamped.length === 0) {
    lines.push("(none)");
  } else {
    // By type for scannability — chase / internal_note / etc.
    const byType = new Map<string, StampedRow[]>();
    for (const s of stamped) {
      const list = byType.get(s.type) ?? [];
      list.push(s);
      byType.set(s.type, list);
    }
    for (const [t, rows] of byType) {
      lines.push(`  type=${t}  (${rows.length})`);
      for (const s of rows) {
        lines.push(`    ${s.msgId}  contactIds=${s.contactIdsCount}  → round ${s.stampedRoundId}`);
      }
    }
  }
  lines.push("");

  lines.push("-".repeat(78));
  lines.push(`UNMATCHED ROWS (${unmatched.length}) — grouped by reason`);
  lines.push("-".repeat(78));
  if (unmatched.length === 0) {
    lines.push("(none)");
  } else {
    const byReason = new Map<string, UnmatchedRow[]>();
    for (const u of unmatched) {
      const list = byReason.get(u.reason) ?? [];
      list.push(u);
      byReason.set(u.reason, list);
    }
    for (const [reason, rows] of byReason) {
      lines.push(`  reason=${reason}  (${rows.length})`);
      // For high-volume buckets (no-contacts, mixed-roles) just count;
      // for low-volume ones (mixed-rounds, all-null-round, missing-contact)
      // list each row for manual review.
      const lowVolume = ["mixed-rounds", "all-null-round", "missing-contact", "mixed-roles"].includes(reason);
      if (lowVolume) {
        for (const u of rows) {
          lines.push(`    ${u.msgId}  type=${u.type}  contactIds=${u.contactIdsCount}`);
        }
      } else {
        const byType = new Map<string, number>();
        for (const u of rows) byType.set(u.type, (byType.get(u.type) ?? 0) + 1);
        for (const [t, n] of byType) lines.push(`    type=${t}: ${n}`);
      }
    }
  }
  lines.push("");
  lines.push("=".repeat(78));
  lines.push("END OF REPORT");
  lines.push("=".repeat(78));

  const report = lines.join("\n");
  console.log(report);

  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const outPath = resolve(`scripts/output/backfill-outbound-message-buyer-round-id-${stamp}.txt`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, report + "\n", "utf8");
  console.log(`\nReport written to: ${outPath}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
