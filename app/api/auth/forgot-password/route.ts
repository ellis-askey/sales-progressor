import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const normalised = email.trim().toLowerCase();

  // Always return 200 so we don't reveal whether an account exists
  const user = await prisma.user.findUnique({ where: { email: normalised } });
  if (!user) return NextResponse.json({ ok: true });

  // Delete any existing reset token for this email
  await prisma.verificationToken.deleteMany({ where: { identifier: normalised } });

  // Create a new token valid for 1 hour
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.verificationToken.create({
    data: { identifier: normalised, token, expires },
  });

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${base}/reset-password?token=${token}&email=${encodeURIComponent(normalised)}`;

  await sendEmail({
    to: normalised,
    subject: "Reset your Sales Progressor password",
    text: `Hi,\n\nWe received a request to reset your password.\n\nClick the link below to choose a new password. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.\n\n— The Sales Progressor`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1A1D29;">
        <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 8px;">Reset your password</h2>
        <p style="font-size: 14px; color: #4A5162; margin: 0 0 24px;">We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Reset password</a>
        <p style="font-size: 12px; color: #8B91A3; margin: 24px 0 0;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
