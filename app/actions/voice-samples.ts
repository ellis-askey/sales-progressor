"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { commandDb } from "@/lib/command/prisma";
import { VOICE_QUESTIONS } from "@/lib/command/content/voice-questions";

async function assertSuperadmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") {
    throw new Error("Unauthorised");
  }
}

export async function saveVoiceSamplesAction(formData: FormData): Promise<void> {
  await assertSuperadmin();

  const records = VOICE_QUESTIONS.map((q) => ({
    sampleType: "qa_response" as const,
    questionKey: q.key,
    content: (formData.get(q.key) as string ?? "").trim(),
  })).filter((r) => r.content.length > 0);

  if (records.length === 0) {
    redirect("/command/content?error=empty");
  }

  await commandDb.voiceSample.createMany({ data: records });

  redirect("/command/content");
}

export async function addVoiceSampleAction(formData: FormData): Promise<void> {
  await assertSuperadmin();

  const content = (formData.get("content") as string ?? "").trim();
  const notes = (formData.get("notes") as string ?? "").trim() || null;

  if (!content) {
    redirect("/command/content/voice?error=empty");
  }

  await commandDb.voiceSample.create({
    data: {
      sampleType: "manual_paste",
      content,
      notes,
    },
  });

  revalidatePath("/command/content/voice");
}

export async function deleteVoiceSampleAction(formData: FormData): Promise<void> {
  await assertSuperadmin();

  const id = formData.get("id") as string;
  if (!id) return;

  await commandDb.voiceSample.delete({ where: { id } }).catch(() => {});

  revalidatePath("/command/content/voice");
  revalidatePath("/command/content");
}
