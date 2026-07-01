// Phase-2 PR 2 backfill: stamp TransactionDocument.buyerRoundId on
// historical purchaser-uploaded rows whose write-path stamping never ran.
//
// Classification rule (Ellis-locked, fall-through ledger audit findings):
//   - Only 3 source values exist today: "mos", "admin", "portal".
//   - MoS + admin rows have contactId = NULL → file-level by design, NEVER
//     stamped (the docs apply to every sale).
//   - Portal rows have a contactId. The rule:
//       contact.roleType === "purchaser" AND contact.buyerRoundId IS NOT
//       NULL → stamp the doc with contact.buyerRoundId.
//       Otherwise (vendor/solicitor/broker/other; or purchaser with NULL
//       contact stamp) → leave NULL (file-level / unmatched).
//
// Attribution via the Contact relation is unambiguous — no createdAt-window
// inference, no guess work. Unmatched rows are LISTED, never silently
// skipped.
//
// Constraints (non-negotiable, per the per-PR template):
//   - Default is dry-run. Pass --apply to actually write.
//   - Report prints to stdout AND is written to scripts/output/...
//   - Unmatched rows are LISTED with reason
//
// Run order:
//   1. Staging dry-run.   tsx scripts/backfill-transaction-document-buyer-round-id.ts
//   2. Ellis approves the report.
//   3. Staging --apply.   tsx scripts/backfill-transaction-document-buyer-round-id.ts --apply
//   4. Re-run dry-run, confirm zero remaining unmatched portal-purchaser rows.
//   5. Browser verification on Emily relist fixture (Sale 1 drawer shows
//      Marcus's docs; live tx shows file-level + Terry's docs only).
//   6. Prod conversation.

import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type StampedRow = {
  docId: string;
  filename: string;
  source: string;
  contactId: string;
  contactName: string;
  contactRoleType: string;
  stampedRoundId: string;
};

type UnmatchedRow = {
  docId: string;
  filename: string;
  source: string;
  contactId: string;
  contactName: string;
  contactRoleType: string;
  reason: "contact-missing" | "contact-non-purchaser" | "contact-null-round";
};

async function main() {
  const startedAt = new Date();
  const stamped: StampedRow[] = [];
  const unmatched: UnmatchedRow[] = [];

  // Candidates: docs with NULL buyerRoundId AND contactId IS NOT NULL.
  // No-contact docs (MoS, admin) are intentionally file-level — we don't
  // touch them.
  const candidates = await prisma.transactionDocument.findMany({
    where: { buyerRoundId: null, contactId: { not: null } },
    select: {
      id: true,
      filename: true,
      source: true,
      contactId: true,
      contact: {
        select: { id: true, name: true, roleType: true, buyerRoundId: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Note: do NOT early-return on zero candidates — the report file is the
  // durable audit artifact and must be written even for "nothing to do"
  // runs. The empty-list branches in the report builder handle this.

  for (const d of candidates) {
    // contactId is guaranteed non-null by the where clause, but TS doesn't
    // know that — narrow defensively.
    const contactId = d.contactId!;
    if (!d.contact) {
      unmatched.push({
        docId: d.id,
        filename: d.filename,
        source: d.source,
        contactId,
        contactName: "(contact row not found)",
        contactRoleType: "—",
        reason: "contact-missing",
      });
      continue;
    }
    if (d.contact.roleType !== "purchaser") {
      // Vendor / solicitor / broker / other portal uploads are file-level
      // by design. Listed as unmatched-by-design so the report makes
      // explicit that the rule didn't apply.
      unmatched.push({
        docId: d.id,
        filename: d.filename,
        source: d.source,
        contactId,
        contactName: d.contact.name,
        contactRoleType: d.contact.roleType,
        reason: "contact-non-purchaser",
      });
      continue;
    }
    if (d.contact.buyerRoundId === null) {
      // Purchaser contact whose own buyerRoundId hasn't been backfilled
      // (Section 2 should have caught these — flag for cross-check).
      unmatched.push({
        docId: d.id,
        filename: d.filename,
        source: d.source,
        contactId,
        contactName: d.contact.name,
        contactRoleType: d.contact.roleType,
        reason: "contact-null-round",
      });
      continue;
    }
    stamped.push({
      docId: d.id,
      filename: d.filename,
      source: d.source,
      contactId,
      contactName: d.contact.name,
      contactRoleType: d.contact.roleType,
      stampedRoundId: d.contact.buyerRoundId,
    });
  }

  // ── Apply (only when --apply) ──────────────────────────────────────
  let appliedCount = 0;
  if (APPLY && stamped.length > 0) {
    const byRound = new Map<string, string[]>();
    for (const s of stamped) {
      const list = byRound.get(s.stampedRoundId) ?? [];
      list.push(s.docId);
      byRound.set(s.stampedRoundId, list);
    }
    for (const [roundId, ids] of byRound) {
      const res = await prisma.transactionDocument.updateMany({
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
  lines.push("Phase-2 PR 2 backfill — TransactionDocument.buyerRoundId");
  lines.push("=".repeat(78));
  lines.push(`Mode:          ${APPLY ? "APPLY (writes committed)" : "DRY-RUN (no writes)"}`);
  lines.push(`Started:       ${startedAt.toISOString()}`);
  lines.push(`Finished:      ${finishedAt.toISOString()}`);
  lines.push(`Candidates:    ${candidates.length} (buyerRoundId IS NULL + contactId IS NOT NULL)`);
  lines.push(`Stamped:       ${stamped.length}`);
  lines.push(`Unmatched:     ${unmatched.length}`);
  if (APPLY) lines.push(`Rows written:  ${appliedCount}`);
  lines.push("");
  lines.push("Rule: contact.roleType=purchaser + contact.buyerRoundId NOT NULL");
  lines.push("      → stamp doc.buyerRoundId = contact.buyerRoundId.");
  lines.push("      Else → leave NULL (file-level).");
  lines.push("");
  lines.push("MoS + admin docs (contactId IS NULL) are intentionally file-level");
  lines.push("and NEVER touched — not included in this report's candidate set.");
  lines.push("");

  lines.push("-".repeat(78));
  lines.push(`STAMPED ROWS (${stamped.length})`);
  lines.push("-".repeat(78));
  if (stamped.length === 0) {
    lines.push("(none)");
  } else {
    for (const s of stamped) {
      lines.push(
        `  ${s.docId}  source=${s.source.padEnd(8)} ${s.filename.padEnd(40)} ` +
          `← contact ${s.contactId} (${s.contactName}, ${s.contactRoleType}) ` +
          `→ round ${s.stampedRoundId}`,
      );
    }
  }
  lines.push("");

  lines.push("-".repeat(78));
  lines.push(`UNMATCHED ROWS (${unmatched.length}) — for manual review`);
  lines.push("-".repeat(78));
  if (unmatched.length === 0) {
    lines.push("(none)");
  } else {
    // Group by reason for scannability.
    const byReason = new Map<string, UnmatchedRow[]>();
    for (const u of unmatched) {
      const list = byReason.get(u.reason) ?? [];
      list.push(u);
      byReason.set(u.reason, list);
    }
    for (const [reason, rows] of byReason) {
      lines.push(`  reason=${reason}  (${rows.length})`);
      for (const u of rows) {
        lines.push(
          `    ${u.docId}  source=${u.source.padEnd(8)} ${u.filename.padEnd(40)} ` +
            `← contact ${u.contactId} (${u.contactName}, ${u.contactRoleType})`,
        );
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
  const outPath = resolve(`scripts/output/backfill-transaction-document-buyer-round-id-${stamp}.txt`);
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
