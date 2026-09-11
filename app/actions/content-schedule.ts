"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";

// Content schedule / pipeline actions (docs/active/content-brand/SPEC.md, Phase
// 5.1). Superadmin-gated.

async function assertSuperadmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    throw new Error("Unauthorised");
  }
}

function revalidate() {
  revalidatePath("/command/content/calendar");
  revalidatePath("/command/content");
}

const STAGES = new Set(["draft", "ready", "approved", "scheduled", "published"]);

// Move a draft between pipeline stages. Clears the date unless it stays
// scheduled. "published" is reached via mark-as-posted, not here.
export async function setScheduleStatusAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();
  const id = formData.get("draftId") as string;
  const status = formData.get("status") as string;
  if (!id || !STAGES.has(status) || status === "published") return { ok: false };

  await commandDb.draftPost.update({
    where: { id },
    data: { scheduleStatus: status, ...(status === "scheduled" ? {} : { scheduledFor: null }) },
  });
  revalidate();
  return { ok: true };
}

// Schedule (or reschedule) a draft for a date. Optionally persists the edited
// text + chosen variant when called from the composer.
export async function scheduleDraftAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();
  const id = formData.get("draftId") as string;
  const dateStr = (formData.get("scheduledFor") as string) ?? "";
  if (!id || !dateStr) return { ok: false };

  const scheduledFor = new Date(dateStr);
  if (Number.isNaN(scheduledFor.getTime())) return { ok: false };

  const editedText = (formData.get("editedText") as string) ?? null;
  const chosenVariantRaw = formData.get("chosenVariant") as string | null;
  const chosenVariant = chosenVariantRaw ? Number(chosenVariantRaw) : undefined;

  await commandDb.draftPost.update({
    where: { id },
    data: {
      scheduleStatus: "scheduled",
      scheduledFor,
      ...(editedText ? { editedText } : {}),
      ...(chosenVariant ? { chosenVariant } : {}),
    },
  });
  revalidate();
  return { ok: true };
}
