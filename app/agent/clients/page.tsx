// app/agent/clients/page.tsx
//
// Progression-business "Clients" surface. A business OWNER manages the estate
// agents they progress sales for. Flag- and owner-gated. The client relationship
// grants NO access to that agency's transactions (see
// lib/services/progression-clients + lib/security/access-scope).

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner, listClientsForBusiness } from "@/lib/services/progression-clients";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { Buildings } from "@phosphor-icons/react/dist/ssr";
import { ClientsManager } from "@/components/progression/ClientsManager";
import { ClientsEmptyState } from "@/components/progression/ClientsEmptyState";

export default async function AgentClientsPage() {
  if (!progressionBusinessesEnabled()) notFound();

  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  const clients = await listClientsForBusiness(owner.businessId);

  // No clients yet: the full-width onboarding layout (hero + preview + form).
  if (clients.length === 0) {
    return (
      <div className="px-5 md:px-10 pt-6 md:pt-10 pb-12" style={{ width: "100%" }}>
        <ClientsEmptyState />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
          Clients
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "#6b7280", lineHeight: 1.5 }}>
          The estate agents you progress sales for. Each one sees only the sales you handle for them.
        </p>
      </div>

      <AccountCard
        icon={<Buildings size={18} weight="bold" />}
        title="Your client agents"
        subtitle="Add an agent to set up their login and start progressing their sales."
      >
        <ClientsManager clients={clients} />
      </AccountCard>
    </div>
  );
}
