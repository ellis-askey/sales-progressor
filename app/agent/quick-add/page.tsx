import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { QuickAddForm } from "@/components/transactions/QuickAddForm";

export default async function AgentQuickAddPage() {
  const session = await requireSession();
  if (session.user.role !== "negotiator" && session.user.role !== "director") {
    redirect("/dashboard");
  }

  return (
    <>
      <div className="glass-panel-dark relative overflow-hidden">
        <div className="relative px-6 pt-6 pb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-300/70 mb-2">
            {session.user.firmName ?? "Agent Portal"}
          </p>
          <h1 className="text-2xl font-bold text-white leading-tight">Quick add</h1>
          <p className="text-sm text-slate-400 mt-1">Log a new sale or purchase in seconds.</p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto">
        <QuickAddForm />
      </div>
    </>
  );
}
