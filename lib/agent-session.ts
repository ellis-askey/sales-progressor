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

// Hybrid users — sales_progressor accounts that also get admin-level visibility
// and functionality. Layered additively on top of the SP role: every isProgressor
// check still resolves true, but hasAdminPowers also resolves true. Keeps the SP
// daily UX (assigned-files lane, SP-shaped nav) while unlocking cross-cutting
// admin powers (see all files, assignment, paste-chat already inherited via SP).
const HYBRID_ADMIN_EMAILS = new Set<string>(["ellis@thesalesprogressor.co.uk"]);

export function hasAdminPowers(session: Session): boolean {
  const role = session.user.role as UserRole;
  if (role === "admin" || role === "superadmin") return true;
  if (role === "sales_progressor" && HYBRID_ADMIN_EMAILS.has(session.user.email ?? "")) {
    return true;
  }
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
    },
  });

  const isInternalStaff =
    role === "admin" || role === "sales_progressor" || role === "viewer";
  const showWelcome = isInternalStaff ? false : !userRecord?.hasSeenAgentWelcome;
  const theme = getAgentTheme(userRecord?.agentPreferences);
  const mobileTheme = getMobileAgentTheme(userRecord?.agentPreferences);
  const nightModePref = getNightMode(userRecord?.agentPreferences);
  const chainDeclineNotif = userRecord?.chainDeclineNotificationAddress ?? null;

  return {
    session,
    role,
    isInternalStaff,
    showWelcome,
    theme,
    mobileTheme,
    nightModePref,
    chainDeclineNotif,
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
