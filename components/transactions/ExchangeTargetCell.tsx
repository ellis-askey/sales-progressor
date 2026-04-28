"use client";

import { useState } from "react";
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
  const [localDate, setLocalDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  const twelveWeekTarget = new Date(createdAt);
  twelveWeekTarget.setDate(twelveWeekTarget.getDate() + 84);

  const effectiveDate = localDate ?? expectedExchangeDate;
  const todayStr = new Date().toISOString().slice(0, 10);

  async function handleDateChange(dateStr: string) {
    if (!dateStr) return;
    setSaving(true);
    const res = await fetch(`/api/transactions/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedExchangeDate: dateStr }),
    });
    if (res.ok) setLocalDate(new Date(dateStr));
    setSaving(false);
  }

  if (!effectiveDate) {
    const twelveWeekLabel = twelveWeekTarget.toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
    return (
      <div>
        {/* Label wraps the visible text + hidden native date input.
            Tapping anywhere on the label opens the iOS native date picker directly — no popup. */}
        <label
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: "pointer", display: "inline-block", position: "relative" }}
        >
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: saving ? "rgba(255,107,74,0.45)" : "rgba(255,107,74,0.85)",
            display: "flex", alignItems: "center", gap: 3,
            transition: "color 150ms",
          }}>
            {saving ? "Saving…" : "Set target"}
            {!saving && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </span>
          <input
            type="date"
            min={todayStr}
            disabled={saving}
            onChange={(e) => handleDateChange(e.target.value)}
            style={{
              position: "absolute", top: 0, left: 0,
              width: "100%", height: "100%",
              opacity: 0, cursor: "pointer",
              fontSize: 16, // prevents iOS viewport zoom on focus
            }}
          />
        </label>
        <p className="text-xs mt-0.5" style={{ color: "rgba(15,23,42,0.30)" }}>
          12-wk: {twelveWeekLabel}
        </p>
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
