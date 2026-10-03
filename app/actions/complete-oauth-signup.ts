"use server";

import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createDirectorWithAgency } from "@/lib/auth/create-director-with-agency";
import { createProgressionBusinessWithOwner } from "@/lib/auth/create-progression-business-with-owner";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { sendWelcomeEmailIfNotSent } from "@/lib/emails/send-welcome";
import { ATTRIBUTION_COOKIE, parseAttributionCookie } from "@/lib/analytics/attribution";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { titleCaseKeepAcronyms } from "@/lib/utils";

// Canonical acronym-safe title-caser (lib/utils) — same reasoning as the
// register route: acronyms survive, hyphen/apostrophe segments capitalise.
const toTitleCase = titleCaseKeepAcronyms;

export async function completeOAuthSignup(formData: FormData): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, error: "Not signed in" };
  }

  if (!session.user.needsSignupCompletion) {
    return { ok: false, error: "Signup already complete" };
  }

  // Live DB check — the JWT flag may be stale in a second browser tab.
  // Without this, a double-submit could create a second Agency row.
  const { prisma } = await import("@/lib/prisma");
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agencyId: true, progressionBusinessId: true },
  });
  // Already set up as either an agency OR a progression business — a double
  // submit must not mint a second agency/business.
  if (dbUser?.agencyId || dbUser?.progressionBusinessId) {
    return { ok: false, error: "Signup already complete" };
  }

  const rawName = (formData.get("name") as string | null)?.trim() ?? "";
  const rawRole = formData.get("role") as string | null;
  const rawAgencyName = (formData.get("agencyName") as string | null)?.trim() ?? "";
  // Independent progression business signing up via OAuth. Gated server-side too
  // (never trust the client): if the flag is off, a progressor payload falls
  // through to the normal agency path. Mirrors app/api/register/route.ts.
  const isProgressor = (formData.get("accountType") as string | null) === "progressor" && progressionBusinessesEnabled();

  if (!rawName) return { ok: false, error: "Name is required" };
  if (!isProgressor && rawRole !== "director" && rawRole !== "negotiator") {
    return { ok: false, error: "Please select a role" };
  }
  if (!rawAgencyName) {
    return { ok: false, error: isProgressor ? "Business name is required" : "Agency name is required" };
  }

  const cookieStore = await cookies();
  const attribution = parseAttributionCookie(cookieStore.get(ATTRIBUTION_COOKIE)?.value);

  try {
    // Progressor path: create a bounded ProgressionBusiness + owner (updating the
    // already-created OAuth user) instead of an agency. The progressor welcome
    // (Arc S6) is deliberately NOT fired — the agent "add your first sale" copy is
    // wrong for a progressor; mirrors the password path.
    if (isProgressor) {
      const { businessId } = await createProgressionBusinessWithOwner({
        userId: session.user.id,
        name: toTitleCase(rawName),
        email: session.user.email,
        businessName: toTitleCase(rawAgencyName),
      });
      cookieStore.set(ATTRIBUTION_COOKIE, "", { path: "/", maxAge: 0 });
      console.log(`[AUDIT] oauth_signup_completed userId=${session.user.id} role=progressor-owner businessId=${businessId}`);
      void trackServerEvent(session.user.id, ANALYTICS_EVENTS.USER_SIGNED_UP, {
        provider: "oauth",
        account_type: "progressor",
        source: attribution?.source ?? null,
        marketing_distinct_id: attribution?.marketingDistinctId ?? null,
      });
      return { ok: true };
    }

    await createDirectorWithAgency({
      userId: session.user.id,
      name: toTitleCase(rawName),
      email: session.user.email,
      role: rawRole as "director" | "negotiator",
      agencyName: toTitleCase(rawAgencyName),
      attribution,
    });
    cookieStore.set(ATTRIBUTION_COOKIE, "", { path: "/", maxAge: 0 }); // consumed

    console.log(`[AUDIT] oauth_signup_completed userId=${session.user.id} role=${rawRole}`);
    // Parity with the password path (app/api/register/route.ts) — OAuth signups
    // previously never fired user_signed_up, so the top of the funnel was blind.
    void trackServerEvent(session.user.id, ANALYTICS_EVENTS.USER_SIGNED_UP, {
      provider: "oauth",
      source: attribution?.source ?? null,
      marketing_distinct_id: attribution?.marketingDistinctId ?? null,
    });
    // Fire-and-forget instant welcome — parallel path to /api/register's
    // synchronous send. The helper dedupes via welcomeEmailSentAt so a
    // theoretical concurrent caller (or a re-run of this action) can't
    // double-send.
    void sendWelcomeEmailIfNotSent(session.user.id);
    return { ok: true };
  } catch (e) {
    console.error("completeOAuthSignup error:", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
