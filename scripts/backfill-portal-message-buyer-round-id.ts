// Phase-2 PR 4 backfill: stamp PortalMessage.buyerRoundId on historical
// rows whose write-path stamping pre-dated the Phase 0 / Phase 1
// stamping convention.
//
// Classification rule (Ellis-locked, decisions log entry 5):
//   - PortalMessage.contactId resolves to a Contact with
//     roleType="purchaser" AND non-null buyerRoundId
//       → stamp portalMessage.buyerRoundId = contact.buyerRoundId
//   - Else (vendor / solicitor / broker portal sends, or pre-Section-2
//     purchaser with NULL buyerRoundId)
//       → leave NULL (file-level / unmatched-by-design).
//
// KNOWN LIMITATION (flagged in the per-PR scope by Ellis 2026-06-05):
// solicitor / broker portal sends stay file-level. Side-attribution for
// solicitors isn't reliable enough to backfill — mis-filing between
// buyers is the failure mode we won't risk. The dead-round gate at the
// portal-message send sites guards against new mis-attribution.
//
// Run order (per the Phase-2 per-PR template):
//   1. Staging dry-run.   tsx scripts/backfill-portal-message-buyer-round-id.ts
//   2. Ellis approves the report.
//   3. Staging --apply.   tsx scripts/backfill-portal-message-buyer-round-id.ts --apply
//   4. Re-run dry-run, confirm zero remaining unmatched purchaser rows.
//   5. Browser verification on Emily relist fixture.
//   6. Prod conversation.

import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type StampedRow = {
  msgId: string;
  fromClient: boolean;
  contactId: string;
  contactName: string;
  stampedRoundId: string;
};

type UnmatchedRow = {
  msgId: string;
  fromClient: boolean;
  contactId: string;
  contactName: string;
  contactRoleType: string;
  reason: "contact-missing" | "contact-non-purchaser" | "contact-null-round";
};

async function main() {
  const startedAt = new Date();
  const stamped: StampedRow[] = [];
  const unmatched: UnmatchedRow[] = [];

  const candidates = await prisma.portalMessage.findMany({
    where: { buyerRoundId: null },
    select: {
      id: true,
      fromClient: true,
      contactId: true,
      contact: { select: { id: true, name: true, roleType: true, buyerRoundId: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (candidates.length === 0) {
    console.log("No PortalMessage rows with NULL buyerRoundId. Nothing to do.");
    await prisma.$disconnect();
    return;
  }

  for (const m of candidates) {
    if (!m.contact) {
      unmatched.push({
        msgId: m.id,
        fromClient: m.fromClient,
        contactId: m.contactId,
        contactName: "(contact row not found)",
        contactRoleType: "—",
        reason: "contact-missing",
      });
      continue;
    }
    if (m.contact.roleType !== "purchaser") {
      // Solicitor / broker / vendor / other portal sends stay file-level
      // by Ellis-locked design — known limitation flagged in the plan.
      unmatched.push({
        msgId: m.id,
        fromClient: m.fromClient,
        contactId: m.contactId,
        contactName: m.contact.name,
        contactRoleType: m.contact.roleType,
        reason: "contact-non-purchaser",
      });
      continue;
    }
    if (m.contact.buyerRoundId === null) {
      // Purchaser contact whose own buyerRoundId hasn't been backfilled
      // by Section 2. Cross-check needed.
      unmatched.push({
        msgId: m.id,
        fromClient: m.fromClient,
        contactId: m.contactId,
        contactName: m.contact.name,
        contactRoleType: m.contact.roleType,
        reason: "contact-null-round",
      });
      continue;
    }
    stamped.push({
      msgId: m.id,
      fromClient: m.fromClient,
      contactId: m.contactId,
      contactName: m.contact.name,
      stampedRoundId: m.contact.buyerRoundId,
    });
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
      const res = await prisma.portalMessage.updateMany({
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
  lines.push("Phase-2 PR 4 backfill — PortalMessage.buyerRoundId");
  lines.push("=".repeat(78));
  lines.push(`Mode:          ${APPLY ? "APPLY (writes committed)" : "DRY-RUN (no writes)"}`);
  lines.push(`Started:       ${startedAt.toISOString()}`);
  lines.push(`Finished:      ${finishedAt.toISOString()}`);
  lines.push(`Candidates:    ${candidates.length} (buyerRoundId IS NULL)`);
  lines.push(`Stamped:       ${stamped.length}`);
  lines.push(`Unmatched:     ${unmatched.length}`);
  if (APPLY) lines.push(`Rows written:  ${appliedCount}`);
  lines.push("");
  lines.push("Rule: contact.roleType=purchaser + contact.buyerRoundId NOT NULL");
  lines.push("      → stamp portalMessage.buyerRoundId = contact.buyerRoundId.");
  lines.push("      Else → leave NULL (file-level by design / known limitation).");
  lines.push("");
  lines.push("Known limitation: solicitor / broker portal sends stay file-level.");
  lines.push("Side-attribution for solicitors isn't reliable enough to backfill —");
  lines.push("mis-filing between buyers is the failure mode we won't risk.");
  lines.push("");

  lines.push("-".repeat(78));
  lines.push(`STAMPED ROWS (${stamped.length})`);
  lines.push("-".repeat(78));
  if (stamped.length === 0) {
    lines.push("(none)");
  } else {
    for (const s of stamped) {
      const dir = s.fromClient ? "←" : "→";
      lines.push(
        `  ${s.msgId}  ${dir} contact ${s.contactId} (${s.contactName}) → round ${s.stampedRoundId}`,
      );
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
      for (const u of rows) {
        const dir = u.fromClient ? "←" : "→";
        lines.push(
          `    ${u.msgId}  ${dir} contact ${u.contactId} (${u.contactName}, ${u.contactRoleType})`,
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
  const outPath = resolve(`scripts/output/backfill-portal-message-buyer-round-id-${stamp}.txt`);
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
