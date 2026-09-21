"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";

// Resolve / reopen a founder Critique note. Superadmin-gated (commandDb is a
// full-access client, so the guard lives here — Law 7 / Law 8). Fire-and-forget
// review tool: a resolved tick is all that's needed, no reply-back.

async function assertSuperadmin(): Promise<{ id: string | null; email: string | null }> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    throw new Error("Unauthorised");
  }
  return { id: session.user.id ?? null, email: session.user.email ?? null };
}

export async function setCritiqueResolvedAction(formData: FormData): Promise<{ ok: boolean }> {
  const who = await assertSuperadmin();

  const id = formData.get("id") as string;
  const resolved = formData.get("resolved") === "true";
  if (!id) return { ok: false };

  await commandDb.critiqueNote.update({
    where: { id },
    data: resolved
      ? { resolvedAt: new Date(), resolvedBy: who.email ?? who.id }
      : { resolvedAt: null, resolvedBy: null },
  });
  revalidatePath("/command/critique");
  return { ok: true };
}
