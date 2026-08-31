// STAGING ONLY. Additive billing demo data for Tim Branston (agency
// "William H Brown") so /agent/account/billing shows populated states —
// a building invoice this month, invoice history in each status, "given free"
// and "billed lifetime" figures, and the acknowledged-terms surface.
//
// SAFETY:
//   - Refuses to run unless DATABASE_URL is the STAGING database.
//   - ADDITIVE. Never touches Tim's 14 real files. Demo transactions are
//     tagged "(demo)" in the address; demo invoices carry a "demo_tim_" id.
//   - Re-runnable: demo invoices are cleared + rebuilt each run; demo
//     transactions are created once (skipped if already present).
//   - No card is created (Stripe isn't configured on staging) — the payment
//     panel shows its real "add a card" state.
//
// Lifetime: one-shot demo. Delete via the DELETION block at the bottom (or by
// removing the demo rows) after review. Registered in docs/SCRIPTS_REGISTRY.md.
//
// Run:
//   npx dotenv -e .env.local -- npx ts-node --project tsconfig.scripts.json scripts/seed-tim-billing-demo.ts

import { prisma } from "@/lib/prisma";
import { createTransaction } from "@/lib/services/transactions";
import { maybeStampExchange } from "@/lib/services/billing-trigger";

const STAGING_REF = "etidawkbqctarmsdjoxp";
const EMAIL = "ellisaskey+tb@googlemail.com";

async function main() {
  if (!process.env.DATABASE_URL?.includes(STAGING_REF)) {
    throw new Error(`Refusing to run: DATABASE_URL is not the staging DB (${STAGING_REF}).`);
  }

  const tim = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, agencyId: true, name: true } });
  if (!tim?.agencyId) throw new Error("Tim Branston not found / has no agency.");
  const agencyId = tim.agencyId;

  // ── 1. Current-month exchanges → this month's building invoice ────────────
  // Only create once (skip if demo transactions already exist for the agency).
  const existingDemoTx = await prisma.propertyTransaction.count({
    where: { agencyId, propertyAddress: { contains: "(demo)" } },
  });
  if (existingDemoTx === 0) {
    const make = async (address: string, progressedBy: "progressor" | "agent", pricePence: number) => {
      const tx = await createTransaction({
        propertyAddress: address,
        agencyId,
        agentUserId: tim.id,
        progressedBy,
        purchasePrice: pricePence,
      });
      await maybeStampExchange(tx.id, "VM19"); // real billing trigger (first-free / band / self-skip)
      return tx.id;
    };
    // Order matters: the FIRST outsourced exchange becomes the free first file.
    await make("8 Maple Court, London N4 4DD (demo)", "progressor", 420_000_00); // first outsourced → free (£0)
    await make("22 Elm Road, London N5 5EE (demo)", "progressor", 300_000_00);   // band 1 → £250
    await make("5 Birch Lane, London N6 6FF (demo)", "progressor", 600_000_00);  // band 3 → £350
    await make("12 Oak Avenue, London N7 7GG (demo)", "agent", 350_000_00);      // self-progress → free by type
    console.log("Created 4 demo exchanges this month.");
  } else {
    console.log(`Demo transactions already present (${existingDemoTx}); skipping create.`);
  }

  // ── 2. Past invoices → history list + billed-lifetime + invoice count ─────
  await prisma.invoice.deleteMany({ where: { agencyId, stripeInvoiceId: { startsWith: "demo_tim_" } } });
  const monthStart = (y: number, m: number) => new Date(Date.UTC(y, m, 1));
  const mkInvoice = async (
    y: number,
    m: number,
    status: "paid" | "issued" | "failed",
    lines: { desc: string; pence: number }[],
  ) => {
    await prisma.invoice.create({
      data: {
        agencyId,
        monthStart: monthStart(y, m),
        status,
        issuedAt: monthStart(y, m + 1),
        paidAt: status === "paid" ? new Date(Date.UTC(y, m + 1, 5)) : null,
        stripeInvoiceId: `demo_tim_${y}_${String(m + 1).padStart(2, "0")}`,
        lines: {
          create: lines.map((l) => ({
            kind: "outsourced_fee" as const,
            description: l.desc,
            amountPence: l.pence,
            vatPence: 0,
            totalPence: l.pence,
          })),
        },
      },
    });
  };
  await mkInvoice(2026, 6, "paid", [
    { desc: "Outsourced — 4 Kings Road", pence: 30000 },
    { desc: "Outsourced — 9 Queen Street", pence: 25000 },
  ]); // July → Paid, £550
  await mkInvoice(2026, 5, "issued", [{ desc: "Outsourced — 2 Duke Avenue", pence: 30000 }]); // June → Issued, £300
  await mkInvoice(2026, 4, "failed", [{ desc: "Outsourced — 7 Prince Way", pence: 35000 }]);  // May → Failed, £350
  console.log("Rebuilt 3 past invoices (Paid / Issued / Failed).");

  // ── 3. Acknowledge the ACTIVE terms → reveals the normal billing surface ──
  const terms = await prisma.termsVersion.findFirst({ orderBy: { effectiveFrom: "desc" }, select: { id: true, versionTag: true } });
  if (terms) {
    const existing = await prisma.pricingAcknowledgement.findFirst({ where: { agencyId, termsVersionId: terms.id }, select: { id: true } });
    if (!existing) {
      await prisma.pricingAcknowledgement.create({
        data: {
          agencyId,
          termsVersionId: terms.id,
          acknowledgedByUserId: tim.id,
          acknowledgedByName: tim.name ?? "Tim Branston",
          acknowledgedByEmail: EMAIL,
        },
      });
      console.log(`Acknowledged active terms (${terms.versionTag}).`);
    } else {
      console.log("Active terms already acknowledged.");
    }
  }

  console.log("\nDone. Open /agent/account/billing as Tim to review.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
