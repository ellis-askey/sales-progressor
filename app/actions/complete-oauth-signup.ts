"use server";

import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createDirectorWithAgency } from "@/lib/auth/create-director-with-agency";
import { sendWelcomeEmailIfNotSent } from "@/lib/emails/send-welcome";
import { ATTRIBUTION_COOKIE, parseAttributionCookie } from "@/lib/analytics/attribution";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

function toTitleCase(str: string): string {
  return str.trim().replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

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
    select: { agencyId: true },
  });
  if (dbUser?.agencyId) {
    return { ok: false, error: "Signup already complete" };
  }

  const rawName = (formData.get("name") as string | null)?.trim() ?? "";
  const rawRole = formData.get("role") as string | null;
  const rawAgencyName = (formData.get("agencyName") as string | null)?.trim() ?? "";

  if (!rawName) return { ok: false, error: "Name is required" };
  if (rawRole !== "director" && rawRole !== "negotiator") {
    return { ok: false, error: "Please select a role" };
  }
  if (!rawAgencyName) return { ok: false, error: "Agency name is required" };

  const cookieStore = await cookies();
  const attribution = parseAttributionCookie(cookieStore.get(ATTRIBUTION_COOKIE)?.value);

  try {
    await createDirectorWithAgency({
      userId: session.user.id,
      name: toTitleCase(rawName),
      email: session.user.email,
      role: rawRole,
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
