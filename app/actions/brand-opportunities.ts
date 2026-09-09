"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { refreshOpportunities, type OpportunityRefreshResult } from "@/lib/command/content/opportunities";

// Brand-opportunities actions (docs/active/content-brand/SPEC.md, Phase 2.1).
// Superadmin-gated: commandDb is full-access, so the guard lives here.

async function assertSuperadmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    throw new Error("Unauthorised");
  }
}

function revalidate() {
  revalidatePath("/command/content/opportunities");
  revalidatePath("/command/content");
}

export async function refreshOpportunitiesAction(): Promise<OpportunityRefreshResult> {
  await assertSuperadmin();
  const result = await refreshOpportunities();
  revalidate();
  return result;
}

const VALID = new Set(["new", "pursuing", "done", "dismissed"]);
const TERMINAL = new Set(["done", "dismissed"]);

export async function setOpportunityStatusAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();

  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  if (!id || !VALID.has(status)) return { ok: false };

  await commandDb.brandOpportunity.update({
    where: { id },
    data: { status, decidedAt: TERMINAL.has(status) ? new Date() : null },
  });

  revalidate();
  return { ok: true };
}
