// Backfill the Referral ledger from the legacy file-level referral columns.
// One-shot, part of docs/active/referral-ledger/00-spec.md (Phase 2).
//
// For every transaction it turns the three legacy column-sets into Referral rows:
//   - buyer-broker  -> buyer_broker on the active round
//   - onward-broker -> onward_broker (file/seller-level)
//   - solicitor     -> buyer_solicitor / seller_solicitor, side INFERRED by
//                      matching referredFirmId to the file's purchaser/vendor
//                      solicitor firm. A genuine no-match defaults to
//                      seller_solicitor (the safe, non-wiping side) and is flagged
//                      in `notes` for one-time manual classification.
//
// Idempotent: skips a (transaction, kind) that already has a row, so a re-run is
// a no-op. Staging-only unless ALLOW_PROD=1 is set (deliberate prod run).
//
// Run:  node scripts/backfill-referral-ledger.mjs            (staging, from .env)
//       ALLOW_PROD=1 DATABASE_URL=<prod> node scripts/backfill-referral-ledger.mjs
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

let url = process.env.DATABASE_URL ?? "";
if (!url) {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const m = env.match(/^DATABASE_URL=(.*)$/m);
  url = (m ? m[1] : "").trim().replace(/^["']|["']$/g, "");
}
if (!url) { console.error("No DATABASE_URL"); process.exit(1); }
const isProd = url.includes("gmkfustgwipgihpmpjpr");
if (isProd && process.env.ALLOW_PROD !== "1") {
  console.error("ABORT: DATABASE_URL is PROD. Re-run with ALLOW_PROD=1 to backfill prod deliberately.");
  process.exit(1);
}
console.log(`Target: ${isProd ? "PROD" : "staging"} (${url.replace(/:\/\/[^@]*@/, "://<redacted>@").slice(0, 70)})`);

const prisma = new PrismaClient({ datasources: { db: { url } } });

const txs = await prisma.propertyTransaction.findMany({
  where: {
    OR: [
      { referredFirmId: { not: null } },
      { referralFee: { not: null } },
      { brokerFirmId: { not: null } },
      { brokerReferralFee: { not: null } },
      { purchaserBrokerReferral: true },
      { onwardBrokerFirmId: { not: null } },
      { onwardBrokerReferralFee: { not: null } },
      { onwardBrokerReferral: true },
    ],
  },
  select: {
    id: true, status: true, activeBuyerRoundId: true,
    purchaserSolicitorFirmId: true, vendorSolicitorFirmId: true,
    referredFirmId: true, referralFee: true, referralFeeVat: true, referralFeeReceived: true,
    referredFirm: { select: { name: true } },
    brokerFirmId: true, brokerContactId: true, brokerReferralFee: true, brokerReferralFeeVat: true, brokerReferralFeeReceived: true, purchaserBrokerReferral: true,
    brokerFirm: { select: { name: true } },
    onwardBrokerFirmId: true, onwardBrokerContactId: true, onwardBrokerReferralFee: true, onwardBrokerReferralFeeVat: true, onwardBrokerReferralFeeReceived: true, onwardBrokerReferral: true,
    onwardBrokerFirm: { select: { name: true } },
    referrals: { select: { kind: true } },
  },
});

// PM5 completion per active round (broker "earned" trigger).
const activeRoundIds = txs.map((t) => t.activeBuyerRoundId).filter(Boolean);
const pm5 = activeRoundIds.length
  ? await prisma.milestoneCompletion.findMany({
      where: {
        buyerRoundId: { in: activeRoundIds },
        state: { in: ["complete", "not_required"] },
        milestoneDefinition: { code: "PM5" },
      },
      select: { buyerRoundId: true },
    })
  : [];
const pm5Rounds = new Set(pm5.map((r) => r.buyerRoundId));

let created = 0, skipped = 0, flagged = 0;
const summary = { buyer_broker: 0, onward_broker: 0, buyer_solicitor: 0, seller_solicitor: 0 };

for (const tx of txs) {
  const have = new Set(tx.referrals.map((r) => r.kind));
  const rows = [];

  // Buyer broker
  if ((tx.brokerFirmId || tx.brokerReferralFee != null || tx.purchaserBrokerReferral) && !have.has("buyer_broker")) {
    const status = tx.brokerReferralFeeReceived ? "received"
      : (tx.activeBuyerRoundId && pm5Rounds.has(tx.activeBuyerRoundId)) ? "earned" : "pending";
    rows.push({
      transactionId: tx.id, buyerRoundId: tx.activeBuyerRoundId, kind: "buyer_broker",
      brokerFirmId: tx.brokerFirmId, brokerContactId: tx.brokerContactId,
      firmNameSnapshot: tx.brokerFirm?.name ?? "(unknown broker)",
      feePence: tx.brokerReferralFee, vat: tx.brokerReferralFeeVat, status,
      earnedAt: status !== "pending" ? new Date() : null,
      receivedAt: status === "received" ? new Date() : null,
    });
    summary.buyer_broker++;
  }

  // Onward broker (seller's onward move; file-level)
  if ((tx.onwardBrokerFirmId || tx.onwardBrokerReferralFee != null || tx.onwardBrokerReferral) && !have.has("onward_broker")) {
    const status = tx.onwardBrokerReferralFeeReceived ? "received" : "pending";
    rows.push({
      transactionId: tx.id, buyerRoundId: null, kind: "onward_broker",
      brokerFirmId: tx.onwardBrokerFirmId, brokerContactId: tx.onwardBrokerContactId,
      firmNameSnapshot: tx.onwardBrokerFirm?.name ?? "(unknown broker)",
      feePence: tx.onwardBrokerReferralFee, vat: tx.onwardBrokerReferralFeeVat, status,
      receivedAt: status === "received" ? new Date() : null,
    });
    summary.onward_broker++;
  }

  // Solicitor (side inferred)
  if ((tx.referredFirmId || tx.referralFee != null) && !have.has("buyer_solicitor") && !have.has("seller_solicitor")) {
    let kind, note = null;
    if (tx.referredFirmId && tx.referredFirmId === tx.purchaserSolicitorFirmId) kind = "buyer_solicitor";
    else if (tx.referredFirmId && tx.referredFirmId === tx.vendorSolicitorFirmId) kind = "seller_solicitor";
    else { kind = "seller_solicitor"; note = "backfill: referred firm did not match buyer/seller solicitor - please classify side"; flagged++; }
    const status = tx.referralFeeReceived ? "received" : (tx.status === "completed" ? "earned" : "pending");
    rows.push({
      transactionId: tx.id,
      buyerRoundId: kind === "buyer_solicitor" ? tx.activeBuyerRoundId : null,
      kind, solicitorFirmId: tx.referredFirmId,
      firmNameSnapshot: tx.referredFirm?.name ?? "(unknown firm)",
      feePence: tx.referralFee, vat: tx.referralFeeVat, status, notes: note,
      earnedAt: status !== "pending" ? new Date() : null,
      receivedAt: status === "received" ? new Date() : null,
    });
    summary[kind]++;
  }

  if (rows.length === 0) { skipped++; continue; }
  await prisma.referral.createMany({ data: rows });
  created += rows.length;
}

console.log(`\nTransactions scanned: ${txs.length}`);
console.log(`Referral rows created: ${created}`, summary);
console.log(`Transactions skipped (already had rows / nothing to do): ${skipped}`);
console.log(`Solicitor rows flagged for manual side-classification: ${flagged}`);
const total = await prisma.referral.count();
console.log(`Total Referral rows now: ${total}`);
await prisma.$disconnect();
console.log("Done.");
