"use client";
// components/layout/SignOutButton.tsx

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
    >
      Sign out
    </button>
  );
}
