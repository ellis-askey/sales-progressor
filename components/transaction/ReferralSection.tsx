"use client";

import { useState, useTransition } from "react";
import { saveReferralAction } from "@/app/actions/transactions";
import { PriceInput } from "@/components/ui/PriceInput";
import { LiquidToggle } from "@/components/ui/LiquidToggle";

type Firm = { id: string; name: string };

type Props = {
  transactionId: string;
  firms: Firm[];
  referredFirmId: string | null;
  referralFee: number | null;
  referralFeeReceived: boolean;
};

export function ReferralSection({ transactionId, firms, referredFirmId, referralFee, referralFeeReceived }: Props) {
  const [, startTransition]  = useTransition();
  const [firmId, setFirmId]  = useState(referredFirmId ?? "");
  const [feePence, setFeePence] = useState<number | null>(referralFee ?? null);
  const [received, setReceived] = useState(referralFeeReceived);
  const [saving, setSaving]  = useState(false);
  const [dirty, setDirty]    = useState(false);

  function markDirty() { setDirty(true); }

  function save() {
    setSaving(true);
    startTransition(async () => {
      try {
        await saveReferralAction(transactionId, {
          referredFirmId:      firmId || null,
          referralFee:         feePence,
          referralFeeReceived: received,
        });
        setDirty(false);
      } finally {
        setSaving(false);
      }
    });
  }

  const hasFirm = !!firmId;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide">
          Referral
        </h2>
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="text-xs agent-link-primary font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
      </div>

      <div className="glass-card px-5 py-4 space-y-4">
        {/* Firm picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-1.5">
            Recommended firm
          </label>
          <select
            value={firmId}
            onChange={(e) => { setFirmId(e.target.value); markDirty(); }}
            className="w-full text-sm bg-white/50 border border-white/30 rounded-lg px-3 py-2 text-slate-900/80 focus:outline-none focus:border-blue-400/60"
          >
            <option value="">None</option>
            {firms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        {hasFirm && (
          <>
            {/* Fee amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-1.5">
                Referral fee
              </label>
              <PriceInput
                value={feePence}
                onChange={(p) => { setFeePence(p); markDirty(); }}
                variant="referral"
                placeholder="0"
              />
            </div>

            {/* Received toggle */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-slate-900/70">Fee received</label>
              <span style={{ display: "inline-flex", flexShrink: 0 }}>
                <LiquidToggle
                  checked={received}
                  onChange={(next) => { setReceived(next); markDirty(); }}
                  width={44}
                  height={24}
                  color="#10b981"
                  aria-label="Fee received"
                />
              </span>
            </div>

            {/* Summary pill */}
            {feePence != null && feePence > 0 && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                received
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "bg-amber-50 text-amber-700 border border-amber-100"
              }`}>
                <span className="text-base">{received ? "✓" : "⏳"}</span>
                <span>
                  £{(feePence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} referral fee
                  {received ? " received" : " pending"}
                </span>
              </div>
            )}
          </>
        )}

        {!hasFirm && (
          <p className="text-sm text-slate-900/30 italic">No referral recorded</p>
        )}
      </div>
    </section>
  );
}
