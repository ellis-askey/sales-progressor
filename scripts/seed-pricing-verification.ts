// One-shot verification seed for the pricing migration (Phase 1).
//
// Creates a fresh, isolated agency + director and three exchanged sales that
// exercise the REAL billing code (createTransaction + maybeStampExchange), so
// /agent/billing shows the Phase-1 change:
//   1. a self-progress sale  -> £0, never billed (free by type)
//   2. a new agency's FIRST outsourced sale -> band fee + full-value credit = £0
//   3. a second outsourced sale -> bills its band (£300)
//
// SAFETY: refuses to run unless DATABASE_URL is the STAGING database. Never
// touches prod. Idempotent — reuses its own agency and clears prior seed rows.
//
// Lifetime: one-shot. Delete the "Pricing Verification Co" agency after
// checking, or re-run to reset. Registered in docs/SCRIPTS_REGISTRY.md.

import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { createTransaction } from "@/lib/services/transactions";
import { maybeStampExchange } from "@/lib/services/billing-trigger";
import { accrueInvoicesForCurrentMonth } from "@/lib/billing/accrual";

const STAGING_REF = "etidawkbqctarmsdjoxp";
const EMAIL = "pricing-verify@thesalesprogressor.test";
const PASSWORD = "PricingVerify2026!";

async function main() {
  if (!process.env.DATABASE_URL?.includes(STAGING_REF)) {
    throw new Error(
      `Refusing to run: DATABASE_URL is not the staging DB (${STAGING_REF}). ` +
        `Set it explicitly to staging before running this seed.`,
    );
  }

  // Fresh agency = no prior outsourced files, so first-outsourced-free fires.
  let director = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, agencyId: true } });
  let agencyId: string;
  if (director?.agencyId) {
    agencyId = director.agencyId;
    await prisma.creditNote.deleteMany({ where: { agencyId } });
    await prisma.invoiceLine.deleteMany({ where: { invoice: { agencyId } } });
    await prisma.invoice.deleteMany({ where: { agencyId } });
    await prisma.propertyTransaction.deleteMany({ where: { agencyId } });
  } else {
    const agency = await prisma.agency.create({ data: { name: "Pricing Verification Co" } });
    agencyId = agency.id;
    director = await prisma.user.create({
      data: {
        name: "Pricing Verify",
        email: EMAIL,
        password: await hash(PASSWORD, 10),
        role: "director",
        agencyId,
        emailVerified: new Date(),
      },
      select: { id: true, agencyId: true },
    });
  }

  const make = async (address: string, progressedBy: "agent" | "progressor", pricePence: number) => {
    const tx = await createTransaction({
      propertyAddress: address,
      agencyId,
      agentUserId: director!.id,
      progressedBy,
      purchasePrice: pricePence,
    });
    // Simulate exchange — runs the real billing trigger (self skip / first-free / bill).
    await maybeStampExchange(tx.id, "VM19");
    return prisma.propertyTransaction.findUnique({
      where: { id: tx.id },
      select: { propertyAddress: true, serviceType: true, freeReason: true, billedAtExchange: true, firstOutsourcedFree: true, priceAtExchange: true },
    });
  };

  const self = await make("1 Free Way, London N1 1AA", "agent", 400_000_00);
  const first = await make("2 Onus Road, London N2 2BB", "progressor", 425_000_00);
  const second = await make("3 Billed Lane, London N3 3CC", "progressor", 400_000_00);

  const accrual = await accrueInvoicesForCurrentMonth();
  const credits = await prisma.creditNote.findMany({ where: { agencyId }, select: { amountPence: true, reason: true } });

  console.log("\n=== Pricing verification seed complete (staging) ===");
  console.log("Login:", EMAIL, "  password:", PASSWORD);
  console.log("\nSelf-progress   :", self);
  console.log("First outsourced:", first);
  console.log("Second outsource:", second);
  console.log("Credits         :", credits);
  console.log("Accrual         :", accrual);
  console.log("\nOpen /agent/billing as the login above:");
  console.log("  - first outsourced shows its band fee AND a 'First outsourced file free' credit, netting to 0");
  console.log("  - second outsourced bills its band (300)");
  console.log("  - the self-progress sale is not billed at all (free)");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
