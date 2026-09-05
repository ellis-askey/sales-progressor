import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { buildPasswordReset } from "@/lib/emails/password-reset";
import { checkAuthLimit, rateLimitJson } from "@/lib/ratelimit";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "unknown";

  const rateLimit = await checkAuthLimit(ip).catch(() => ({ success: true, reset: 0, remaining: 5 }));
  if (!rateLimit.success) {
    console.log(`[AUDIT] password_reset_rate_limited ip=${ip}`);
    return NextResponse.json(rateLimitJson(rateLimit), { status: 429 });
  }

  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const normalised = email.trim().toLowerCase();

  console.log(`[AUDIT] password_reset_requested email=${normalised} ip=${ip}`);

  // Always return 200 so we don't reveal whether an account exists
  const user = await prisma.user.findUnique({
    where: { email: normalised },
  });
  if (!user) return NextResponse.json({ ok: true });

  // Delete any existing reset token for this email
  await prisma.verificationToken.deleteMany({ where: { identifier: normalised } });

  // Create a new token valid for 1 hour
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.verificationToken.create({
    data: { identifier: normalised, token, expires },
  });

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host  = req.headers.get("host") ?? "";
  const base  = host ? `${proto}://${host}` : (process.env.NEXTAUTH_URL ?? "http://localhost:3000");
  const resetUrl = `${base}/reset-password?token=${token}&email=${encodeURIComponent(normalised)}`;

  try {
    // Redesigned lifecycle template. Redacted kind: the body carries a live
    // reset link, so sendAgentEmail stores kind + subject + recipient only.
    // Account/security email — always from Sales Progressor (not the agency),
    // reply-to support@ so a locked-out user can reach a person.
    const built = buildPasswordReset({ resetUrl });
    await sendAgentEmail({
      to: normalised,
      kind: "password_reset",
      userId: user.id,
      agencyId: user.agencyId,
      subject: built.subject,
      text: built.text,
      html: built.html,
      replyTo: "support@thesalesprogressor.co.uk",
    });
  } catch (err) {
    console.error("[ERROR] forgot-password: sendAgentEmail failed", err);
    return NextResponse.json({ error: "Failed to send reset email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
