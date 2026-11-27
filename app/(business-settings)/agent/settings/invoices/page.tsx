// /agent/settings/invoices — the business's client-invoice ledger: every invoice
// it has issued to its client agencies, with status + headline stats. Owner-gated
// (layout + here). Current-month invoices are SENT from each client's page; this
// is the record of what's gone out. Billing suite Phase 2.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { prisma } from "@/lib/prisma";
import { listClientInvoices } from "@/lib/progression/client-invoice-list";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { BusinessInvoicesLedger } from "@/components/progression/BusinessInvoicesLedger";
import { InvoiceScheduleForm } from "@/components/progression/InvoiceScheduleForm";

export const dynamic = "force-dynamic";

export default async function BusinessInvoicesPage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  const [{ invoices, stats }, biz] = await Promise.all([
    listClientInvoices(owner.businessId),
    prisma.progressionBusiness.findUnique({ where: { id: owner.businessId }, select: { invoiceAutoMonthly: true, invoiceRemindDayBefore: true } }),
  ]);

  return (
    <>
      <AccountPageHeader
        title="Invoices"
        subtitle="The invoices you've sent your client agencies, and what's outstanding."
        backLabel="Back to progression"
      />
      <InvoiceScheduleForm initialAutoMonthly={biz?.invoiceAutoMonthly ?? false} initialRemindDayBefore={biz?.invoiceRemindDayBefore ?? false} />
      <BusinessInvoicesLedger invoices={invoices} stats={stats} />
    </>
  );
}
