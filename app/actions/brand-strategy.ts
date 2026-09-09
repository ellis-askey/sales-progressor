"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { refreshBrandReview, type BrandReviewData } from "@/lib/command/content/strategy-review";

// Brand strategy actions (docs/active/content-brand/SPEC.md, Phase 2.3).
// Superadmin-gated: commandDb is full-access, so the guard lives here.

async function assertSuperadmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    throw new Error("Unauthorised");
  }
}

// Save the rolling "what to be known for this quarter" onto the single brand
// profile row (create it if it doesn't exist yet). Only touches quarterFocus, so
// it never clobbers the positioning fields.
export async function saveQuarterFocusAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();

  const quarterFocus = ((formData.get("quarterFocus") as string) ?? "").trim();

  const existing = await commandDb.brandProfile.findFirst({ orderBy: { updatedAt: "desc" } });
  if (existing) {
    await commandDb.brandProfile.update({ where: { id: existing.id }, data: { quarterFocus } });
  } else {
    await commandDb.brandProfile.create({ data: { quarterFocus } });
  }

  revalidatePath("/command/content/strategy");
  revalidatePath("/command/content/brand");
  return { ok: true };
}

export async function refreshBrandReviewAction(): Promise<{ ok: boolean; review: BrandReviewData | null }> {
  await assertSuperadmin();
  const review = await refreshBrandReview();
  revalidatePath("/command/content/strategy");
  return { ok: review != null, review };
}
