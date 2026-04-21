// app/transactions/new/page.tsx

import { requireSession } from "@/lib/session";
import { listAgencyUsers } from "@/lib/services/users";
import { countManualTasksDueToday } from "@/lib/services/manual-tasks";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewTransactionForm } from "@/components/transactions/NewTransactionForm";
import Link from "next/link";

export default async function NewTransactionPage() {
  const session = await requireSession();
  const [agencyUsers, todoCount] = await Promise.all([
    listAgencyUsers(session.user.agencyId),
    countManualTasksDueToday(session.user.agencyId).catch(() => 0),
  ]);

  return (
    <AppShell session={session} activePath="/transactions/new" todoCount={todoCount}>
      <PageHeader
        title="New Transaction"
        subtitle="Create a new property transaction"
        action={
          <Link
            href="/dashboard"
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            ← Back
          </Link>
        }
      />
      <div className="px-8 py-7 max-w-5xl">
        <NewTransactionForm userRole={session.user.role} />
      </div>
    </AppShell>
  );
}
