"use client";
// components/transaction/TransactionSidebar.tsx
// Shows purchase price, fees, progress, and exchange prediction.

function ProgressRing({ percent, onTrack }: { percent: number; onTrack: string }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const filled = circ * (percent / 100);
  const gap = circ - filled;
  const stroke =
    onTrack === "on_track" ? "#10b981" :
    onTrack === "at_risk"  ? "#f59e0b" :
    onTrack === "off_track"? "#ef4444" : "#3b82f6";

  return (
    <div className="relative flex-shrink-0 w-20 h-20">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={stroke} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${gap}`}
          strokeDashoffset="0"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-slate-900/80 leading-none">{percent}</span>
        <span className="text-[10px] text-slate-900/40 font-medium">%</span>
      </div>
    </div>
  );
}

import { useState, useTransition } from "react";
import { formatPrice, formatFee, calculateOurFee } from "@/lib/services/fees";
import { savePriceAction, saveOverrideDateAction, saveCompletionDateAction, saveAgentFeeAction } from "@/app/actions/transactions";
import { PriceInput } from "@/components/ui/PriceInput";
import type { ProgressResult } from "@/lib/services/fees";
import type { ClientType, Tenure, PurchaseType, ServiceType } from "@prisma/client";

type KeyDate = { name: string; eventDate: Date };

type Props = {
  transaction: {
    id: string;
    purchasePrice: number | null;
    tenure: Tenure | null;
    purchaseType: PurchaseType | null;
    overridePredictedDate: Date | null;
    completionDate: Date | null;
    agentFeeAmount: number | null;
    agentFeePercent: number | null;
    agentFeeIsVatInclusive: boolean | null;
  };
  assignedUser: {
    clientType: ClientType;
    legacyFee: number | null;
  } | null;
  agentUser?: { id: string; name: string; email: string; firmName: string | null } | null;
  serviceType?: ServiceType;
  progress: ProgressResult;
  keyDates?: KeyDate[];
  exchangeConfirmed?: boolean;
};

export function TransactionSidebar({ transaction, assignedUser, agentUser, serviceType, progress, keyDates = [], exchangeConfirmed = false }: Props) {
  const [isPending, startTransition] = useTransition();
  const [editingPrice, setEditingPrice] = useState(false);
  const [pricePence, setPricePence] = useState<number | null>(transaction.purchasePrice ?? null);
  const [editingOverride, setEditingOverride] = useState(false);
  const [overrideInput, setOverrideInput] = useState(
    transaction.overridePredictedDate
      ? new Date(transaction.overridePredictedDate).toISOString().split("T")[0]
      : ""
  );
  const [editingCompletion, setEditingCompletion] = useState(false);
  const [completionInput, setCompletionInput] = useState(
    transaction.completionDate
      ? new Date(transaction.completionDate).toISOString().split("T")[0]
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [editingAgentFee, setEditingAgentFee] = useState(false);
  const [agentFeeType, setAgentFeeType] = useState<"amount" | "percent">("amount");
  const [agentFeeAmountPence, setAgentFeeAmountPence] = useState<number | null>(null);
  const [agentFeePercentStr, setAgentFeePercentStr] = useState("");
  const [agentFeeVat, setAgentFeeVat] = useState<"inclusive" | "exclusive">("exclusive");

  const ourFee = assignedUser
    ? calculateOurFee(assignedUser.clientType, assignedUser.legacyFee, transaction.purchasePrice)
    : { fee: null, label: "No agent assigned" };

  function savePrice() {
    if (pricePence == null) return;
    setSaving(true);
    setEditingPrice(false);
    startTransition(async () => {
      try { await savePriceAction(transaction.id, pricePence); }
      finally { setSaving(false); }
    });
  }

  function saveOverride() {
    setSaving(true);
    setEditingOverride(false);
    startTransition(async () => {
      try { await saveOverrideDateAction(transaction.id, overrideInput || null); }
      finally { setSaving(false); }
    });
  }

  function saveCompletion() {
    setSaving(true);
    setEditingCompletion(false);
    startTransition(async () => {
      try { await saveCompletionDateAction(transaction.id, completionInput || null); }
      finally { setSaving(false); }
    });
  }

  function saveAgentFee() {
    setSaving(true);
    setEditingAgentFee(false);
    setAgentFeeAmountPence(null);
    setAgentFeePercentStr("");
    const vatInclusive = agentFeeVat === "inclusive";
    const amount = agentFeeType === "amount" ? agentFeeAmountPence : null;
    const percent = agentFeeType === "percent" ? parseFloat(agentFeePercentStr) : null;
    startTransition(async () => {
      try {
        await saveAgentFeeAction({ transactionId: transaction.id, agentFeeAmount: amount, agentFeePercent: percent, agentFeeIsVatInclusive: vatInclusive });
      } finally { setSaving(false); }
    });
  }

  const onTrackColors = {
    on_track: { bg: "bg-green-100",  text: "text-green-700",  label: "On track" },
    at_risk:  { bg: "bg-amber-100",  text: "text-amber-700",  label: "At risk" },
    off_track:{ bg: "bg-red-100",    text: "text-red-700",    label: "Off track" },
    unknown:  { bg: "bg-white/30",    text: "text-slate-900/50", label: "No data yet" },
  };
  const trackStyle = onTrackColors[progress.onTrack];

  return (
    <div className="space-y-4">

      {/* Progress card */}
      <div className="glass-card p-5">
        <p className="glass-section-label text-slate-900/40 mb-4">Progress</p>

        <div className="flex items-center gap-4">
          <ProgressRing percent={progress.percent} onTrack={progress.onTrack} />

          <div className="flex-1 space-y-2">
            <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full ${trackStyle.bg} ${trackStyle.text}`}>
              {trackStyle.label}
            </span>
            <p className="text-xs text-slate-900/40">
              {progress.weeksElapsed} week{progress.weeksElapsed !== 1 ? "s" : ""} elapsed
            </p>
          </div>
        </div>
      </div>

      {/* Exchange dates card */}
      <div className="glass-card p-5">
        <p className="glass-section-label text-slate-900/40 mb-4">Exchange Forecast</p>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-slate-900/40 mb-0.5">12-week target</p>
            <p className="text-sm font-semibold text-slate-900/90">
              {progress.twelveWeekTarget
                ? progress.twelveWeekTarget.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                : "—"}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-900/40 mb-0.5">Predicted exchange</p>
            {editingOverride ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={overrideInput}
                  onChange={(e) => setOverrideInput(e.target.value)}
                  className="glass-input px-2 py-1 text-sm"
                />
                <button onClick={saveOverride} disabled={saving || isPending}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium">Save</button>
                <button onClick={() => setEditingOverride(false)}
                  className="text-xs text-slate-900/40 hover:text-slate-900/70">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className={`text-sm font-semibold ${
                  transaction.overridePredictedDate ? "text-blue-600" : "text-slate-900/90"
                }`}>
                  {progress.predictedExchangeDate
                    ? progress.predictedExchangeDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                    : "—"}
                  {transaction.overridePredictedDate && (
                    <span className="ml-1 text-xs text-blue-500">(overridden)</span>
                  )}
                </p>
                <button onClick={() => setEditingOverride(true)}
                  className="text-xs text-slate-900/30 hover:text-slate-900/60">Edit</button>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-slate-900/40 mb-0.5">Completion date</p>
            {exchangeConfirmed ? (
              editingCompletion ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={completionInput}
                    onChange={(e) => setCompletionInput(e.target.value)}
                    className="glass-input px-2 py-1 text-sm"
                  />
                  <button onClick={saveCompletion} disabled={saving || isPending}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium">Save</button>
                  <button onClick={() => setEditingCompletion(false)}
                    className="text-xs text-slate-900/40 hover:text-slate-900/70">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-semibold ${transaction.completionDate ? "text-emerald-700" : "text-slate-900/40"}`}>
                    {transaction.completionDate
                      ? new Date(transaction.completionDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                      : "Not set"}
                  </p>
                  <button onClick={() => setEditingCompletion(true)}
                    className="text-xs text-slate-900/30 hover:text-slate-900/60">Edit</button>
                </div>
              )
            ) : (
              <p className="text-sm text-slate-900/30 italic">Set once exchange is confirmed</p>
            )}
          </div>

          {progress.weeksRemaining !== null && (
            <div>
              <p className="text-xs text-slate-900/40 mb-0.5">Weeks to exchange</p>
              <p className={`text-sm font-semibold ${
                progress.weeksRemaining < 0 ? "text-red-600" :
                progress.weeksRemaining <= 2 ? "text-amber-600" : "text-slate-900/90"
              }`}>
                {progress.weeksRemaining < 0
                  ? `${Math.abs(progress.weeksRemaining)} weeks overdue`
                  : `~${progress.weeksRemaining} weeks`}
              </p>
            </div>
          )}

          {keyDates.length > 0 && (
            <div className="pt-3 border-t border-white/20">
              <p className="glass-section-label text-slate-900/40 mb-2">Key Dates</p>
              <div className="space-y-2">
                {keyDates.map((kd) => {
                  const isPast = kd.eventDate < new Date();
                  return (
                    <div key={kd.name}>
                      <p className="text-xs text-slate-900/40 leading-snug">{kd.name}</p>
                      <p className={`text-sm font-semibold ${isPast ? "text-slate-900/40" : "text-slate-900/90"}`}>
                        {kd.eventDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        {isPast && <span className="ml-1 text-xs text-slate-900/30">(past)</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Agent card */}
      {agentUser && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="glass-section-label text-slate-900/40">Agent</p>
            {serviceType && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                serviceType === "outsourced" ? "bg-blue-100 text-blue-700" : "bg-slate-900/8 text-slate-900/60"
              }`}>
                {serviceType === "outsourced" ? "Outsourced to us" : "Self-managed"}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-900/90">{agentUser.name}</p>
          {agentUser.firmName && <p className="text-xs text-slate-900/60">{agentUser.firmName}</p>}
          <p className="text-xs text-slate-900/40 mt-0.5">{agentUser.email}</p>
        </div>
      )}

      {/* Price & fees card */}
      <div className="glass-card p-5">
        <p className="glass-section-label text-slate-900/40 mb-4">Price & Fees</p>

        <div className="space-y-3">
          {/* Purchase price */}
          <div>
            <p className="text-xs text-slate-900/40 mb-1">Purchase price</p>
            {editingPrice ? (
              <div className="flex items-center gap-2">
                <PriceInput
                  value={pricePence}
                  onChange={setPricePence}
                  size="sm"
                  className="w-32"
                />
                <button onClick={savePrice} disabled={saving || isPending || pricePence == null}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-40">Save</button>
                <button onClick={() => setEditingPrice(false)}
                  className="text-xs text-slate-900/40 hover:text-slate-900/70">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-900/90">
                  {formatPrice(transaction.purchasePrice)}
                </p>
                <button onClick={() => setEditingPrice(true)}
                  className="text-xs text-slate-900/30 hover:text-slate-900/60">Edit</button>
              </div>
            )}
          </div>

          {/* Tenure + purchase type */}
          <div className="flex items-center gap-2 flex-wrap">
            {transaction.tenure && (
              <span className="glass-subtle text-xs text-slate-900/70 px-2.5 py-0.5 font-medium capitalize">
                {transaction.tenure}
              </span>
            )}
            {transaction.purchaseType && (
              <span className="glass-subtle text-xs text-slate-900/70 px-2.5 py-0.5 font-medium capitalize">
                {transaction.purchaseType.replace("_", " ")}
              </span>
            )}
          </div>

          {/* Our fee */}
          <div className="pt-2 border-t border-white/20">
            <p className="text-xs text-slate-900/40 mb-0.5">Our fee</p>
            <p className="text-sm font-bold text-slate-900/90">{formatFee(ourFee.fee)}</p>
            <p className="text-xs text-slate-900/40">{ourFee.label}</p>
          </div>

          {/* Agent fee */}
          <div className="pt-2 border-t border-white/20">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-xs text-slate-900/40">Agent fee</p>
              {!editingAgentFee && (
                <button onClick={() => setEditingAgentFee(true)}
                  className="text-xs text-slate-900/30 hover:text-slate-900/60">
                  {transaction.agentFeeAmount || transaction.agentFeePercent ? "Edit" : "Set"}
                </button>
              )}
            </div>
            {editingAgentFee ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setAgentFeeType("amount")}
                    className={`flex-1 py-1 text-xs rounded border transition-colors ${agentFeeType === "amount" ? "bg-blue-50 border-blue-300 text-blue-700" : "border-white/30 text-slate-900/50 bg-white/30"}`}
                  >
                    Fixed £
                  </button>
                  <button
                    onClick={() => setAgentFeeType("percent")}
                    className={`flex-1 py-1 text-xs rounded border transition-colors ${agentFeeType === "percent" ? "bg-blue-50 border-blue-300 text-blue-700" : "border-white/30 text-slate-900/50 bg-white/30"}`}
                  >
                    %
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  {agentFeeType === "amount" ? (
                    <PriceInput
                      value={agentFeeAmountPence}
                      onChange={setAgentFeeAmountPence}
                      size="sm"
                      className="w-28"
                      placeholder="1,500"
                    />
                  ) : (
                    <>
                      <input
                        type="number"
                        value={agentFeePercentStr}
                        onChange={(e) => setAgentFeePercentStr(e.target.value)}
                        placeholder="e.g. 1.5"
                        inputMode="decimal"
                        className="glass-input w-24 px-2 py-1 text-sm"
                      />
                      <span className="text-xs text-slate-900/50">%</span>
                    </>
                  )}
                </div>
                <select
                  value={agentFeeVat}
                  onChange={(e) => setAgentFeeVat(e.target.value as "inclusive" | "exclusive")}
                  className="glass-input w-full px-2 py-1 text-xs"
                >
                  <option value="exclusive">+ VAT</option>
                  <option value="inclusive">Inc VAT</option>
                </select>
                <div className="flex gap-2">
                  <button onClick={saveAgentFee} disabled={saving || (agentFeeType === "amount" ? agentFeeAmountPence == null : !agentFeePercentStr)}
                    className="flex-1 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl transition-colors">
                    {saving ? "…" : "Save"}
                  </button>
                  <button onClick={() => { setEditingAgentFee(false); setAgentFeeAmountPence(null); setAgentFeePercentStr(""); }}
                    className="flex-1 py-1.5 text-xs text-slate-900/50 hover:text-slate-900/80 glass-subtle">
                    Cancel
                  </button>
                </div>
              </div>
            ) : transaction.agentFeeAmount ? (
              <p className="text-sm font-semibold text-slate-900/90">
                {formatFee(transaction.agentFeeAmount)}
                {transaction.agentFeeIsVatInclusive !== null && (
                  <span className="ml-1 text-xs text-slate-900/40">
                    {transaction.agentFeeIsVatInclusive ? "inc VAT" : "+ VAT"}
                  </span>
                )}
              </p>
            ) : transaction.agentFeePercent ? (
              <p className="text-sm font-semibold text-slate-900/90">
                {Number(transaction.agentFeePercent).toFixed(2)}%
                {transaction.agentFeeIsVatInclusive !== null && (
                  <span className="ml-1 text-xs text-slate-900/40">
                    {transaction.agentFeeIsVatInclusive ? "inc VAT" : "+ VAT"}
                  </span>
                )}
                {transaction.purchasePrice && (
                  <span className="ml-1 text-xs text-slate-900/50">
                    = {formatFee(Math.round(transaction.purchasePrice * Number(transaction.agentFeePercent) / 100))}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-slate-900/30 italic">Not set</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
