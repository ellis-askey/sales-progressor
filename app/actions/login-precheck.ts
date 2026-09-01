"use server";

// Login step check: verifies email+password server-side (rate-limited) and
// reports whether the account has two-step verification on, so the login form
// knows whether to ask for an authenticator code before completing sign-in.
// This does NOT sign the user in — authorize() in lib/auth.ts is still the real
// gate (and it independently enforces the TOTP code).

import { compare } from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkAuthLimit } from "@/lib/ratelimit";

export async function loginPrecheck(input: { email: string; password: string }): Promise<{ ok: boolean; needs2fa: boolean }> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0]?.trim() : null) ?? h.get("x-real-ip") ?? "unknown";

  const rl = await checkAuthLimit(ip).catch(() => ({ success: true }));
  if (!rl.success) return { ok: false, needs2fa: false };

  const email = (input.email ?? "").toLowerCase().trim();
  if (!email || !input.password) return { ok: false, needs2fa: false };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { password: true, totpActivatedAt: true },
  });
  if (!user?.password) return { ok: false, needs2fa: false };

  const valid = await compare(input.password, user.password);
  if (!valid) return { ok: false, needs2fa: false };

  return { ok: true, needs2fa: !!user.totpActivatedAt };
}
