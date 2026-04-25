"use server";

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateProfileAction(data: { name: string; email: string }) {
  const session = await requireSession();

  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();

  if (!name) throw new Error("Name is required");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Valid email required");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name, email },
  });

  revalidatePath("/agent/settings");
}
