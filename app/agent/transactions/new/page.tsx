import { requireSession } from "@/lib/session";
import { NewTransactionForm } from "@/components/transactions/NewTransactionForm";

export default async function AgentNewTransactionPage() {
  const session = await requireSession();

  return (
    <>
      <div className="glass-panel-dark relative overflow-hidden">
        <div className="relative px-8 pt-6 pb-7">
          <p className="glass-section-label text-label-secondary-on-dark mb-4">
            {session.user.firmName ?? "Agent Portal"}
          </p>
          <h1 className="text-2xl font-bold text-white leading-tight tracking-tight">New Transaction</h1>
          <p className="text-sm text-slate-400 mt-1">Fill in the details below to create a new property file.</p>
        </div>
      </div>

      <div className="px-8 py-7">
        <NewTransactionForm userRole={session.user.role} redirectBase="/agent/transactions" />
      </div>
    </>
  );
}
