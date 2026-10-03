import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkSignupLimit, rateLimitJson } from "@/lib/ratelimit";
import { createDirectorWithAgency } from "@/lib/auth/create-director-with-agency";
import { createProgressionBusinessWithOwner } from "@/lib/auth/create-progression-business-with-owner";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveSignupDestination } from "@/lib/auth/signup-destination";
import { createJoinRequest } from "@/lib/services/agency-join-requests";
import type { UserRole } from "@prisma/client";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { sendWelcomeEmailIfNotSent, sendProgressionWelcomeIfNotSent } from "@/lib/emails/send-welcome";
import { convertProspectFromSignup } from "@/lib/prospects/signup-convert";
import { ATTRIBUTION_COOKIE, parseAttributionCookie } from "@/lib/analytics/attribution";
import { titleCaseKeepAcronyms } from "@/lib/utils";

// Canonical acronym-safe title-caser (lib/utils): preserves typed acronyms
// ("SJD Sales Progression" stays SJD, not Sjd) and capitalises after hyphens
// and apostrophes ("Gili-Ross", "O'Neill"). The old local copy force-lowered
// everything after each word's first letter.
const toTitleCase = titleCaseKeepAcronyms;

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

    const { name, email, password, firmName, role, claimSignup, accountType } = await req.json();

    // Independent sales progressor signing up for their own bounded business.
    // Gated server-side too (never trust the client): if the flag is off, any
    // accountType=progressor payload falls through to the normal agency path.
    const isProgressor = accountType === "progressor" && progressionBusinessesEnabled();

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }

    if (!firmName?.trim()) {
      return NextResponse.json(
        { error: isProgressor ? "Business name is required" : "Agency name is required" },
        { status: 400 },
      );
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

    const attribution = parseAttributionCookie(req.cookies.get(ATTRIBUTION_COOKIE)?.value);

    // Progressor path: create a bounded ProgressionBusiness + owner instead of
    // an agency. No join-request check applies (that routes into an existing
    // agency's domain, which a progression business isn't). agencyName here is
    // the title-cased firmName field, reused as the business name.
    // NOTE: the progressor welcome email (CTA "add your first client") lands in
    // Arc S6 — we deliberately do NOT fire the agent "add your first sale"
    // welcome here, which would be the wrong copy for a progressor.
    if (isProgressor) {
      const { userId, businessId } = await createProgressionBusinessWithOwner({
        name: toTitleCase(name),
        email,
        password: hashedPassword,
        businessName: agencyName,
      });
      console.log(`[AUDIT] progression_business_registered userId=${userId} businessId=${businessId}`);
      void trackServerEvent(userId, ANALYTICS_EVENTS.USER_SIGNED_UP, {
        provider: "credentials",
        agencyId: undefined,
        source: attribution?.source ?? null,
        marketing_distinct_id: attribution?.marketingDistinctId ?? null,
      });
      // Progressor-specific welcome ("add your first client"), replacing the
      // agent welcome (whose "add your first sale / first outsourced free" copy is
      // for agencies). Fire-and-forget; the welcomeEmailSentAt guard dedupes.
      void sendProgressionWelcomeIfNotSent(userId);
      const res = NextResponse.json({ ok: true, id: userId }, { status: 201 });
      res.cookies.set(ATTRIBUTION_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }

    // Fix 8: if this work email belongs to an agency that has verified its own
    // domain, route it as a REQUEST TO JOIN that agency (pending a director's
    // approval) instead of minting a duplicate agency. Gated by
    // SIGNUP_JOIN_REQUESTS_ENABLED; a no-match / disabled falls through to the
    // normal new-agency flow below.
    const destination = await resolveSignupDestination(email);
    if (destination.kind === "join_request") {
      const requestedRole: UserRole = role === "director" ? "director" : "negotiator";
      const user = await prisma.user.create({
        data: {
          name: toTitleCase(name),
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: "viewer", // stays a no-agency viewer until a director approves
        },
        select: { id: true },
      });
      await createJoinRequest({
        requesterUserId: user.id,
        requesterEmail: email,
        requesterName: toTitleCase(name),
        agencyId: destination.agencyId,
        requestedRole,
      });
      console.log(`[AUDIT] join_request_created userId=${user.id} agencyId=${destination.agencyId}`);
      void trackServerEvent(user.id, ANALYTICS_EVENTS.USER_SIGNED_UP, {
        provider: "credentials",
        agencyId: undefined,
        source: attribution?.source ?? null,
        marketing_distinct_id: attribution?.marketingDistinctId ?? null,
      });
      const res = NextResponse.json({ ok: true, id: user.id, pending: true }, { status: 201 });
      res.cookies.set(ATTRIBUTION_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }

    const { userId, agencyId } = await createDirectorWithAgency({
      name: toTitleCase(name),
      email,
      password: hashedPassword,
      role: role === "director" ? "director" : "negotiator",
      agencyName,
      attribution,
    });

    // If this exact email is one we've been outreaching to, mark that prospect
    // converted and stop its flow. Best-effort: never let it fail the signup.
    void convertProspectFromSignup(email, agencyId).catch((err) =>
      console.error("[register] prospect signup-convert failed", err),
    );

    console.log(`[AUDIT] user_registered userId=${userId}`);
    void trackServerEvent(userId, ANALYTICS_EVENTS.USER_SIGNED_UP, {
      provider: "credentials",
      agencyId: undefined,
      source: attribution?.source ?? null,
      marketing_distinct_id: attribution?.marketingDistinctId ?? null,
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
    const res = NextResponse.json({ ok: true, id: userId }, { status: 201 });
    res.cookies.set(ATTRIBUTION_COOKIE, "", { path: "/", maxAge: 0 }); // consumed — clear it
    return res;
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
