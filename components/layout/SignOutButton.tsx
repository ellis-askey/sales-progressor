"use client";
// components/layout/SignOutButton.tsx

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-xs text-slate-900/40 hover:text-slate-900/70 transition-colors"
    >
      Sign out
    </button>
  );
}
