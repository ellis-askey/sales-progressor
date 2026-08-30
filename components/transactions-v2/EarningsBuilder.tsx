"use client";

// Right-column earnings builder on the New Sale form. A live "what this file is
// worth" calculator: agent commission (editable here) + solicitor / broker
// referral income − progression cost (self-progress = free, sent-to-us = our
// outsourced fee, which is free during the 14-day trial and for free-plan
// agencies). Same net logic as the property-file Fees card — reuses
// calculateOurFee from lib/services/fees. A compact "what we'll track"
// milestone preview is tucked at the bottom.

import { useState } from "react";
import type { ClientType } from "@prisma/client";
import { PriceInput } from "@/components/ui/PriceInput";
import { calculateOurFee } from "@/lib/services/fees";
import { getVisibleMilestones, type MilestoneDefinitionSlim } from "@/components/transactions-v2/FilePreview";
import type { FormFields } from "@/components/transactions-v2/form/types";

function fmt(pence: number): string {
  return "£" + Math.round(pence / 100).toLocaleString("en-GB");
}

function Seg({ options, value, onChange, size = "md" }: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  size?: "md" | "sm";
}) {
  const sm = size === "sm";
  return (
    <div style={{ display: "flex", gap: 2, padding: 2, borderRadius: sm ? 6 : 8, background: "rgba(var(--agent-coral-base-rgb), 0.05)", border: "0.5px solid rgba(var(--agent-coral-base-rgb), 0.14)", flexShrink: 0 }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)} style={{
            padding: sm ? "3px 8px" : "4px 10px", fontSize: sm ? 10 : 11, fontWeight: 600, borderRadius: sm ? 4 : 6, border: "none",
            background: active ? "var(--nv2-surface-raised)" : "transparent",
            color: active ? "var(--agent-coral-deep)" : "var(--nv2-text-muted)",
            cursor: "pointer", boxShadow: active ? "0 1px 3px rgba(0,0,0,0.10)" : "none", whiteSpace: "nowrap",
          }}>{opt.label}</button>
        );
      })}
    </div>
  );
}

function Row({ label, value, tone }: { label: React.ReactNode; value: React.ReactNode; tone?: "income" | "cost" | "muted" }) {
  const color = tone === "income" ? "var(--agent-success)" : tone === "cost" ? "var(--agent-coral-deep)" : "var(--agent-text-secondary)";
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, fontSize: 12.5 }}>
      <span style={{ color: "var(--agent-text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

export function EarningsBuilder({
  fields, onUpdate, feeTier, legacyOutsourcedFeePence, withinTrial, allMilestoneDefinitions,
}: {
  fields: FormFields;
  onUpdate: (u: Partial<FormFields>) => void;
  feeTier: string;
  legacyOutsourcedFeePence: number | null;
  withinTrial: boolean;
  allMilestoneDefinitions: MilestoneDefinitionSlim[];
}) {
  const [showMs, setShowMs] = useState(false);
  const price = fields.purchasePricePence;

  // ── Commission ──
  const pct = parseFloat(fields.agentFeePercentStr);
  const feeBaseP: number | null =
    fields.agentFeeType === "amount"
      ? fields.agentFeeAmount
      : (isNaN(pct) || pct <= 0 || !price) ? null : Math.round(price * pct / 100);
  const feeIncVatP: number | null = feeBaseP == null ? null
    : fields.agentFeeVat === "exclusive" ? Math.round(feeBaseP * 1.2) : feeBaseP;

  // ── Referral income ──
  const solRef = fields.referralFee ?? 0;
  const brokRef = fields.brokerReferralFee ?? 0;

  // ── Progression cost ── self-progress = free; sent-to-us = our fee, but free
  // during the trial and for free-plan agencies (mirrors the property file).
  const outsourced = fields.progressedBy === "progressor";
  const chargeable = outsourced && !withinTrial && feeTier !== "free";
  const progressionCost = chargeable
    ? (calculateOurFee(feeTier as ClientType, null, price, { feeTier: feeTier as ClientType, legacyOutsourcedFeePence }).fee ?? 0)
    : 0;

  const net: number | null = feeIncVatP != null ? feeIncVatP + solRef + brokRef - progressionCost : null;

  const milestones = getVisibleMilestones(allMilestoneDefinitions, fields);

  return (
    <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
      <p className="agent-eyebrow" style={{ margin: 0 }}>What this file is worth</p>

      {/* Commission editor */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv2-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Your commission</span>
          <Seg options={[{ label: "Fixed £", value: "amount" }, { label: "Percent %", value: "percent" }]} value={fields.agentFeeType} onChange={(v) => onUpdate({ agentFeeType: v as "amount" | "percent" })} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(var(--agent-coral-base-rgb), 0.04)", border: "1px solid rgba(var(--agent-coral-base-rgb), 0.15)", borderRadius: 12, padding: "8px 12px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {fields.agentFeeType === "amount" ? (
              <PriceInput value={fields.agentFeeAmount} onChange={(v) => onUpdate({ agentFeeAmount: v })} placeholder="0" className="price-hero-input" />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input type="number" className="price-hero-input-native" value={fields.agentFeePercentStr} onChange={(e) => onUpdate({ agentFeePercentStr: e.target.value })} placeholder="0" inputMode="decimal" step="0.01" min="0" max="10" />
                <span style={{ fontSize: 20, fontWeight: 600, color: "var(--nv2-text-faint)", flexShrink: 0 }}>%</span>
              </div>
            )}
          </div>
          <Seg size="sm" options={[{ label: "+ VAT", value: "exclusive" }, { label: "Inc VAT", value: "inclusive" }]} value={fields.agentFeeVat} onChange={(v) => onUpdate({ agentFeeVat: v as "inclusive" | "exclusive" })} />
        </div>
      </div>

      {/* Breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12, borderTop: "0.5px solid var(--nv2-border-dark)" }}>
        <Row label="Commission" value={feeIncVatP != null ? `${fmt(feeIncVatP)} inc VAT` : <span style={{ color: "var(--nv2-text-ghost)" }}>—</span>} />
        {solRef > 0 && <Row label="Solicitor referral" value={`+${fmt(solRef)}`} tone="income" />}
        {brokRef > 0 && <Row label="Broker referral" value={`+${fmt(brokRef)}`} tone="income" />}
        <Row
          label={outsourced ? "Sent to us" : "Self-progress"}
          value={outsourced ? (chargeable ? `−${fmt(progressionCost)}` : "Free") : "Free"}
          tone={outsourced && chargeable ? "cost" : "muted"}
        />
      </div>

      {/* Net */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, paddingTop: 12, borderTop: "0.5px solid var(--nv2-border-dark)" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>Net to your agency</span>
        {net == null ? (
          <span style={{ fontSize: 13, color: "var(--nv2-text-ghost)" }}>{!price ? "Add a price" : "Add a commission"}</span>
        ) : (
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--agent-success)", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{fmt(net)}</span>
        )}
      </div>

      {/* Compact "what we'll track" milestone preview, tucked away */}
      {milestones.length > 0 && (
        <div style={{ paddingTop: 10, borderTop: "0.5px solid var(--nv2-border-dark)" }}>
          <button type="button" onClick={() => setShowMs((s) => !s)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11.5, color: "var(--agent-text-muted)" }}>
            <span>We&rsquo;ll track this sale through {milestones.length} steps</span>
            <span style={{ transition: "transform 200ms", transform: showMs ? "rotate(180deg)" : "none", fontSize: 10 }}>▾</span>
          </button>
          {showMs && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
              {milestones.slice(0, 8).map((m) => (
                <span key={m.id} style={{ fontSize: 10.5, color: "var(--nv2-text-secondary)", background: "var(--nv2-surface-glass)", border: "0.5px solid var(--nv2-border-dark)", borderRadius: 6, padding: "2px 7px" }}>{m.name}</span>
              ))}
              {milestones.length > 8 && <span style={{ fontSize: 10.5, color: "var(--nv2-text-muted)", padding: "2px 4px" }}>+{milestones.length - 8} more</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
