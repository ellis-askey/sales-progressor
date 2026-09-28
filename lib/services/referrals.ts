// Referral ledger service (docs/active/referral-ledger/00-spec.md, Option B).
//
// The legacy file-level referral columns stay the display source of truth for the
// CURRENT buyer (every existing fees/revenue surface keeps reading them). This
// service keeps a parallel Referral row in sync so the ledger is the durable,
// per-buyer record — what makes a relist safe, holds the previous buyer's earned
// fee, and powers the archived-round drawer + Command Centre history.
//
// The columns are written by the existing save actions; this module mirrors each
// write into a ledger row (dual-write), applies the relist keep/void rules, and
// flips a referral to "earned" when its trigger milestone lands.

import { prisma } from "@/lib/prisma";
import type { Prisma, ReferralKind, ReferralStatus, FeeVatTreatment } from "@prisma/client";

type Client = Prisma.TransactionClient | typeof prisma;

async function firmNameFor(client: Client, field: "solicitor" | "broker", firmId: string): Promise<string> {
  if (field === "solicitor") {
    const f = await client.solicitorFirm.findUnique({ where: { id: firmId }, select: { name: true } });
    return f?.name ?? "(unknown firm)";
  }
  const f = await client.brokerFirm.findUnique({ where: { id: firmId }, select: { name: true } });
  return f?.name ?? "(unknown broker)";
}

// Mirror one referral kind's column state into its ledger row. Deletes the row
// when the referral is cleared (no firm, no fee, not received). Preserves the
// earned/received timestamps once set so an unrelated edit doesn't restate them.
export async function syncReferralRow(
  client: Client,
  params: {
    transactionId: string;
    buyerRoundId: string | null; // active round for buyer_* kinds; null for seller/onward
    kind: ReferralKind;
    firmField: "solicitor" | "broker";
    firmId: string | null;
    contactId?: string | null; // broker only
    feePence: number | null;
    vat: FeeVatTreatment;
    received: boolean;
    earned: boolean; // caller computes: PM5 for buyer broker, completion for solicitor
  },
): Promise<void> {
  const existing = await client.referral.findFirst({
    where: { transactionId: params.transactionId, kind: params.kind, buyerRoundId: params.buyerRoundId },
    select: { id: true, earnedAt: true, receivedAt: true },
  });

  const cleared = !params.firmId && params.feePence == null && !params.received;
  if (cleared) {
    if (existing) await client.referral.delete({ where: { id: existing.id } });
    return;
  }

  const status: ReferralStatus = params.received ? "received" : params.earned ? "earned" : "pending";
  const now = new Date();
  const firmName = params.firmId ? await firmNameFor(client, params.firmField, params.firmId) : "(unknown firm)";

  const data = {
    kind: params.kind,
    buyerRoundId: params.buyerRoundId,
    solicitorFirmId: params.firmField === "solicitor" ? params.firmId : null,
    brokerFirmId: params.firmField === "broker" ? params.firmId : null,
    brokerContactId: params.firmField === "broker" ? (params.contactId ?? null) : null,
    firmNameSnapshot: firmName,
    feePence: params.feePence,
    vat: params.vat,
    status,
    earnedAt: status === "pending" ? null : (existing?.earnedAt ?? now),
    receivedAt: status === "received" ? (existing?.receivedAt ?? now) : null,
  };

  if (existing) {
    await client.referral.update({ where: { id: existing.id }, data });
  } else {
    await client.referral.create({ data: { transactionId: params.transactionId, ...data } });
  }
}

// Relist keep/void rules (Phase 4). Runs inside the relist transaction against the
// OUTGOING round. Buyer-side referrals belong to the buyer who's leaving:
//   - buyer_broker: KEEP if earned/received (real revenue, stays on the archived
//     round), otherwise VOID (never earned).
//   - buyer_solicitor: VOID (only earns on completion, which didn't happen).
// Seller_solicitor + onward_broker are file-level and left untouched (the seller
// is unchanged). Returns which buyer-side columns to reset so the caller can clear
// them for the incoming buyer.
export async function applyRelistReferralRules(
  client: Client,
  outgoingRoundId: string,
  transactionId: string,
): Promise<{ resetBrokerColumns: boolean; resetSolicitorColumns: boolean }> {
  const broker = await client.referral.findFirst({
    where: { transactionId, kind: "buyer_broker", buyerRoundId: outgoingRoundId },
    select: { id: true, status: true },
  });
  if (broker && broker.status === "pending") {
    await client.referral.delete({ where: { id: broker.id } });
  }

  const buyerSol = await client.referral.findFirst({
    where: { transactionId, kind: "buyer_solicitor", buyerRoundId: outgoingRoundId },
    select: { id: true },
  });
  if (buyerSol) {
    await client.referral.delete({ where: { id: buyerSol.id } });
  }

  // The buyer-broker columns always reset for the incoming buyer (the earned fee,
  // if any, is safe on the kept ledger row). The solicitor columns reset only when
  // the file's referral was the BUYER's solicitor; a seller-side referral stays.
  return { resetBrokerColumns: true, resetSolicitorColumns: !!buyerSol };
}

// Which milestone code, once satisfied, marks each referral kind "earned".
const BROKER_EARNED_CODE = "PM5"; // buyer's mortgage application submitted
const COMPLETION_CODES = new Set(["VM20", "PM27"]); // sale/purchase completed

// Flip a referral to "earned" when its trigger milestone is confirmed. Called from
// the milestone-confirm path. No-op if there's no matching pending referral.
export async function flipReferralEarnedForMilestone(
  client: Client,
  transactionId: string,
  milestoneCode: string,
  activeBuyerRoundId: string | null,
): Promise<void> {
  const now = new Date();
  if (milestoneCode === BROKER_EARNED_CODE && activeBuyerRoundId) {
    await client.referral.updateMany({
      where: { transactionId, kind: "buyer_broker", buyerRoundId: activeBuyerRoundId, status: "pending" },
      data: { status: "earned", earnedAt: now },
    });
  }
  if (COMPLETION_CODES.has(milestoneCode)) {
    await client.referral.updateMany({
      where: {
        transactionId,
        kind: { in: ["buyer_solicitor", "seller_solicitor"] },
        status: "pending",
      },
      data: { status: "earned", earnedAt: now },
    });
  }
}

// Has the buyer's mortgage application (PM5) been reached on this round? Used by
// the save path to set a broker referral's initial earned state when it's added
// after the mortgage already went in.
export async function isBrokerEarned(client: Client, transactionId: string, buyerRoundId: string | null): Promise<boolean> {
  if (!buyerRoundId) return false;
  const row = await client.milestoneCompletion.findFirst({
    where: {
      transactionId,
      buyerRoundId,
      state: { in: ["complete", "not_required"] },
      milestoneDefinition: { code: BROKER_EARNED_CODE },
    },
    select: { id: true },
  });
  return !!row;
}
