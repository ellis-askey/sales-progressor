"use client";
// components/transaction/StatusControl.tsx

import { useState, useTransition, useRef } from "react";
import { createPortal } from "react-dom";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { changeStatusAction } from "@/app/actions/transactions";
import type { TransactionStatus } from "@prisma/client";

const STATUSES: { value: TransactionStatus; label: string }[] = [
  { value: "active",    label: "Active" },
  { value: "on_hold",   label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "withdrawn", label: "Withdrawn" },
];

const FALL_THROUGH_REASONS = [
  "Buyer withdrew",
  "Seller withdrew",
  "Chain broke",
  "Mortgage / finance issue",
  "Survey issues",
  "Gazundering (price chipped)",
  "Gazumping",
  "Solicitor delays",
  "Personal circumstances changed",
  "Other",
];

type Props = {
  transactionId: string;
  currentStatus: TransactionStatus;
};

export function StatusControl({ transactionId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen]             = useState(false);
  const [saving, setSaving]         = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [reason, setReason]         = useState("");
  const [customReason, setCustomReason] = useState("");

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  function handleOpen() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((o) => !o);
  }

  function selectStatus(next: TransactionStatus) {
    if (next === currentStatus) { setOpen(false); return; }
    setOpen(false);
    if (next === "withdrawn") {
      setReason("");
      setCustomReason("");
      setShowModal(true);
      return;
    }
    applyStatus(next, null);
  }

  function applyStatus(status: TransactionStatus, fallThroughReason: string | null) {
    setSaving(true);
    startTransition(async () => {
      try {
        await changeStatusAction(transactionId, status, fallThroughReason);
      } finally {
        setSaving(false);
      }
    });
  }

  function confirmWithdrawal() {
    const finalReason = reason === "Other" ? (customReason.trim() || "Other") : reason;
    setShowModal(false);
    applyStatus("withdrawn", finalReason || null);
  }

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={handleOpen}
          disabled={saving || isPending}
          className="flex items-center gap-1.5 group"
          title="Change status"
        >
          <StatusBadge status={currentStatus} />
          <svg className="w-3 h-3 text-slate-900/30 group-hover:text-slate-900/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && dropdownPos && createPortal(
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
            <div
              className="fixed z-[101] bg-white/90 backdrop-blur-sm border border-white/30 rounded-xl shadow-lg overflow-hidden min-w-[140px]"
              style={{ top: dropdownPos.top, left: dropdownPos.left }}
            >
              {STATUSES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => selectStatus(value)}
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
          </>,
          document.body
        )}
      </div>

      {/* ── Withdrawal reason modal ────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Mark as Withdrawn</p>
                <p className="text-xs text-slate-500">Record why this transaction fell through</p>
              </div>
            </div>

            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Reason
            </label>
            <div className="space-y-1.5 mb-4">
              {FALL_THROUGH_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                    reason === r
                      ? "border-red-300 bg-red-50 text-red-700 font-medium"
                      : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {reason === "Other" && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Specify reason
                </label>
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter the reason…"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-slate-400"
                  autoFocus
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmWithdrawal}
                disabled={!reason || (reason === "Other" && !customReason.trim())}
                className="flex-1 py-2 text-sm font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Confirm withdrawal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
