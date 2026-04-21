"use client";
// components/transaction/StatusControl.tsx
// Inline status selector for the transaction detail page.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function changeStatus(next: TransactionStatus) {
    if (next === currentStatus) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    await fetch("/api/transactions/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId, status: next }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        className="flex items-center gap-1.5 group"
        title="Change status"
      >
        <StatusBadge status={currentStatus} />
        <svg className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-8 z-20 bg-white border border-[#e4e9f0] rounded-xl shadow-lg overflow-hidden min-w-[140px]"
               style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}>
            {STATUSES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => changeStatus(value)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                  value === currentStatus ? "font-medium text-gray-900" : "text-gray-600"
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
