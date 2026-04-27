"use client";

import { useState, useRef, useEffect } from "react";
import { formatDate } from "@/lib/utils";

export function ExchangeTargetCell({
  transactionId,
  expectedExchangeDate,
  createdAt,
}: {
  transactionId: string;
  expectedExchangeDate: Date | null;
  createdAt: Date;
}) {
  const [open, setOpen] = useState(false);
  const [localDate, setLocalDate] = useState<Date | null>(null);
  const [dateInput, setDateInput] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const twelveWeekTarget = new Date(createdAt);
  twelveWeekTarget.setDate(twelveWeekTarget.getDate() + 84);

  const effectiveDate = localDate ?? expectedExchangeDate;
  const todayStr = new Date().toISOString().slice(0, 10);

  async function handleSave() {
    if (!dateInput) return;
    setSaving(true);
    const res = await fetch(`/api/transactions/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedExchangeDate: dateInput }),
    });
    if (res.ok) {
      setLocalDate(new Date(dateInput));
      setOpen(false);
      setDateInput("");
    }
    setSaving(false);
  }

  if (!effectiveDate) {
    const twelveWeekLabel = twelveWeekTarget.toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
    return (
      <div ref={ref} className="relative">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
          style={{
            background: "none", border: "none", padding: 0, cursor: "pointer",
            fontSize: 12, fontWeight: 600, color: "rgba(255,107,74,0.85)",
            display: "flex", alignItems: "center", gap: 3,
          }}
        >
          Set target
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
        <p className="text-xs mt-0.5" style={{ color: "rgba(15,23,42,0.30)" }}>
          12-wk: {twelveWeekLabel}
        </p>
        {open && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-full left-0 mt-1 z-30 bg-white rounded-xl shadow-lg border border-slate-100 p-3"
            style={{ minWidth: 210 }}
          >
            <p className="text-xs font-medium text-slate-900/60 mb-2">Predicted exchange date</p>
            <input
              type="date"
              min={todayStr}
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              autoFocus
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 mb-2"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setOpen(false); setDateInput(""); }}
                className="text-xs text-slate-900/40 hover:text-slate-900/70"
              >
                Cancel
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleSave(); }}
                disabled={!dateInput || saving}
                className="text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(effectiveDate);
  d.setHours(0, 0, 0, 0);
  const isPast = d < today;
  const weeksAway = Math.round((d.getTime() - today.getTime()) / (7 * 86400000));

  return (
    <div>
      <p className={`text-sm font-medium ${isPast ? "text-red-500" : "text-slate-900/70"}`}>
        {formatDate(effectiveDate)}
      </p>
      {isPast ? (
        <p className="text-xs mt-0.5" style={{ color: "rgba(239,68,68,0.60)" }}>Predicted date passed</p>
      ) : (
        <p className="text-xs text-slate-900/35 mt-0.5">~{weeksAway}w away</p>
      )}
    </div>
  );
}
