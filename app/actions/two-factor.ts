"use server";

// Two-step verification (TOTP) management for the signed-in user. Enrolment
// stores a secret (inactive) + returns a QR; enabling verifies a code, activates
// it, and mints one-time backup codes; disabling requires the password. The
// login flow (lib/auth.ts authorize) enforces the code once activated.

import QRCode from "qrcode";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import {
  generateTotpSecret,
  verifyTotp,
  otpauthURL,
  generateBackupCodes,
  hashBackupCodes,
} from "@/lib/security/totp";

export async function getTwoFactorStatus(): Promise<{ enabled: boolean; hasPassword: boolean; backupCodesRemaining: number }> {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpActivatedAt: true, totpBackupCodes: true, password: true },
  });
  return {
    enabled: !!user?.totpActivatedAt,
    hasPassword: !!user?.password,
    backupCodesRemaining: user?.totpBackupCodes.length ?? 0,
  };
}

export async function startTwoFactorEnrollment(): Promise<{ ok: true; qrDataUrl: string; secret: string } | { ok: false; error: string }> {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, totpActivatedAt: true },
  });
  if (!user?.password) return { ok: false, error: "Two-step verification needs a password sign-in on your account." };
  if (user.totpActivatedAt) return { ok: false, error: "Two-step verification is already on." };

  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: session.user.id }, data: { totpSecret: secret } });
  const qrDataUrl = await QRCode.toDataURL(otpauthURL(secret, session.user.email), { margin: 1, width: 200 });
  return { ok: true, qrDataUrl, secret };
}

export async function enableTwoFactor(input: { token: string }): Promise<{ ok: true; backupCodes: string[] } | { ok: false; error: string }> {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, totpActivatedAt: true },
  });
  if (!user?.totpSecret) return { ok: false, error: "Start setup first." };
  if (user.totpActivatedAt) return { ok: false, error: "Two-step verification is already on." };
  if (!verifyTotp(user.totpSecret, input.token ?? "")) {
    return { ok: false, error: "That code isn't right. Check your authenticator app and try again." };
  }

  const codes = generateBackupCodes();
  const hashed = await hashBackupCodes(codes);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpActivatedAt: new Date(), totpBackupCodes: hashed },
  });
  return { ok: true, backupCodes: codes };
}

export async function disableTwoFactor(input: { password: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });
  if (!user?.password) return { ok: false, error: "Password check unavailable on this account." };
  if (!(await compare(input.password ?? "", user.password))) {
    return { ok: false, error: "Your password is incorrect." };
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: null, totpActivatedAt: null, totpBackupCodes: [] },
  });
  return { ok: true };
}
