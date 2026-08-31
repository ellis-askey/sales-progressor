// app/(account)/agent/account/connections/page.tsx
//
// Connections tab. A director or negotiator connects their email inbox so
// replies from solicitors and clients that relate to their sales are matched to
// files. Gated to agency users; internal staff use the Command Centre
// connections page instead. The connect + callback routes return agency users
// here (rather than the superadmin page) so the flow no longer dead-ends.

import { Suspense } from "react";
import { requireSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { AccountConnectionsCard } from "@/components/account/AccountConnectionsCard";

export default async function AccountConnectionsPage() {
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
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>Email inbox</h2>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
          Connect your email inbox so replies from solicitors and clients are matched to the right sale
          and saved on the file. We only read emails that relate to your sales, and you can disconnect at
          any time.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-[13px] text-gray-500">
            Loading…
          </div>
        }
      >
        <AccountConnectionsCard />
      </Suspense>
    </div>
  );
}
