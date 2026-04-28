import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { email, token, password } = await req.json();

  if (!email || !token || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const normalised = email.trim().toLowerCase();

  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: normalised, token } },
  });

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }
  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { identifier_token: { identifier: normalised, token } } });
    return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: normalised } });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
  await prisma.verificationToken.delete({ where: { identifier_token: { identifier: normalised, token } } });

  console.log(`[AUDIT] password_reset_completed userId=${user.id}`);

  return NextResponse.json({ ok: true });
}
