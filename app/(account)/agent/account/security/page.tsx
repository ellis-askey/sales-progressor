// app/(account)/agent/account/security/page.tsx
//
// Security tab. Home for how you sign in. Change-password ships here first;
// two-step verification and active sessions land here next.

import { requireSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { ChangePasswordCard } from "@/components/account/v2/ChangePasswordCard";
import { TwoFactorCard } from "@/components/account/v2/TwoFactorCard";
import { SessionsCard } from "@/components/account/v2/SessionsCard";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";

export default async function AccountSecurityPage() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "director" && role !== "negotiator") notFound();

  return (
    <>
      <AccountPageHeader
        title="Security"
        subtitle="Manage how you sign in to Sales Progressor."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <ChangePasswordCard />
        <TwoFactorCard />
        <SessionsCard />
      </div>
    </>
  );
}
