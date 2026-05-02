"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { commandDb } from "@/lib/command/prisma";

async function assertSuperadmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") {
    throw new Error("Unauthorised");
  }
}

export async function addTopicAction(formData: FormData): Promise<void> {
  await assertSuperadmin();

  const text = (formData.get("text") as string ?? "").trim();
  if (!text) return;

  await commandDb.contentTopic.create({
    data: { text, source: "manual" },
  });

  revalidatePath("/command/content/topics");
  revalidatePath("/command/content");
}

export async function skipTopicAction(formData: FormData): Promise<void> {
  await assertSuperadmin();

  const id = formData.get("id") as string;
  if (!id) return;

  await commandDb.contentTopic.update({
    where: { id },
    data: { status: "skipped" },
  });

  revalidatePath("/command/content/topics");
  revalidatePath("/command/content");
}

export async function prioritiseTopicAction(formData: FormData): Promise<void> {
  await assertSuperadmin();

  const id = formData.get("id") as string;
  if (!id) return;

  await commandDb.contentTopic.update({
    where: { id },
    data: { priority: { increment: 1 } },
  });

  revalidatePath("/command/content/topics");
  revalidatePath("/command/content");
}

export async function deleteTopicAction(formData: FormData): Promise<void> {
  await assertSuperadmin();

  const id = formData.get("id") as string;
  if (!id) return;

  await commandDb.contentTopic.delete({ where: { id } }).catch(() => {});

  revalidatePath("/command/content/topics");
  revalidatePath("/command/content");
}

export async function restoreTopicAction(formData: FormData): Promise<void> {
  await assertSuperadmin();

  const id = formData.get("id") as string;
  if (!id) return;

  await commandDb.contentTopic.update({
    where: { id },
    data: { status: "pending" },
  });

  revalidatePath("/command/content/topics");
}
