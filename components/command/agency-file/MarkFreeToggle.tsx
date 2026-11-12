"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSaleFreeOnExchangeAction } from "@/app/actions/sale-billing";

// The per-sale free grant control for the outsourced-sunset flat-£50 model. Shown
// in the Command Centre agency sales table ONLY on files the flat fee applies to
// (the page decides). Clicking flips PropertyTransaction.freeOnExchange via the
// superadmin server action; the exchange trigger honours the flag so a free sale
// never bills the £50. Optimistic, reverts on error.
export function MarkFreeToggle({ transactionId, free }: { transactionId: string; free: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(free);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !optimistic;
    setOptimistic(next);
    setError(null);
    startTransition(async () => {
      const res = await setSaleFreeOnExchangeAction({ transactionId, free: next });
      if (!res.ok) {
        setOptimistic(!next);
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={
        error ??
        (optimistic
          ? "Free at exchange. Click to charge the £50."
          : "£50 at exchange. Click to make this sale free.")
      }
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
        optimistic
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
          : "border-neutral-700 bg-neutral-800/60 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${optimistic ? "bg-emerald-400" : "bg-neutral-600"}`} />
      {optimistic ? "Free" : "£50"}
    </button>
  );
}
