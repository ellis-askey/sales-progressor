import { requireSession } from "@/lib/session";
import { NewTransactionForm } from "@/components/transactions/NewTransactionForm";
import Link from "next/link";

export default async function AgentNewTransactionPage() {
  const session = await requireSession();

  return (
    <>
      <div className="px-1 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">New Transaction</h1>
            <p className="text-sm text-gray-400 mt-0.5">Add a new property file</p>
          </div>
          <Link
            href="/agent/dashboard"
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            ← My Files
          </Link>
        </div>
        <NewTransactionForm userRole={session.user.role} redirectBase="/agent/transactions" />
      </div>
    </>
  );
}
