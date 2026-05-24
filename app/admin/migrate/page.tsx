// Admin-only one-off migration page. Bulk-adds historical in-flight sales
// from an old system: backdates createdAt, ticks completed milestones with
// real dates, auto-creates backdated comms entries, assigns to a specific SP.
// Throwaway — delete once the ~40 files are migrated. Direct URL only, no nav.

import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { MigrateSaleForm } from "./MigrateSaleForm";

export default async function MigratePage() {
  const session = await requireSession();
  if (session.user.role !== "admin") redirect("/dashboard");

  const [agencies, salesProgressors, milestoneDefs] = await Promise.all([
    prisma.agency.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { role: "sales_progressor" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.milestoneDefinition.findMany({
      orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
      select: { id: true, code: true, name: true, side: true, orderIndex: true },
    }),
  ]);

  return (
    <AppShell session={session} activePath="/admin/migrate">
      <div className="p-6 max-w-4xl mx-auto">
        <PageHeader
          title="Migrate historical sale"
          subtitle="Admin-only. Hand-enters a sale from an old system, backdates the file age and milestone history so it joins the live engine with the right state. One file at a time — submit, repeat."
        />
        <MigrateSaleForm
          agencies={agencies}
          salesProgressors={salesProgressors}
          milestoneDefs={milestoneDefs}
        />
      </div>
    </AppShell>
  );
}
