// app/(account)/agent/account/security/page.tsx
//
// Security tab. Home for how you sign in. Change-password ships here first;
// two-step verification and active sessions land here next.

import { requireSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { ChangePasswordCard } from "@/components/account/v2/ChangePasswordCard";
import { TwoFactorCard } from "@/components/account/v2/TwoFactorCard";
import { SessionsCard } from "@/components/account/v2/SessionsCard";

export default async function AccountSecurityPage() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "director" && role !== "negotiator") notFound();

  return (
    <div
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "32px 24px 64px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>Security</h2>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
          Manage how you sign in to Sales Progressor.
        </p>
      </div>

      <ChangePasswordCard />
      <TwoFactorCard />
      <SessionsCard />
    </div>
  );
}
