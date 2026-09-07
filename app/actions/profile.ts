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

export async function updateProfileAction(data: {
  name: string;
  email: string;
  phone: string;
  jobTitle?: string;
  directMobile?: string;
}) {
  const session = await requireSession();

  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();
  const phone = data.phone.trim() || null;
  const jobTitle = data.jobTitle?.trim() || null;
  const directMobile = data.directMobile?.trim() || null;

  if (name.length < 2) throw new Error("Name is required");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Valid email required");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name, email, phone, jobTitle, directMobile },
  });

  // Revalidate the whole /agent layout, not just the profile page: the
  // top-bar/sidebar name is DB-sourced in the layout (via resolveAgentSession),
  // so a rename only shows in the chrome once the layout re-runs.
  revalidatePath("/agent", "layout");
}
