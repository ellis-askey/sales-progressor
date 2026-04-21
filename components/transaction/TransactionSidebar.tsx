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
        <circle cx="40" cy="40" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
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
        <span className="text-lg font-bold text-gray-800 leading-none">{percent}</span>
        <span className="text-[10px] text-gray-400 font-medium">%</span>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice, formatFee, calculateOurFee } from "@/lib/services/fees";
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
};

export function TransactionSidebar({ transaction, assignedUser, agentUser, serviceType, progress, keyDates = [] }: Props) {
  const router = useRouter();
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState(
    transaction.purchasePrice ? String(transaction.purchasePrice / 100) : ""
  );
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

  const ourFee = assignedUser
    ? calculateOurFee(assignedUser.clientType, assignedUser.legacyFee, transaction.purchasePrice)
    : { fee: null, label: "No agent assigned" };

  async function savePrice() {
    setSaving(true);
    const pence = Math.round(parseFloat(priceInput) * 100);
    if (isNaN(pence)) { setSaving(false); return; }
    await fetch(`/api/transactions/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: transaction.id, purchasePrice: pence }),
    });
    setSaving(false);
    setEditingPrice(false);
    router.refresh();
  }

  async function saveOverride() {
    setSaving(true);
    await fetch(`/api/transactions/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionId: transaction.id,
        overridePredictedDate: overrideInput || null,
      }),
    });
    setSaving(false);
    setEditingOverride(false);
    router.refresh();
  }

  async function saveCompletion() {
    setSaving(true);
    await fetch(`/api/transactions/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionId: transaction.id,
        completionDate: completionInput || null,
      }),
    });
    setSaving(false);
    setEditingCompletion(false);
    router.refresh();
  }

  const onTrackColors = {
    on_track: { bg: "bg-green-100",  text: "text-green-700",  label: "On track" },
    at_risk:  { bg: "bg-amber-100",  text: "text-amber-700",  label: "At risk" },
    off_track:{ bg: "bg-red-100",    text: "text-red-700",    label: "Off track" },
    unknown:  { bg: "bg-gray-100",   text: "text-gray-500",   label: "No data yet" },
  };
  const trackStyle = onTrackColors[progress.onTrack];

  return (
    <div className="space-y-4">

      {/* Progress card */}
      <div className="bg-white rounded-xl border border-[#e4e9f0] p-5"
           style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Progress</p>

        <div className="flex items-center gap-4">
          {/* Circular ring */}
          <ProgressRing percent={progress.percent} onTrack={progress.onTrack} />

          <div className="flex-1 space-y-2">
            <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${trackStyle.bg} ${trackStyle.text}`}>
              {trackStyle.label}
            </span>
            <p className="text-xs text-gray-400">
              {progress.weeksElapsed} week{progress.weeksElapsed !== 1 ? "s" : ""} elapsed
            </p>
          </div>
        </div>
      </div>

      {/* Exchange dates card */}
      <div className="bg-white rounded-xl border border-[#e4e9f0] p-5"
           style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Exchange Forecast</p>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">12-week target</p>
            <p className="text-sm font-medium text-gray-700">
              {progress.twelveWeekTarget
                ? progress.twelveWeekTarget.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                : "—"}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-0.5">Predicted exchange</p>
            {editingOverride ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={overrideInput}
                  onChange={(e) => setOverrideInput(e.target.value)}
                  className="px-2 py-1 text-sm border border-[#e4e9f0] rounded-lg focus:outline-none focus:border-blue-400"
                />
                <button onClick={saveOverride} disabled={saving}
                  className="text-xs text-blue-500 hover:text-blue-700">Save</button>
                <button onClick={() => setEditingOverride(false)}
                  className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className={`text-sm font-medium ${
                  transaction.overridePredictedDate ? "text-blue-600" : "text-gray-700"
                }`}>
                  {progress.predictedExchangeDate
                    ? progress.predictedExchangeDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                    : "—"}
                  {transaction.overridePredictedDate && (
                    <span className="ml-1 text-xs text-blue-400">(overridden)</span>
                  )}
                </p>
                <button onClick={() => setEditingOverride(true)}
                  className="text-xs text-gray-300 hover:text-gray-500">Edit</button>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-0.5">Completion date</p>
            {editingCompletion ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={completionInput}
                  onChange={(e) => setCompletionInput(e.target.value)}
                  className="px-2 py-1 text-sm border border-[#e4e9f0] rounded-lg focus:outline-none focus:border-blue-400"
                />
                <button onClick={saveCompletion} disabled={saving}
                  className="text-xs text-blue-500 hover:text-blue-700">Save</button>
                <button onClick={() => setEditingCompletion(false)}
                  className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className={`text-sm font-medium ${transaction.completionDate ? "text-emerald-600" : "text-gray-400"}`}>
                  {transaction.completionDate
                    ? new Date(transaction.completionDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                    : "Not set"}
                </p>
                <button onClick={() => setEditingCompletion(true)}
                  className="text-xs text-gray-300 hover:text-gray-500">Edit</button>
              </div>
            )}
          </div>

          {progress.weeksRemaining !== null && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Weeks to exchange</p>
              <p className={`text-sm font-medium ${
                progress.weeksRemaining < 0 ? "text-red-600" :
                progress.weeksRemaining <= 2 ? "text-amber-600" : "text-gray-700"
              }`}>
                {progress.weeksRemaining < 0
                  ? `${Math.abs(progress.weeksRemaining)} weeks overdue`
                  : `~${progress.weeksRemaining} weeks`}
              </p>
            </div>
          )}

          {keyDates.length > 0 && (
            <div className="pt-3 border-t border-[#f0f4f8]">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Key Dates</p>
              <div className="space-y-2">
                {keyDates.map((kd) => {
                  const isPast = kd.eventDate < new Date();
                  return (
                    <div key={kd.name}>
                      <p className="text-xs text-gray-400 leading-snug">{kd.name}</p>
                      <p className={`text-sm font-medium ${isPast ? "text-gray-400" : "text-gray-700"}`}>
                        {kd.eventDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        {isPast && <span className="ml-1 text-xs text-gray-300">(past)</span>}
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
        <div className="bg-white rounded-xl border border-[#e4e9f0] p-5"
             style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Agent</p>
            {serviceType && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                serviceType === "outsourced" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
              }`}>
                {serviceType === "outsourced" ? "Outsourced to us" : "Self-managed"}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-800">{agentUser.name}</p>
          {agentUser.firmName && <p className="text-xs text-gray-500">{agentUser.firmName}</p>}
          <p className="text-xs text-gray-400 mt-0.5">{agentUser.email}</p>
        </div>
      )}

      {/* Price & fees card */}
      <div className="bg-white rounded-xl border border-[#e4e9f0] p-5"
           style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Price & Fees</p>

        <div className="space-y-3">
          {/* Purchase price */}
          <div>
            <p className="text-xs text-gray-400 mb-1">Purchase price</p>
            {editingPrice ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">£</span>
                <input
                  type="number"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="e.g. 325000"
                  className="w-32 px-2 py-1 text-sm border border-[#e4e9f0] rounded-lg focus:outline-none focus:border-blue-400"
                />
                <button onClick={savePrice} disabled={saving}
                  className="text-xs text-blue-500 hover:text-blue-700 font-medium">Save</button>
                <button onClick={() => setEditingPrice(false)}
                  className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-800">
                  {formatPrice(transaction.purchasePrice)}
                </p>
                <button onClick={() => setEditingPrice(true)}
                  className="text-xs text-gray-300 hover:text-gray-500">Edit</button>
              </div>
            )}
          </div>

          {/* Tenure + purchase type */}
          <div className="flex items-center gap-2 flex-wrap">
            {transaction.tenure && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                {transaction.tenure}
              </span>
            )}
            {transaction.purchaseType && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                {transaction.purchaseType.replace("_", " ")}
              </span>
            )}
          </div>

          {/* Our fee */}
          <div className="pt-2 border-t border-[#f0f4f8]">
            <p className="text-xs text-gray-400 mb-0.5">Our fee</p>
            <p className="text-sm font-semibold text-gray-800">{formatFee(ourFee.fee)}</p>
            <p className="text-xs text-gray-400">{ourFee.label}</p>
          </div>

          {/* Agent fee */}
          {(transaction.agentFeeAmount || transaction.agentFeePercent) && (
            <div className="pt-2 border-t border-[#f0f4f8]">
              <p className="text-xs text-gray-400 mb-0.5">Agent fee</p>
              {transaction.agentFeeAmount ? (
                <p className="text-sm font-medium text-gray-700">
                  {formatFee(transaction.agentFeeAmount)}
                  {transaction.agentFeeIsVatInclusive !== null && (
                    <span className="ml-1 text-xs text-gray-400">
                      {transaction.agentFeeIsVatInclusive ? "inc VAT" : "+ VAT"}
                    </span>
                  )}
                </p>
              ) : transaction.agentFeePercent ? (
                <p className="text-sm font-medium text-gray-700">
                  {Number(transaction.agentFeePercent).toFixed(2)}%
                  {transaction.agentFeeIsVatInclusive !== null && (
                    <span className="ml-1 text-xs text-gray-400">
                      {transaction.agentFeeIsVatInclusive ? "inc VAT" : "+ VAT"}
                    </span>
                  )}
                  {transaction.purchasePrice && (
                    <span className="ml-1 text-xs text-gray-500">
                      = {formatFee(Math.round(transaction.purchasePrice * Number(transaction.agentFeePercent) / 100))}
                    </span>
                  )}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
