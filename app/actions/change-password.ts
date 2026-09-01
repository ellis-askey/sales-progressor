"use server";

// Change the signed-in user's password. Verifies the current password with
// bcrypt (same as the login authorize in lib/auth.ts), enforces a minimum
// length, and blocks reusing the same password. Cost 12 to match how accounts
// are seeded/created.

import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function changePasswordAction(
  input: { currentPassword: string; newPassword: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const current = input.currentPassword ?? "";
  const next = input.newPassword ?? "";

  if (next.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });
  if (!user?.password) {
    return { ok: false, error: "This account doesn't use a password to sign in." };
  }

  const valid = await compare(current, user.password);
  if (!valid) {
    return { ok: false, error: "Your current password is incorrect." };
  }
  if (await compare(next, user.password)) {
    return { ok: false, error: "Choose a password different from your current one." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: await hash(next, 12) },
  });

  return { ok: true };
}
