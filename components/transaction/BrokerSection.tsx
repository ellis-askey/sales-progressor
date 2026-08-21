"use client";

import { useState, useTransition } from "react";
import { saveBrokerReferralAction } from "@/app/actions/transactions";
import { PriceInput } from "@/components/ui/PriceInput";
import { GlassCard } from "@/components/glass/GlassCard";
import { BrokerPicker, type BrokerSelection } from "@/components/brokers/BrokerPicker";

type Props = {
  transactionId: string;
  brokerFirmId: string | null;
  brokerContactId: string | null;
  brokerFirmName: string | null;
  brokerContactName: string | null;
  brokerReferralFee: number | null;
  brokerReferralFeeReceived: boolean;
  purchaserBrokerReferral: boolean;
  // 2026-08-21: when no broker is set, agents can attach one on the live file
  // so it lights up the buyer's portal card. Gated to mortgage buyers, and
  // hidden from sales_progressor (blocked from commercial data by the action).
  purchaseType?: "mortgage" | "cash_buyer" | "cash_from_proceeds" | null;
  canEdit?: boolean;
};

export function BrokerSection({
  transactionId,
  brokerFirmId,
  brokerContactId,
  brokerFirmName,
  brokerContactName,
  brokerReferralFee,
  brokerReferralFeeReceived,
  purchaserBrokerReferral,
  purchaseType,
  canEdit = true,
}: Props) {
  const [, startTransition] = useTransition();
  const [feePence, setFeePence] = useState<number | null>(brokerReferralFee);
  const [received, setReceived] = useState(brokerReferralFeeReceived);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function save() {
    setSaving(true);
    startTransition(async () => {
      try {
        await saveBrokerReferralAction(transactionId, {
          brokerFirmId,
          brokerContactId,
          brokerReferralFee: feePence,
          brokerReferralFeeReceived: received,
        });
        setDirty(false);
      } finally {
        setSaving(false);
      }
    });
  }

  if (!brokerFirmId) {
    if (canEdit && purchaseType === "mortgage") {
      return <AddBrokerControl transactionId={transactionId} />;
    }
    return null;
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide">
          Mortgage Broker
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

      {/* Design Lab: `overview-broker`. Default v22. */}
      <GlassCard glassId="overview-broker" label="Overview · Broker" defaultVariant="v22" className="px-5 py-4 space-y-4">
        {/* Broker identity */}
        <div>
          <p className="text-sm font-semibold text-slate-900/80">{brokerFirmName}</p>
          {brokerContactName && (
            <p className="text-xs text-slate-900/50 mt-0.5">{brokerContactName}</p>
          )}
          {purchaserBrokerReferral && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6,
              fontSize: 11, fontWeight: 600,
              padding: "2px 9px", borderRadius: 20,
              color: "var(--agent-success)",
              background: "var(--agent-success-bg)",
              border: "1px solid var(--agent-success-border)",
            }}>
              Purchaser referred to broker
            </span>
          )}
        </div>

        {/* Referral fee */}
        <div>
          <label className="block text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-1.5">
            Referral fee
          </label>
          <PriceInput
            value={feePence}
            onChange={(p) => { setFeePence(p); setDirty(true); }}
            variant="referral"
            placeholder="0"
          />
        </div>

        {/* Received toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm text-slate-900/70">Fee received</label>
          <button
            type="button"
            onClick={() => { setReceived((v) => !v); setDirty(true); }}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
              received ? "bg-emerald-500" : "bg-slate-200"
            }`}
            role="switch"
            aria-checked={received}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                received ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
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
              £{(feePence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} broker referral
              {received ? " received" : " pending"}
            </span>
          </div>
        )}
      </GlassCard>
    </section>
  );
}

// Attach a mortgage broker to a live file (fills the gap where a broker could
// only be set at new-sale time). Setting one lights up the buyer's portal
// broker card; ticking "referred" adds them to the portal team once confirmed.
function AddBrokerControl({ transactionId }: { transactionId: string }) {
  const [sel, setSel] = useState<BrokerSelection | null>(null);
  const [referred, setReferred] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  function save() {
    if (!sel) return;
    setSaving(true);
    startTransition(async () => {
      try {
        await saveBrokerReferralAction(transactionId, {
          brokerFirmId: sel.firmId,
          brokerContactId: sel.contactId,
          brokerReferralFee: null,
          brokerReferralFeeReceived: false,
          purchaserBrokerReferral: referred,
        });
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-3">
        Mortgage Broker
      </h2>
      <GlassCard glassId="overview-broker" label="Overview · Broker" defaultVariant="v22" className="px-5 py-4 space-y-3">
        <p className="text-xs text-slate-900/50">
          Add your recommended broker so your buyer can request a call back from their portal.
        </p>
        <BrokerPicker label="Broker" value={sel} onChange={setSel} />
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={referred}
            onChange={(e) => setReferred(e.target.checked)}
            className="w-4 h-4 accent-emerald-500"
          />
          <span className="text-sm text-slate-900/70">Referred the buyer to this broker</span>
        </label>
        <button
          onClick={save}
          disabled={!sel || saving}
          className="text-xs agent-link-primary font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save broker"}
        </button>
      </GlassCard>
    </section>
  );
}
