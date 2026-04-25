"use server";

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function markWelcomeSeenAction() {
  const session = await requireSession();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { hasSeenAgentWelcome: true },
  });
}

export async function updateProfileAction(data: { name: string; email: string; phone: string }) {
  const session = await requireSession();

  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();
  const phone = data.phone.trim() || null;

  if (!name) throw new Error("Name is required");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Valid email required");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name, email, phone },
  });

  revalidatePath("/agent/settings");
}
