"use client";

// Inline agent-fee editor for the Fees card. Shows the fee as a normal row with
// a pencil on hover; click opens the editor in place (Fixed £ / Percentage %,
// the amount, and + VAT / Inc VAT), matching the old drawer. Saves via
// saveAgentFeeAction (which logs the change server-side). The other fees on the
// card stay read-only — they derive from the chosen partner + Partners config.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple } from "@phosphor-icons/react";
import { PriceInput } from "@/components/ui/PriceInput";
import { formatFee } from "@/lib/services/fees";
import { saveAgentFeeAction } from "@/app/actions/transactions";

function pill(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "5px 10px",
    borderRadius: 8,
    border: active ? "1.5px solid var(--agent-coral-deep)" : "0.5px solid var(--agent-border-default)",
    background: active ? "rgba(var(--agent-coral-rgb), 0.10)" : "var(--agent-surface-overlay)",
    color: active ? "var(--agent-coral-deep)" : "var(--agent-text-secondary)",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    transition: "all 150ms",
  };
}

export function AgentFeeInline({
  transactionId,
  agentFeeAmount,
  agentFeePercent,
  agentFeeIsVatInclusive,
  purchasePrice,
}: {
  transactionId: string;
  agentFeeAmount: number | null;
  agentFeePercent: number | null;
  agentFeeIsVatInclusive: boolean | null;
  purchasePrice: number | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [feeType, setFeeType] = useState<"amount" | "percent">(agentFeePercent ? "percent" : "amount");
  const [amount, setAmount] = useState<number | null>(agentFeeAmount);
  const [percent, setPercent] = useState(agentFeePercent ? String(Number(agentFeePercent).toFixed(2)) : "");
  const [vat, setVat] = useState<"inclusive" | "exclusive">(agentFeeIsVatInclusive ? "inclusive" : "exclusive");

  const displayValue = agentFeeAmount
    ? `${formatFee(agentFeeAmount)}${agentFeeIsVatInclusive === false ? " + VAT" : agentFeeIsVatInclusive === true ? " inc VAT" : ""}`
    : agentFeePercent
      ? `${Number(agentFeePercent).toFixed(2)}%${agentFeeIsVatInclusive === false ? " + VAT" : ""}${purchasePrice ? ` = ${formatFee(Math.round(purchasePrice * Number(agentFeePercent) / 100))}` : ""}`
      : "Not set";

  function open() {
    setFeeType(agentFeePercent ? "percent" : "amount");
    setAmount(agentFeeAmount);
    setPercent(agentFeePercent ? String(Number(agentFeePercent).toFixed(2)) : "");
    setVat(agentFeeIsVatInclusive ? "inclusive" : "exclusive");
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const nextAmount = feeType === "amount" ? amount : null;
    const nextPercent = feeType === "percent" ? (parseFloat(percent || "0") || null) : null;
    try {
      await saveAgentFeeAction({
        transactionId,
        agentFeeAmount: nextAmount,
        agentFeePercent: nextPercent,
        agentFeeIsVatInclusive: vat === "inclusive",
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the fee");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={open}
        className="group"
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12,
          padding: "4px 0", width: "100%", background: "none", border: "none", cursor: "pointer",
          textAlign: "left", font: "inherit",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>Agent fee</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{displayValue}</span>
          <PencilSimple size={11} weight="regular" className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
        </span>
      </button>
    );
  }

  return (
    <div style={{ padding: "6px 0" }}>
      <p style={{ fontSize: 12, color: "var(--agent-text-muted)", marginBottom: 6 }}>Agent fee</p>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <button onClick={() => setFeeType("amount")} style={pill(feeType === "amount")} disabled={saving}>Fixed £</button>
        <button onClick={() => setFeeType("percent")} style={pill(feeType === "percent")} disabled={saving}>Percentage %</button>
      </div>
      {feeType === "amount" ? (
        <PriceInput value={amount} onChange={setAmount} size="sm" className="w-full agent-focus" placeholder="1,500" disabled={saving} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number" value={percent} onChange={(e) => setPercent(e.target.value)}
            placeholder="e.g. 1.5" inputMode="decimal" disabled={saving}
            className="glass-input agent-focus text-sm px-3 py-2 rounded-lg flex-1"
          />
          <span className="text-xs text-slate-900/50">%</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button onClick={() => setVat("exclusive")} style={pill(vat === "exclusive")} disabled={saving}>+ VAT</button>
        <button onClick={() => setVat("inclusive")} style={pill(vat === "inclusive")} disabled={saving}>Inc. VAT</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-xl agent-btn-color-primary text-xs font-semibold transition-colors disabled:opacity-40">
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} disabled={saving} className="flex-1 py-2 rounded-xl text-xs text-slate-900/60 glass-subtle transition-colors disabled:opacity-40" style={{ border: "0.5px solid rgba(255,255,255,0.50)" }}>
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
