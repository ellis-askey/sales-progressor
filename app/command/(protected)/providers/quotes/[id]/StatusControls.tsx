"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markQuoteWon,
  markQuoteLost,
  markQuoteExpired,
  reopenQuote,
  markReferralFeeCollected,
} from "@/app/actions/quote-requests";
import type { QuoteRequestStatus } from "@prisma/client";

export function StatusControls({
  id,
  status,
  saleFeePence,
  referralFeePence,
  referralFeeCollected,
  statusReason,
  statusChangedAt,
  statusChangedByName,
}: {
  id: string;
  status: QuoteRequestStatus;
  saleFeePence: number | null;
  referralFeePence: number | null;
  referralFeeCollected: boolean;
  statusReason: string | null;
  statusChangedAt: Date | null;
  statusChangedByName: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [wonSaleFee, setWonSaleFee] = useState<string>(saleFeePence ? (saleFeePence / 100).toFixed(2) : "");
  const [wonReferralFee, setWonReferralFee] = useState<string>(referralFeePence ? (referralFeePence / 100).toFixed(2) : "");
  const [wonReason, setWonReason] = useState<string>(statusReason ?? "");
  const [lostReason, setLostReason] = useState<string>(statusReason ?? "");

  function toPence(v: string): number | null {
    const n = parseFloat(v);
    if (isNaN(n) || n <= 0) return null;
    return Math.round(n * 100);
  }

  function runWon() {
    setError(null);
    const sale = toPence(wonSaleFee);
    const referral = toPence(wonReferralFee);
    startTransition(async () => {
      const r = await markQuoteWon(id, {
        saleFeePence: sale,
        referralFeePence: referral,
        reason: wonReason || null,
      });
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  function runLost() {
    setError(null);
    startTransition(async () => {
      const r = await markQuoteLost(id, { reason: lostReason || null });
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  function runExpired() {
    setError(null);
    startTransition(async () => {
      const r = await markQuoteExpired(id);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  function runReopen() {
    setError(null);
    startTransition(async () => {
      const r = await reopenQuote(id);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  function runToggleReferralCollected() {
    startTransition(async () => {
      const r = await markReferralFeeCollected(id, !referralFeeCollected);
      if (r.ok) router.refresh();
    });
  }

  if (status === "pending") {
    return (
      <div className="space-y-4">
        <div className="border border-[#14532d]/50 rounded-md bg-[#0c2418]/40 p-3">
          <p className="text-[11px] font-semibold text-[#bbf7d0] uppercase tracking-widest mb-2">Mark won</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-[10px] text-[#86efac] mb-1">Sale fee (£)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={wonSaleFee}
                onChange={(e) => {
                  setWonSaleFee(e.target.value);
                  const p = toPence(e.target.value);
                  if (p) setWonReferralFee(((p * 0.1) / 100).toFixed(2));
                }}
                placeholder="450.00"
                className="w-full bg-[#0a0a0a] border border-[#14532d]/60 rounded px-2.5 py-1.5 text-[13px] text-[#fafafa] focus:outline-none focus:border-[#22c55e] font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#86efac] mb-1">Our 10% (£)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={wonReferralFee}
                onChange={(e) => setWonReferralFee(e.target.value)}
                placeholder="45.00"
                className="w-full bg-[#0a0a0a] border border-[#14532d]/60 rounded px-2.5 py-1.5 text-[13px] text-[#fafafa] focus:outline-none focus:border-[#22c55e] font-mono"
              />
            </div>
          </div>
          <input
            type="text"
            value={wonReason}
            onChange={(e) => setWonReason(e.target.value)}
            placeholder="Optional note (e.g. how you heard it converted)"
            className="w-full bg-[#0a0a0a] border border-[#14532d]/60 rounded px-2.5 py-1.5 text-[12px] text-[#d4d4d4] focus:outline-none focus:border-[#22c55e] mb-2"
          />
          <button
            onClick={runWon}
            disabled={pending}
            className="w-full px-3 py-1.5 rounded text-[12px] font-semibold text-white transition-colors disabled:opacity-40"
            style={{ background: pending ? "#404040" : "#16a34a" }}
          >
            {pending ? "Saving…" : "Mark as won"}
          </button>
        </div>

        <div className="border border-[#7f1d1d]/50 rounded-md bg-[#2a1010]/40 p-3">
          <p className="text-[11px] font-semibold text-[#fca5a5] uppercase tracking-widest mb-2">Mark lost</p>
          <input
            type="text"
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Optional reason (e.g. client went with someone else)"
            className="w-full bg-[#0a0a0a] border border-[#7f1d1d]/60 rounded px-2.5 py-1.5 text-[12px] text-[#d4d4d4] focus:outline-none focus:border-[#dc2626] mb-2"
          />
          <button
            onClick={runLost}
            disabled={pending}
            className="w-full px-3 py-1.5 rounded text-[12px] font-semibold text-white transition-colors disabled:opacity-40"
            style={{ background: pending ? "#404040" : "#dc2626" }}
          >
            {pending ? "Saving…" : "Mark as lost"}
          </button>
        </div>

        <button
          onClick={runExpired}
          disabled={pending}
          className="w-full text-[11px] text-[#737373] hover:text-[#a3a3a3] transition-colors disabled:opacity-40"
        >
          Or mark expired (no follow-up)
        </button>

        {error && <p className="text-[11px] text-[#fca5a5]">{error}</p>}
      </div>
    );
  }

  // Won / lost / expired — show details + reopen
  return (
    <div className="space-y-3">
      {statusChangedAt && (
        <p className="text-[11px] text-[#737373]">
          {status === "won" ? "Won" : status === "lost" ? "Lost" : "Expired"}{" "}
          {statusChangedAt.toISOString().slice(0, 10)}
          {statusChangedByName && ` by ${statusChangedByName}`}
        </p>
      )}
      {statusReason && (
        <p className="text-[12px] text-[#d4d4d4] italic border-l-2 border-[#404040] pl-2.5 py-0.5">
          {statusReason}
        </p>
      )}
      {status === "won" && saleFeePence !== null && (
        <div className="grid grid-cols-2 gap-2 py-2 border-t border-b border-[#1f1f1f]">
          <div>
            <p className="text-[10px] text-[#525252] uppercase tracking-widest">Sale fee</p>
            <p className="text-[15px] font-semibold text-[#fafafa] font-mono">£{(saleFeePence / 100).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#525252] uppercase tracking-widest">Our 10%</p>
            <p className="text-[15px] font-semibold text-[#86efac] font-mono">
              £{referralFeePence ? (referralFeePence / 100).toFixed(2) : "0.00"}
            </p>
          </div>
        </div>
      )}
      {status === "won" && referralFeePence && referralFeePence > 0 && (
        <button
          onClick={runToggleReferralCollected}
          disabled={pending}
          className={`w-full px-3 py-1.5 rounded text-[12px] font-semibold transition-colors disabled:opacity-40 ${
            referralFeeCollected
              ? "bg-[#0c2418] text-[#86efac] border border-[#14532d]"
              : "bg-[#1a1a1a] text-[#d4d4d4] border border-[#404040] hover:border-[#525252]"
          }`}
        >
          {referralFeeCollected ? "✓ Referral fee collected" : "Mark referral fee collected"}
        </button>
      )}
      <button
        onClick={runReopen}
        disabled={pending}
        className="w-full text-[11px] text-[#737373] hover:text-[#a3a3a3] transition-colors disabled:opacity-40 pt-2"
      >
        Reopen (set back to pending)
      </button>
      {error && <p className="text-[11px] text-[#fca5a5]">{error}</p>}
    </div>
  );
}
