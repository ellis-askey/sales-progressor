// /agent/settings/invoices — the business's client-invoice ledger: every invoice
// it has issued to its client agencies, with status + headline stats. Owner-gated
// (layout + here). Current-month invoices are SENT from each client's page; this
// is the record of what's gone out. Billing suite Phase 2.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { listClientInvoices } from "@/lib/progression/client-invoice-list";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { BusinessInvoicesLedger } from "@/components/progression/BusinessInvoicesLedger";

export const dynamic = "force-dynamic";

export default async function BusinessInvoicesPage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  const { invoices, stats } = await listClientInvoices(owner.businessId);

  return (
    <>
      <AccountPageHeader
        title="Invoices"
        subtitle="The invoices you've sent your client agencies, and what's outstanding."
        backLabel="Back to progression"
      />
      <BusinessInvoicesLedger invoices={invoices} stats={stats} />
    </>
  );
}
