"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { captureVoiceEdit, refreshVoiceProfile, dismissCharacteristic } from "@/lib/command/content/voice-learning";

// Voice-learning actions (docs/active/content-brand/SPEC.md, Phase 3.3).
// Superadmin-gated.

async function assertSuperadmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    throw new Error("Unauthorised");
  }
}

// Called by the composer when a draft is marked posted, to learn from the edit.
// Silent (returns void) so it never interrupts the posting flow.
export async function captureVoiceEditAction(formData: FormData): Promise<void> {
  await assertSuperadmin();
  const baseline = (formData.get("baseline") as string) ?? "";
  const final = (formData.get("final") as string) ?? "";
  await captureVoiceEdit(baseline, final);
}

export async function refreshVoiceProfileAction(): Promise<{ ok: boolean; reason?: string }> {
  await assertSuperadmin();
  const res = await refreshVoiceProfile();
  revalidatePath("/command/content/voice");
  return res;
}

export async function dismissVoiceCharacteristicAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();
  const text = (formData.get("text") as string) ?? "";
  if (!text) return { ok: false };
  await dismissCharacteristic(text);
  revalidatePath("/command/content/voice");
  return { ok: true };
}
