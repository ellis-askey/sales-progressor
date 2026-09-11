"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { setAutopilotLevel, refreshWeeklyPlan } from "@/lib/command/content/settings";
import { AUTOPILOT_LEVELS } from "@/lib/command/content/autopilot";

// Content settings actions (docs/active/content-brand/SPEC.md, Phase 5.2).
// Superadmin-gated.

async function assertSuperadmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    throw new Error("Unauthorised");
  }
}

const LEVELS = new Set(AUTOPILOT_LEVELS.map((l) => l.id));

export async function setAutopilotLevelAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();
  const level = formData.get("level") as string;
  if (!LEVELS.has(level as never)) return { ok: false };
  await setAutopilotLevel(level);
  revalidatePath("/command/content/calendar");
  return { ok: true };
}

export async function refreshWeeklyPlanAction(): Promise<{ ok: boolean }> {
  await assertSuperadmin();
  const res = await refreshWeeklyPlan();
  revalidatePath("/command/content/calendar");
  return res;
}
