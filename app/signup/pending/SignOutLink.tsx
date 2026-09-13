"use client";

import { signOut } from "next-auth/react";

export function SignOutLink() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "rgba(32,36,46,0.55)", textDecoration: "underline" }}
    >
      Sign out
    </button>
  );
}
