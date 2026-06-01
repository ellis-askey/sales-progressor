import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkSignupLimit, rateLimitJson } from "@/lib/ratelimit";
import { createDirectorWithAgency } from "@/lib/auth/create-director-with-agency";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { sendWelcomeEmailIfNotSent } from "@/lib/emails/send-welcome";

function toTitleCase(str: string): string {
  return str.trim().replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const rl = await checkSignupLimit(ip).catch(() => ({ success: true, reset: 0, remaining: 999 }));
    if (!rl.success) {
      return NextResponse.json(rateLimitJson(rl), { status: 429 });
    }

    const { name, email, password, firmName, role, claimSignup } = await req.json();

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }

    if (!firmName?.trim()) {
      return NextResponse.json({ error: "Agency name is required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const agencyName = toTitleCase(firmName);
    const hashedPassword = await hash(password, 12);

    const { userId } = await createDirectorWithAgency({
      name: toTitleCase(name),
      email,
      password: hashedPassword,
      role: role === "director" ? "director" : "negotiator",
      agencyName,
    });

    console.log(`[AUDIT] user_registered userId=${userId}`);
    void trackServerEvent(userId, ANALYTICS_EVENTS.USER_SIGNED_UP, {
      provider: "credentials",
      agencyId: undefined,
    });
    // Fire-and-forget instant welcome. Helper handles its own errors so a
    // SendGrid hiccup never fails the signup response.
    //
    // Claim-cycle signups (POST'd from ClaimSignupForm with claimSignup:true)
    // skip this generic welcome — /api/claim fires sendClaimWelcomeIfNotSent
    // after the transaction commits, so the recipient gets the address-aware
    // claim welcome instead of the generic "add your first sale" copy. Both
    // helpers atomically stamp User.welcomeEmailSentAt, so a user can only
    // ever receive one welcome regardless.
    if (!claimSignup) {
      void sendWelcomeEmailIfNotSent(userId);
    }
    return NextResponse.json({ ok: true, id: userId }, { status: 201 });
  } catch (e: unknown) {
    // Prisma unique constraint on email — race between two simultaneous signups
    if (
      typeof e === "object" && e !== null &&
      "code" in e && (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    console.error("Register error:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
