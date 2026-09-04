"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Clear the caller's own learned chase writing-style profile. Their future drafts
// go back to the standard voice, and the style is relearned from their next edits.
// Scoped to the session user, so no one can reset anyone else's.
export async function resetVoiceProfileAction(): Promise<{ ok: true }> {
  const session = await requireSession();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { chaseVoiceProfile: null, chaseVoiceProfileBuiltAt: null, chaseVoiceProfileSamples: 0 },
  });
  revalidatePath("/agent/account/profile");
  return { ok: true };
}
