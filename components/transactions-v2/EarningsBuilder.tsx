"use client";

// Right-column earnings builder on the New Sale form. A live "what this file is
// worth" calculator: agent commission (editable here) + solicitor / broker
// referral income − progression cost (self-progress = free, sent-to-us = our
// outsourced fee, which is free for the agency's first outsourced sale — the
// `withinTrial` prop now carries that "first outsourced free" meaning — and for
// free-plan agencies). Same net logic as the property-file Fees card — reuses
// calculateOurFee from lib/services/fees.

import type { ClientType } from "@prisma/client";
import { PriceInput } from "@/components/ui/PriceInput";
import { calculateOurFee } from "@/lib/services/fees";
import { calculateClientFee, type ClientFeeModel } from "@/lib/progression/client-fees";
import { type MilestoneDefinitionSlim } from "@/components/transactions-v2/milestone-visibility";
import { useCardSurface } from "@/lib/glass/use-card-surface";
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
  const n = options.length;
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div style={{ position: "relative", display: "inline-flex", padding: 2, borderRadius: sm ? 6 : 8, background: "rgba(var(--agent-coral-base-rgb), 0.05)", border: "0.5px solid rgba(var(--agent-coral-base-rgb), 0.14)", flexShrink: 0 }}>
      {/* Sliding highlight — springs across to the active slot instead of the
          fill snapping between buttons. Equal-width slots (buttons flex:1) keep
          the translate honest. */}
      <span aria-hidden style={{
        position: "absolute", top: 2, bottom: 2, left: 2, width: `calc((100% - 4px) / ${n})`,
        transform: `translateX(${idx * 100}%)`, borderRadius: sm ? 4 : 6,
        background: "var(--nv2-surface-raised)", boxShadow: "0 1px 3px rgba(0,0,0,0.10)",
        transition: "transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      }} />
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)} style={{
            position: "relative", zIndex: 1, flex: 1,
            padding: sm ? "3px 8px" : "4px 10px", fontSize: sm ? 10 : 11, fontWeight: 600, borderRadius: sm ? 4 : 6, border: "none",
            background: "transparent",
            color: active ? "var(--agent-coral-deep)" : "var(--nv2-text-muted)",
            cursor: "pointer", whiteSpace: "nowrap", transition: "color 180ms",
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
  progressorName = null, progressorFeeModel = null, hasExternalProgressor = false,
}: {
  fields: FormFields;
  onUpdate: (u: Partial<FormFields>) => void;
  feeTier: string;
  legacyOutsourcedFeePence: number | null;
  withinTrial: boolean;
  allMilestoneDefinitions: MilestoneDefinitionSlim[];
  // Invited-agent routing: when set, the sale goes to their progression business,
  // priced off that business's per-client rate card instead of TSP's fee.
  progressorName?: string | null;
  progressorFeeModel?: ClientFeeModel | null;
  // The agency works with an external progressor (one or more). Such a sale is
  // never a TSP file, so the TSP "Sent to us / first sale free" economics never
  // apply; before a progressor is picked (multi), the cost is held, not "Free".
  hasExternalProgressor?: boolean;
}) {
  const { surfaceClass, tag } = useCardSurface("new-sale-file-worth", "New sale · File worth", "agent-glass");
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
  const onwardBrokRef = fields.onwardBrokerReferralFee ?? 0;

  // ── Progression cost ── self-progress = free. Sent to us: for an invited agent
  // it routes to their progression business and prices off that business's
  // per-client rate card; otherwise it's TSP's outsourced fee (free on the first
  // outsourced sale and for free-plan agencies).
  const outsourced = fields.progressedBy === "progressor";
  const toProgressor = outsourced && !!progressorName;
  // Agency works with an external progressor but hasn't picked one yet (multi).
  // The cost is a progressor fee we can't name/compute until they choose — never
  // TSP's "first sale free".
  const outsourcedUnpicked = outsourced && hasExternalProgressor && !progressorName;
  let progressionCost = 0;
  let costLabel = "Self-progress";
  if (toProgressor) {
    costLabel = `Sent to ${progressorName}`;
    progressionCost = calculateClientFee(progressorFeeModel ?? null, price ?? null) ?? 0;
  } else if (outsourcedUnpicked) {
    costLabel = "Outsourced";
    progressionCost = 0; // unknown until a progressor is chosen
  } else if (outsourced) {
    // TSP file (agency has no external progressor): TSP's outsourced fee, free on
    // the first outsourced sale and for free-plan agencies.
    costLabel = "Sent to us";
    const chargeable = !withinTrial && feeTier !== "free";
    progressionCost = chargeable
      ? (calculateOurFee(feeTier as ClientType, null, price, { feeTier: feeTier as ClientType, legacyOutsourcedFeePence }).fee ?? 0)
      : 0;
  }

  // A file routed to a progressor who has no rate card set yet is NOT free — show
  // "Fee not set" and hold the net until the fee is set, never a £0 that reads free.
  const feeNotSet = toProgressor && progressorFeeModel == null;

  // Hold the net while an external progressor still has to be picked — we can't
  // price the sale until we know whose rate card applies.
  const net: number | null = feeNotSet || outsourcedUnpicked || feeIncVatP == null ? null : feeIncVatP + solRef + brokRef + onwardBrokRef - progressionCost;


  return (
    <div className={surfaceClass} {...tag} style={{ borderRadius: "var(--agent-radius-xl)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* No card title — the "File worth" tab above already names this. */}

      {/* Commission editor */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv2-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Your commission</span>
          <Seg options={[{ label: "Fixed £", value: "amount" }, { label: "Percent %", value: "percent" }]} value={fields.agentFeeType} onChange={(v) => onUpdate({ agentFeeType: v as "amount" | "percent" })} />
        </div>
        <div className="nsf-commission-box" style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 12, padding: "8px 12px" }}>
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
        {onwardBrokRef > 0 && <Row label="Seller's broker referral" value={`+${fmt(onwardBrokRef)}`} tone="income" />}
        <Row
          label={costLabel}
          value={feeNotSet ? "Fee not set" : outsourcedUnpicked ? "Choose a progressor" : progressionCost > 0 ? `−${fmt(progressionCost)}` : "Free"}
          tone={feeNotSet || outsourcedUnpicked ? "muted" : progressionCost > 0 ? "cost" : "muted"}
        />
        {/* "First sale free" is a TSP offer — never for an external-progressor sale. */}
        {outsourced && !toProgressor && !hasExternalProgressor && withinTrial && feeTier !== "free" && (
          <p style={{ margin: "-2px 0 0", fontSize: 11, color: "var(--agent-coral-deep)", lineHeight: 1.4 }}>
            Your first sale is on us
          </p>
        )}
      </div>

      {/* Net */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, paddingTop: 12, borderTop: "0.5px solid var(--nv2-border-dark)" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>Net to your agency</span>
        {net == null ? (
          <span style={{ fontSize: 13, color: "var(--nv2-text-ghost)" }}>{feeNotSet ? "Fee not set" : outsourcedUnpicked ? "Choose a progressor" : !price ? "Add a price" : "Add a commission"}</span>
        ) : (
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--agent-success)", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{fmt(net)}</span>
        )}
      </div>

      {/* Compact "what we'll track" milestone preview, tucked away */}
    </div>
  );
}
