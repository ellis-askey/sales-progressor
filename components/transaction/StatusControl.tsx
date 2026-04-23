"use client";
// components/transaction/StatusControl.tsx
// Inline status selector for the transaction detail page.

import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { changeStatusAction } from "@/app/actions/transactions";
import type { TransactionStatus } from "@prisma/client";

const STATUSES: { value: TransactionStatus; label: string }[] = [
  { value: "active",    label: "Active" },
  { value: "on_hold",   label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "withdrawn", label: "Withdrawn" },
];

type Props = {
  transactionId: string;
  currentStatus: TransactionStatus;
};

export function StatusControl({ transactionId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function changeStatus(next: TransactionStatus) {
    if (next === currentStatus) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    startTransition(async () => {
      try {
        await changeStatusAction(transactionId, next);
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={saving || isPending}
        className="flex items-center gap-1.5 group"
        title="Change status"
      >
        <StatusBadge status={currentStatus} />
        <svg className="w-3 h-3 text-slate-900/30 group-hover:text-slate-900/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-8 z-20 bg-white/90 backdrop-blur-sm border border-white/30 rounded-xl shadow-lg overflow-hidden min-w-[140px]">
            {STATUSES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => changeStatus(value)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/40 transition-colors flex items-center gap-2 ${
                  value === currentStatus ? "font-medium text-slate-900/90" : "text-slate-900/70"
                }`}
              >
                {value === currentStatus && (
                  <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <span className={value === currentStatus ? "" : "pl-5"}>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
