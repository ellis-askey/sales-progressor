// Ledger read for the business's client invoices (billing suite Phase 2). Lists
// the persisted ClientInvoice rows with the client agency name joined in, a
// derived display status (overdue is dueAt < now while still unpaid), and the
// headline stats. Loose scalar keys, so agency names are fetched separately.

import { prisma } from "@/lib/prisma";

export type LedgerStatus = "sent" | "paid" | "overdue" | "void";

export type LedgerInvoice = {
  id: string;
  number: string;
  agencyId: string;
  agencyName: string;
  periodLabel: string;
  totalPence: number;
  status: LedgerStatus;
  issuedAt: string;
  dueAt: string | null;
  paidAt: string | null;
  recipientEmail: string | null;
};

export type LedgerStats = { outstandingPence: number; outstandingCount: number; overduePence: number; overdueCount: number; paidThisMonthPence: number };

function periodLabel(periodKey: string): string {
  const [y, m] = periodKey.split("-").map(Number);
  if (!y || !m) return periodKey;
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export async function listClientInvoices(businessId: string, now: Date = new Date()): Promise<{ invoices: LedgerInvoice[]; stats: LedgerStats }> {
  const rows = await prisma.clientInvoice.findMany({
    where: { progressionBusinessId: businessId },
    orderBy: { issuedAt: "desc" },
    select: { id: true, number: true, agencyId: true, periodKey: true, totalPence: true, status: true, issuedAt: true, dueAt: true, paidAt: true, recipientEmail: true },
  });
  const agencyIds = Array.from(new Set(rows.map((r) => r.agencyId)));
  const agencies = agencyIds.length
    ? await prisma.agency.findMany({ where: { id: { in: agencyIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(agencies.map((a) => [a.id, a.name]));

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let outstandingPence = 0, outstandingCount = 0, overduePence = 0, overdueCount = 0, paidThisMonthPence = 0;

  const invoices: LedgerInvoice[] = rows.map((r) => {
    const overdue = r.status === "sent" && r.dueAt != null && r.dueAt.getTime() < now.getTime();
    const status: LedgerStatus = r.status === "paid" ? "paid" : r.status === "void" ? "void" : overdue ? "overdue" : "sent";
    if (status === "sent" || status === "overdue") { outstandingPence += r.totalPence; outstandingCount += 1; }
    if (status === "overdue") { overduePence += r.totalPence; overdueCount += 1; }
    if (status === "paid" && r.paidAt && r.paidAt.getTime() >= monthStart.getTime()) paidThisMonthPence += r.totalPence;
    return {
      id: r.id, number: r.number, agencyId: r.agencyId, agencyName: nameById.get(r.agencyId) ?? "Client agency",
      periodLabel: periodLabel(r.periodKey), totalPence: r.totalPence, status,
      issuedAt: r.issuedAt.toISOString(), dueAt: r.dueAt?.toISOString() ?? null, paidAt: r.paidAt?.toISOString() ?? null,
      recipientEmail: r.recipientEmail,
    };
  });

  return { invoices, stats: { outstandingPence, outstandingCount, overduePence, overdueCount, paidThisMonthPence } };
}
