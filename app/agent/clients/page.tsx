// app/agent/clients/page.tsx
//
// Progression-business "Clients" surface. A business OWNER manages the estate
// agents they progress sales for. Flag- and owner-gated. The client relationship
// grants NO access to that agency's transactions (see
// lib/services/progression-clients + lib/security/access-scope).

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner, getClientsOverview } from "@/lib/services/progression-clients";
import { ClientsEmptyState } from "@/components/progression/ClientsEmptyState";
import { ClientsWorkspace } from "@/components/progression/ClientsWorkspace";

export default async function AgentClientsPage() {
  if (!progressionBusinessesEnabled()) notFound();

  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  const data = await getClientsOverview(owner.businessId);

  return (
    <div className="px-5 md:px-10 pt-6 md:pt-10 pb-12" style={{ width: "100%" }}>
      {data.clients.length === 0 ? <ClientsEmptyState /> : <ClientsWorkspace data={data} />}
    </div>
  );
}
