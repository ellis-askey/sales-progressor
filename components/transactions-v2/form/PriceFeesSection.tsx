"use client";

import { useState } from "react";
import { PriceInput } from "@/components/ui/PriceInput";
import type { MemoSource } from "@/components/transactions-v2/types";
import { FieldIndicator, FieldHint } from "./FieldIndicator";
import { useSolidMode } from "@/lib/hooks/useSolidMode";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(pence: number): string {
  return "£" + Math.round(pence / 100).toLocaleString("en-GB");
}

// ── Segment toggle ────────────────────────────────────────────────────────────

function SegmentToggle({
  options, value, onChange, size = "md", isSolid = false,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  size?: "md" | "sm";
  isSolid?: boolean;
}) {
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);
  const sm = size === "sm";
  return (
    <div style={{
      display: "flex",
      gap: 2,
      padding: 2,
      borderRadius: sm ? 6 : 8,
      background: isSolid ? "rgba(15,23,42,0.05)" : "rgba(var(--agent-coral-base-rgb), 0.05)",
      border: isSolid ? "0.5px solid rgba(15,23,42,0.12)" : "0.5px solid rgba(var(--agent-coral-base-rgb), 0.14)",
      flexShrink: 0,
    }}>
      {options.map((opt) => {
        const active = opt.value === value;
        const hoveredInactive = hoveredValue === opt.value && !active;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            onMouseEnter={() => setHoveredValue(opt.value)}
            onMouseLeave={() => setHoveredValue(null)}
            style={{
              padding: sm ? "3px 8px" : "4px 10px",
              fontSize: sm ? 10 : 11,
              fontWeight: 600,
              borderRadius: sm ? 4 : 6,
              border: "none",
              background: active
                ? "rgba(255,255,255,0.92)"
                : hoveredInactive ? "rgba(255,255,255,0.65)" : "transparent",
              color: active
                ? "var(--agent-coral-deep)"
                : hoveredInactive ? "var(--agent-text-primary)" : "rgba(15,23,42,0.42)",
              cursor: "pointer",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
              transition: "background 130ms, color 130ms, box-shadow 130ms",
              whiteSpace: "nowrap",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Hero input container ──────────────────────────────────────────────────────

function HeroInputWrap({ children, row = false, isSolid = false }: { children: React.ReactNode; row?: boolean; isSolid?: boolean }) {
  return (
    <div style={{
      display: row ? "flex" : "block",
      alignItems: row ? "center" : undefined,
      gap: row ? 10 : undefined,
      background: isSolid ? "#ffffff" : "rgba(var(--agent-coral-base-rgb), 0.04)",
      border: isSolid ? "1px solid rgba(15,23,42,0.09)" : "1px solid rgba(var(--agent-coral-base-rgb), 0.15)",
      borderRadius: 12,
      padding: "10px 14px",
    }}>
      {children}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  purchasePricePence: number | null;
  priceMemoSource: MemoSource;
  agentFeeType: "amount" | "percent";
  agentFeeAmount: number | null;
  agentFeePercentStr: string;
  agentFeeVat: "inclusive" | "exclusive";
  agentFeeMemoSource: MemoSource;
  referralFee: number | null;
  brokerReferralFee: number | null;
  onPurchasePriceChange: (v: number | null) => void;
  onAgentFeeTypeChange: (v: "amount" | "percent") => void;
  onAgentFeeAmountChange: (v: number | null) => void;
  onAgentFeePercentStrChange: (v: string) => void;
  onAgentFeeVatChange: (v: "inclusive" | "exclusive") => void;
  onEdit: (field: string) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function PriceFeesSection({
  purchasePricePence, priceMemoSource,
  agentFeeType, agentFeeAmount, agentFeePercentStr, agentFeeVat, agentFeeMemoSource,
  referralFee, brokerReferralFee,
  onPurchasePriceChange, onAgentFeeTypeChange,
  onAgentFeeAmountChange, onAgentFeePercentStrChange, onAgentFeeVatChange,
  onEdit,
}: Props) {
  const isSolid = useSolidMode();

  // ── Live calculations ──────────────────────────────────────────────────────

  const pct = parseFloat(agentFeePercentStr);

  // Fee in pence before VAT (the raw percentage-derived or entered amount)
  const feeBaseP: number | null = (() => {
    if (agentFeeType === "amount") return agentFeeAmount;
    if (isNaN(pct) || pct <= 0 || !purchasePricePence) return null;
    return Math.round(purchasePricePence * pct / 100);
  })();

  // Fee including VAT
  const feeIncVatP: number | null = feeBaseP == null ? null
    : agentFeeVat === "exclusive" ? Math.round(feeBaseP * 1.2) : feeBaseP;

  // Fee excluding VAT
  const feeExVatP: number | null = feeBaseP == null ? null
    : agentFeeVat === "inclusive" ? Math.round(feeBaseP / 1.2) : feeBaseP;

  // Calc line shown beneath fee input
  const calcLine: string | null = (() => {
    if (!feeBaseP) return null;
    if (agentFeeType === "amount") {
      if (agentFeeVat === "exclusive" && feeIncVatP) return `${fmt(feeIncVatP)} total inc VAT @ 20%`;
      if (agentFeeVat === "inclusive" && feeExVatP) return `${fmt(feeExVatP)} ex VAT @ 20%`;
    } else {
      if (!purchasePricePence || isNaN(pct) || pct <= 0) return null;
      const pctStr = agentFeePercentStr;
      if (agentFeeVat === "exclusive" && feeIncVatP) {
        return `${pctStr}% of ${fmt(purchasePricePence)} = ${fmt(feeBaseP)} + VAT (${fmt(feeIncVatP)})`;
      }
      if (agentFeeVat === "inclusive") {
        return `${pctStr}% of ${fmt(purchasePricePence)} = ${fmt(feeBaseP)} inc VAT`;
      }
    }
    return null;
  })();

  // Net to agency: agent fee inc VAT + solicitor referral income + broker referral income
  const solicitorReferralIncome = referralFee ?? 0;
  const brokerReferralIncome = brokerReferralFee ?? 0;
  const netPence: number | null = feeIncVatP != null
    ? feeIncVatP + solicitorReferralIncome + brokerReferralIncome
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* G5.1 — Sale price */}
      <div>
        <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "rgba(15,23,42,0.42)", textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 4 }}>
          Sale price
          <FieldIndicator source={priceMemoSource} />
        </p>
        <HeroInputWrap isSolid={isSolid}>
          <PriceInput
            value={purchasePricePence}
            onChange={(v) => { onPurchasePriceChange(v); onEdit("purchasePricePence"); }}
            placeholder="0"
            className="price-hero-input"
          />
        </HeroInputWrap>
        <FieldHint source={priceMemoSource} />
      </div>

      {/* G5.2 — Agent fee */}
      <div>
        {/* Label row + mode toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "rgba(15,23,42,0.42)", textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 4 }}>
            Agent fee
            <span style={{ fontSize: 9, fontWeight: 400, color: "rgba(15,23,42,0.28)", textTransform: "none", letterSpacing: 0 }}>not on memos</span>
            <FieldIndicator source={agentFeeMemoSource} />
          </p>
          <SegmentToggle
            options={[
              { label: "Fixed £", value: "amount" },
              { label: "Percent %", value: "percent" },
            ]}
            value={agentFeeType}
            onChange={(v) => { onAgentFeeTypeChange(v as "amount" | "percent"); onEdit("agentFeeType"); }}
            isSolid={isSolid}
          />
        </div>

        {/* Fee input + VAT sub-toggle in same row */}
        <HeroInputWrap row isSolid={isSolid}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {agentFeeType === "amount" ? (
              <PriceInput
                value={agentFeeAmount}
                onChange={(v) => { onAgentFeeAmountChange(v); onEdit("agentFeeAmount"); }}
                placeholder="0"
                className="price-hero-input"
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="number"
                  className="price-hero-input-native"
                  value={agentFeePercentStr}
                  onChange={(e) => { onAgentFeePercentStrChange(e.target.value); onEdit("agentFeePercentStr"); }}
                  placeholder="0"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max="10"
                />
                <span style={{ fontSize: 20, fontWeight: 600, color: "rgba(15,23,42,0.45)", flexShrink: 0 }}>%</span>
              </div>
            )}
          </div>
          <SegmentToggle
            options={[
              { label: "+ VAT", value: "exclusive" },
              { label: "Inc VAT", value: "inclusive" },
            ]}
            value={agentFeeVat}
            onChange={(v) => { onAgentFeeVatChange(v as "inclusive" | "exclusive"); onEdit("agentFeeVat"); }}
            size="sm"
            isSolid={isSolid}
          />
        </HeroInputWrap>

        {/* Live calc line */}
        {calcLine && (
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(15,23,42,0.40)", textAlign: "right", lineHeight: 1.4 }}>
            {calcLine}
          </p>
        )}

        <FieldHint source={agentFeeMemoSource} notOnMemosText="Not on memos — still needed" />
      </div>

      {/* G5.3 — Net to agency strip */}
      <div style={{
        background: "rgba(16,185,129,0.06)",
        borderLeft: "2px solid rgba(16,185,129,0.45)",
        borderTop: "0.5px solid rgba(16,185,129,0.18)",
        borderRight: "0.5px solid rgba(16,185,129,0.18)",
        borderBottom: "0.5px solid rgba(16,185,129,0.18)",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
        color: "rgba(15,23,42,0.58)",
        lineHeight: 1.4,
      }}>
        <span style={{ fontWeight: 500 }}>Net to agency: </span>
        {!purchasePricePence ? (
          <span style={{ color: "rgba(15,23,42,0.35)" }}>— Add a sale price to calculate</span>
        ) : netPence == null ? (
          <span style={{ color: "rgba(15,23,42,0.35)" }}>— Add an agent fee to calculate</span>
        ) : (
          <>
            <strong style={{ color: "rgba(15,23,42,0.78)" }}>{fmt(netPence)}</strong>
            <span style={{ color: "rgba(15,23,42,0.38)", fontSize: 11 }}>
              {agentFeeVat === "exclusive" ? " inc VAT" : " (fee inc VAT)"}
            </span>
            {" on a "}
            <strong style={{ color: "rgba(15,23,42,0.78)" }}>{fmt(purchasePricePence!)}</strong>
            {" sale"}
            {solicitorReferralIncome > 0 && (
              <span style={{ color: "rgba(16,185,129,0.75)", fontSize: 11 }}>
                {" · +"}{fmt(solicitorReferralIncome)}{" solicitor referral"}
              </span>
            )}
            {brokerReferralIncome > 0 && (
              <span style={{ color: "rgba(16,185,129,0.75)", fontSize: 11 }}>
                {" · +"}{fmt(brokerReferralIncome)}{" broker referral"}
              </span>
            )}
          </>
        )}
      </div>

    </div>
  );
}
