"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { commandDb } from "@/lib/command/prisma";
import { prisma } from "@/lib/prisma";

async function assertSuperadmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") {
    throw new Error("Unauthorised");
  }
  return session;
}

export async function markAsPostedAction(formData: FormData): Promise<void> {
  await assertSuperadmin();

  const draftId = formData.get("draftId") as string;
  const editedText = (formData.get("editedText") as string ?? "").trim();
  const chosenVariant = Number(formData.get("chosenVariant") ?? 1);

  if (!draftId) return;

  const draft = await commandDb.draftPost.findUnique({ where: { id: draftId } });
  if (!draft || draft.posted) return;

  const finalText = editedText || (chosenVariant === 2 ? draft.variant2 : draft.variant1);
  const wasEdited = finalText !== draft.variant1 && finalText !== draft.variant2;

  await commandDb.draftPost.update({
    where: { id: draftId },
    data: {
      posted: true,
      postedAt: new Date(),
      editedText: finalText,
      chosenVariant,
    },
  });

  // Bridge to OutboundMessage so Outbound Log stays as single source of truth
  await prisma.outboundMessage.create({
    data: {
      channel: "linkedin", // OutboundChannel closest match for all social content
      purpose: "scheduled_post",
      status: "sent",
      type: "outbound",
      content: finalText,
      wasAiGenerated: true,
      isAutomated: false,
      editedByHuman: wasEdited,
      wasEdited,
      aiModel: draft.aiModel,
      aiPromptVersion: draft.aiPromptVersion,
      aiTokensInput: draft.aiTokensInput,
      aiTokensOutput: draft.aiTokensOutput,
      sentAt: new Date(),
      contactIds: [],
    },
  });

  revalidatePath("/command/content");
}

export async function discardDraftAction(formData: FormData): Promise<void> {
  await assertSuperadmin();

  const draftId = formData.get("draftId") as string;
  if (!draftId) return;

  await commandDb.draftPost.delete({ where: { id: draftId } }).catch(() => {});

  revalidatePath("/command/content");
}
