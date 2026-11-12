"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { invalidateAiEnabledCache } from "@/lib/ai/enabled";

// Flip the global AI master switch (#291). Superadmin-gated (commandDb is a
// full-access client, so the guard lives here — Law 8). Writes the singleton
// SystemSetting row and clears the in-process cache so the change takes effect
// immediately in this lambda; other warm lambdas pick it up within the cache TTL.
export async function setAiEnabledAction(enabled: boolean): Promise<{ ok: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) throw new Error("Unauthorised");

  const who = session.user.email ?? session.user.id ?? null;
  await commandDb.systemSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", aiEnabled: enabled, updatedBy: who },
    update: { aiEnabled: enabled, updatedBy: who },
  });
  invalidateAiEnabledCache();
  revalidatePath("/command/settings");
  return { ok: true };
}
