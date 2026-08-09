"use server";

// Status transitions on QuoteRequest rows from the Command Centre inbox.
// Client-side submissions are created by the public /quote/[token] page's
// own action (app/quote/[token]/actions.ts).

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { recordAdminAction } from "@/lib/command/audit/write";
import type { ActionResult } from "./provider-firms";

async function requireSuperadmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    redirect("/dashboard");
  }
  return session.user;
}

const REFERRAL_FEE_BPS = 1000; // 10% expressed in basis points

// Won: records the surveyor's fee to the client + auto-computes the 10%
// referral fee. Both values are editable on the form so admin can override
// after the fact.
export async function markQuoteWon(
  id: string,
  input: { saleFeePence: number | null; referralFeePence?: number | null; reason?: string | null },
): Promise<ActionResult> {
  const user = await requireSuperadmin();
  const before = await commandDb.quoteRequest.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Quote request not found." };

  const sale = input.saleFeePence && input.saleFeePence > 0 ? Math.round(input.saleFeePence) : null;
  const referral =
    input.referralFeePence !== undefined && input.referralFeePence !== null
      ? Math.round(input.referralFeePence)
      : sale
        ? Math.round((sale * REFERRAL_FEE_BPS) / 10000)
        : null;

  await commandDb.quoteRequest.update({
    where: { id },
    data: {
      status: "won",
      statusReason: input.reason?.trim() || null,
      statusChangedAt: new Date(),
      statusChangedById: user.id,
      saleFeePence: sale,
      referralFeePence: referral,
    },
  });

  await recordAdminAction({
    adminUserId: user.id,
    action: "quote_request.mark_won",
    targetType: "QuoteRequest",
    targetId: id,
    beforeValue: { status: before.status },
    afterValue: { status: "won", saleFeePence: sale, referralFeePence: referral },
  }).catch(() => {});

  revalidatePath("/command/providers/quotes");
  revalidatePath(`/command/providers/quotes/${id}`);
  return { ok: true };
}

export async function markQuoteLost(
  id: string,
  input: { reason?: string | null },
): Promise<ActionResult> {
  const user = await requireSuperadmin();
  const before = await commandDb.quoteRequest.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Quote request not found." };

  await commandDb.quoteRequest.update({
    where: { id },
    data: {
      status: "lost",
      statusReason: input.reason?.trim() || null,
      statusChangedAt: new Date(),
      statusChangedById: user.id,
    },
  });

  await recordAdminAction({
    adminUserId: user.id,
    action: "quote_request.mark_lost",
    targetType: "QuoteRequest",
    targetId: id,
    beforeValue: { status: before.status },
    afterValue: { status: "lost", reason: input.reason },
  }).catch(() => {});

  revalidatePath("/command/providers/quotes");
  revalidatePath(`/command/providers/quotes/${id}`);
  return { ok: true };
}

export async function markQuoteExpired(id: string): Promise<ActionResult> {
  const user = await requireSuperadmin();
  const before = await commandDb.quoteRequest.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Quote request not found." };

  await commandDb.quoteRequest.update({
    where: { id },
    data: {
      status: "expired",
      statusChangedAt: new Date(),
      statusChangedById: user.id,
    },
  });

  await recordAdminAction({
    adminUserId: user.id,
    action: "quote_request.mark_expired",
    targetType: "QuoteRequest",
    targetId: id,
    beforeValue: { status: before.status },
    afterValue: { status: "expired" },
  }).catch(() => {});

  revalidatePath("/command/providers/quotes");
  revalidatePath(`/command/providers/quotes/${id}`);
  return { ok: true };
}

export async function reopenQuote(id: string): Promise<ActionResult> {
  const user = await requireSuperadmin();
  const before = await commandDb.quoteRequest.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Quote request not found." };

  await commandDb.quoteRequest.update({
    where: { id },
    data: {
      status: "pending",
      statusReason: null,
      statusChangedAt: new Date(),
      statusChangedById: user.id,
    },
  });

  await recordAdminAction({
    adminUserId: user.id,
    action: "quote_request.reopen",
    targetType: "QuoteRequest",
    targetId: id,
    beforeValue: { status: before.status },
    afterValue: { status: "pending" },
  }).catch(() => {});

  revalidatePath("/command/providers/quotes");
  revalidatePath(`/command/providers/quotes/${id}`);
  return { ok: true };
}

export async function markReferralFeeCollected(
  id: string,
  collected: boolean,
): Promise<ActionResult> {
  const user = await requireSuperadmin();
  await commandDb.quoteRequest.update({
    where: { id },
    data: {
      referralFeeCollected: collected,
      referralFeeCollectedAt: collected ? new Date() : null,
    },
  });

  await recordAdminAction({
    adminUserId: user.id,
    action: "quote_request.referral_fee_collected",
    targetType: "QuoteRequest",
    targetId: id,
    afterValue: { collected },
  }).catch(() => {});

  revalidatePath("/command/providers/quotes");
  revalidatePath(`/command/providers/quotes/${id}`);
  return { ok: true };
}
