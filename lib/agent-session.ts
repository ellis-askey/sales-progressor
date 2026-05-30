// lib/agent-session.ts
//
// Shared session + theme resolution for the agent surface. Used by both
// `app/agent/layout.tsx` (the working-app shell) and the (billing-chrome)
// route-group layout (which steps billing out of the working-app chrome
// onto a quieter near-document environment). Wrapped in React `cache()`
// so calling it from two layouts in the same request hits the DB once.
//
// Extracted as part of the billing-hub v2 reframe — without this shared
// helper, each layout would re-resolve session/role/theme independently,
// hitting Prisma twice per render.

import { cache } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  getAgentTheme,
  getMobileAgentTheme,
  getNightMode,
  type AgentTheme,
  type MobileAgentTheme,
} from "@/lib/agent/themes";
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";

const AGENT_ROLES = new Set<UserRole>([
  "director",
  "negotiator",
  "admin",
  "sales_progressor",
  "viewer",
]);

// Hybrid users — sales_progressor accounts that get additional powers layered
// on top of their SP role. Email allowlists live in lib/security/hybrid-emails.ts
// (edge-safe, no Node imports) so the middleware can read the same lists. Keep
// both allowlists tiny — they exist as a per-user exception, not a policy.

import { isHybridAdminEmail, isHybridSuperadminEmail } from "@/lib/security/hybrid-emails";

export function hasAdminPowers(session: Session): boolean {
  const role = session.user.role as UserRole;
  if (role === "admin" || role === "superadmin") return true;
  if (role === "sales_progressor" && isHybridAdminEmail(session.user.email)) return true;
  return false;
}

// Hybrid superadmin — same idea, one level up. Lets the listed email reach
// /command/* despite role=sales_progressor. Bypasses the 2FA step-up flow per
// product decision (single trusted user, friction trade).
export function hasSuperAdminPowers(session: Session): boolean {
  if (session.user.role === "superadmin") return true;
  if (isHybridSuperadminEmail(session.user.email)) return true;
  return false;
}

export type AgentSessionContext = {
  session: Session;
  role: UserRole;
  isInternalStaff: boolean;
  showWelcome: boolean;
  theme: AgentTheme;
  mobileTheme: MobileAgentTheme;
  nightModePref: boolean | null;
  chainDeclineNotif: string | null;
  // Agency.modeProfile — drives the conditional copy in the welcome tour.
  // Defaults to "self_progressed" if the user has no agency (shouldn't
  // happen for non-internal staff, but defensive).
  agencyModeProfile: "self_progressed" | "progressor_managed" | "mixed";
};

export const resolveAgentSession = cache(async (): Promise<AgentSessionContext> => {
  const session = await requireSession();
  const role = session.user.role as UserRole;
  if (!AGENT_ROLES.has(role)) {
    redirect("/dashboard");
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      hasSeenAgentWelcome: true,
      agentPreferences: true,
      chainDeclineNotificationAddress: true,
      chainDeclineNotificationAt: true,
      agency: { select: { modeProfile: true } },
    },
  });

  const isInternalStaff =
    role === "admin" || role === "sales_progressor" || role === "viewer";
  const showWelcome = isInternalStaff ? false : !userRecord?.hasSeenAgentWelcome;
  const theme = getAgentTheme(userRecord?.agentPreferences);
  const mobileTheme = getMobileAgentTheme(userRecord?.agentPreferences);
  const nightModePref = getNightMode(userRecord?.agentPreferences);
  const chainDeclineNotif = userRecord?.chainDeclineNotificationAddress ?? null;
  const agencyModeProfile = userRecord?.agency?.modeProfile ?? "self_progressed";

  return {
    session,
    role,
    isInternalStaff,
    showWelcome,
    theme,
    mobileTheme,
    nightModePref,
    chainDeclineNotif,
    agencyModeProfile,
  };
});

/**
 * Director-only guard. Use in the billing-chrome layout — negotiators get
 * a 404 (they hit the negotiator-billing-modal route instead). Internal
 * staff (admin / sales_progressor) don't have billing because they don't
 * own an agency that's being charged.
 */
export async function resolveDirectorSession(): Promise<AgentSessionContext> {
  const ctx = await resolveAgentSession();
  if (ctx.role !== "director") {
    // 404 keeps the route undiscoverable for non-directors rather than
    // signalling "exists but forbidden". Matches the existing /agent/billing
    // posture.
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return ctx;
}
