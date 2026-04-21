// lib/session.ts
// Helpers for getting the current user in Server Components and Route Handlers.
// Centralises the getServerSession call so future auth changes only touch here.

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Returns the current session or redirects to /login.
 * Use in any page or server action that requires authentication.
 */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

/**
 * Returns the current session without redirecting.
 * Use when auth is optional or to conditionally render UI.
 */
export async function getSession() {
  return getServerSession(authOptions);
}
