import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { changePassword, setFormsSessionCookie, validatePasswordStrength } from "@/lib/forms/auth";
import { withFormsAuth } from "@/lib/forms/api";

export const runtime = "nodejs";

export const POST = withFormsAuth(async (req, session) => {
  const body = (await req.json().catch(() => ({}))) as {
    currentPassword?: string;
    newPassword?: string;
  };
  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";

  const strength = validatePasswordStrength(newPassword);
  if (strength) return NextResponse.json({ error: strength }, { status: 400 });

  const user = await prisma.formTenantUser.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const valid = await compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Your current password isn't right." }, { status: 400 });
  }

  const updated = await changePassword(user.id, newPassword);
  // changePassword bumps sessionVersion (signs out other devices) — re-issue
  // this device's cookie so the current session carries on seamlessly.
  await setFormsSessionCookie(updated);
  return NextResponse.json({ ok: true });
});
