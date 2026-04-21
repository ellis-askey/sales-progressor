"use client";
// components/layout/SessionProvider.tsx
// Thin wrapper so the root layout (a server component) can pass
// the session to NextAuth's client-side SessionProvider.

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

export function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  );
}
