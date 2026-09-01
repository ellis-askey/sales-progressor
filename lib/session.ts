// lib/session.ts
// Helpers for getting the current user in Server Components and Route Handlers.
// Centralises the getServerSession call so future auth changes only touch here.

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  // OAuth user who hasn't completed the signup form yet — must finish before
  // accessing any part of the app. Redirect instead of throwing so the user
  // gets a clear path forward rather than a dead end.
  if (session.user.needsSignupCompletion) redirect("/signup/complete");
  return session;
}

// Use in routes that require an agency-scoped user (admin/sales_progressor have no agencyId)
export async function requireAgencySession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!session.user.agencyId) redirect("/login");
  return session;
}

export async function getSession() {
  return getServerSession(authOptions);
}

/**
 * Returns a 403 response if the current user is a viewer, otherwise null.
 * Call immediately after the 401 auth check in any mutation route handler.
 *
 * Usage:
 *   const viewerBlock = forbidViewer(session);
 *   if (viewerBlock) return viewerBlock;
 */
export function forbidViewer(session: { user: { role?: string | null } }): NextResponse | null {
  if (session.user.role === "viewer") {
    return NextResponse.json({ error: "Viewers cannot make changes" }, { status: 403 });
  }
  return null;
}
