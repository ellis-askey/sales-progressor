"use server";

// "Sign out of all devices": bumps the user's sessionVersion. Every JWT minted
// before (on any device, including the current one) becomes stale and is
// rejected by the jwt callback in lib/auth.ts on its next request. The caller
// then signs the current device out immediately.

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function signOutAllDevicesAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { sessionVersion: { increment: 1 } },
  });
  return { ok: true };
}
