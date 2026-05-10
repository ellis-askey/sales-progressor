"use client";

import { Eye } from "@phosphor-icons/react";
import type { FormFields } from "@/components/transactions-v2/form/types";

export type MilestoneDefinitionSlim = {
  id: string;
  code: string;
  name: string;
  side: string;
  orderIndex: number;
};

type Props = {
  fields: FormFields;
  allMilestoneDefinitions: MilestoneDefinitionSlim[];
};

const NR_FREEHOLD = new Set(["VM8", "VM9", "PM12"]);
const NR_CASH = new Set(["PM5", "PM6", "PM11"]);

function isCash(purchaseType: string) {
  return purchaseType === "cash_buyer" || purchaseType === "cash_from_proceeds";
}

function getVisibleMilestones(defs: MilestoneDefinitionSlim[], fields: FormFields) {
  return defs.filter((d) => {
    if (fields.tenure === "freehold" && NR_FREEHOLD.has(d.code)) return false;
    if (isCash(fields.purchaseType) && NR_CASH.has(d.code)) return false;
    return true;
  });
}

function formatPrice(pence: number) {
  return "£" + Math.round(pence / 100).toLocaleString("en-GB");
}

function feeLabel(fields: FormFields): string | null {
  const vat = fields.agentFeeVat === "exclusive" ? " + VAT" : " inc. VAT";
  if (fields.agentFeeType === "amount" && fields.agentFeeAmount != null) {
    return formatPrice(fields.agentFeeAmount) + " fee" + vat;
  }
  if (fields.agentFeeType === "percent" && fields.agentFeePercentStr) {
    const pct = parseFloat(fields.agentFeePercentStr);
    if (!isNaN(pct) && pct > 0) return pct + "% fee" + vat;
  }
  return null;
}

function purchaseTypeLabel(pt: string) {
  if (pt === "cash_buyer") return "Cash buyer";
  if (pt === "cash_from_proceeds") return "Cash from proceeds";
  return "Mortgage";
}

export function FilePreview({ fields, allMilestoneDefinitions }: Props) {
  const address = [fields.streetAddress, fields.city, fields.postcode].filter(Boolean).join(", ");
  const milestones = getVisibleMilestones(allMilestoneDefinitions, fields);
  const visibleMs = milestones.slice(0, 5);
  const remaining = milestones.length - visibleMs.length;

  const hasAddress = address.trim().length >= 3;
  const hasPrice = fields.purchasePricePence != null && fields.purchasePricePence > 0;
  const isStage1Done = hasAddress && fields.tenure !== "" && fields.purchaseType !== "";

  const priceStr = hasPrice ? formatPrice(fields.purchasePricePence!) : null;
  const fee = feeLabel(fields);

  const vendors = fields.vendors.filter((v) => v.name.trim());
  const purchasers = fields.purchasers.filter((p) => p.name.trim());

  return (
    <div style={{
      position: "sticky",
      top: 24,
      borderRadius: 18,
      background: "rgba(255,255,255,0.62)",
      backdropFilter: "blur(20px) saturate(160%)",
      WebkitBackdropFilter: "blur(20px) saturate(160%)",
      border: "0.5px solid rgba(255,255,255,0.75)",
      boxShadow: "0 4px 24px rgba(15,23,42,0.06)",
      overflow: "hidden",
    }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "13px 16px 12px",
        borderBottom: "0.5px solid rgba(15,23,42,0.07)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Eye size={14} weight="duotone" color="var(--agent-coral-deep)" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(15,23,42,0.75)" }}>File Preview</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(5,150,105,0.08)", border: "0.5px solid rgba(5,150,105,0.2)", borderRadius: 100, padding: "3px 8px" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669", display: "inline-block", animation: "agent-pulse-dot 2s ease-in-out infinite" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", letterSpacing: "0.06em" }}>LIVE</span>
        </div>
      </div>

      <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Property */}
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 600, color: "rgba(15,23,42,0.38)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Property</p>
          {hasAddress ? (
            <p style={{ margin: "0 0 7px", fontSize: 13, fontWeight: 600, color: "rgba(15,23,42,0.85)", lineHeight: 1.4 }}>{address}</p>
          ) : (
            <p style={{ margin: "0 0 7px", fontSize: 12, color: "rgba(15,23,42,0.35)", fontStyle: "italic" }}>No address yet</p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {fields.tenure ? (
              <span style={{ fontSize: 10, fontWeight: 600, background: "rgba(var(--agent-coral-base-rgb),0.10)", color: "var(--agent-coral-deep)", borderRadius: 100, padding: "3px 8px", textTransform: "capitalize" }}>{fields.tenure}</span>
            ) : (
              <span style={{ fontSize: 10, color: "rgba(15,23,42,0.28)", borderRadius: 100, border: "0.5px dashed rgba(15,23,42,0.18)", padding: "3px 8px" }}>Tenure?</span>
            )}
            {fields.purchaseType ? (
              <span style={{ fontSize: 10, fontWeight: 600, background: "rgba(15,23,42,0.06)", color: "rgba(15,23,42,0.55)", borderRadius: 100, padding: "3px 8px" }}>
                {purchaseTypeLabel(fields.purchaseType)}
              </span>
            ) : (
              <span style={{ fontSize: 10, color: "rgba(15,23,42,0.28)", borderRadius: 100, border: "0.5px dashed rgba(15,23,42,0.18)", padding: "3px 8px" }}>Purchase type?</span>
            )}
          </div>
        </div>

        {/* Parties */}
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 600, color: "rgba(15,23,42,0.38)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Parties</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {(["Vendors", "Purchasers"] as const).map((label, i) => {
              const list = i === 0 ? vendors : purchasers;
              return (
                <div key={label} style={{ background: "rgba(255,255,255,0.5)", borderRadius: 10, border: "0.5px solid rgba(15,23,42,0.07)", padding: "8px 10px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(15,23,42,0.35)" }}>{label}</p>
                  {list.length > 0 ? list.map((c, ci) => (
                    <p key={ci} style={{ margin: 0, fontSize: 11, fontWeight: 500, color: "rgba(15,23,42,0.72)", lineHeight: 1.5 }}>{c.name}</p>
                  )) : (
                    <p style={{ margin: 0, fontSize: 11, color: "rgba(15,23,42,0.28)", fontStyle: "italic" }}>None</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Price & Fees */}
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 600, color: "rgba(15,23,42,0.38)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Price & Fees</p>
          {priceStr ? (
            <p style={{ margin: "0 0 2px", fontSize: 22, fontWeight: 700, color: "rgba(15,23,42,0.88)", letterSpacing: "-0.02em", lineHeight: 1 }}>{priceStr}</p>
          ) : (
            <p style={{ margin: "0 0 2px", fontSize: 13, color: "rgba(15,23,42,0.28)", fontStyle: "italic" }}>No price set</p>
          )}
          {fee && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(15,23,42,0.55)" }}>{fee}</p>
          )}
        </div>

        {/* Milestones preview */}
        {isStage1Done && milestones.length > 0 && (
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 600, color: "rgba(15,23,42,0.38)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Milestones ({milestones.length})</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {visibleMs.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px solid rgba(15,23,42,0.18)", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "rgba(15,23,42,0.60)", flex: 1, lineHeight: 1.3 }}>{m.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(15,23,42,0.28)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.side === "vendor" ? "V" : "P"}</span>
                </div>
              ))}
              {remaining > 0 && (
                <p style={{ margin: "2px 0 0 22px", fontSize: 10, color: "rgba(15,23,42,0.38)" }}>+ {remaining} more</p>
              )}
            </div>
          </div>
        )}

        {/* Status strip */}
        <div style={{
          borderRadius: 10,
          background: isStage1Done ? "rgba(5,150,105,0.06)" : "rgba(245,158,11,0.07)",
          border: `0.5px solid ${isStage1Done ? "rgba(5,150,105,0.18)" : "rgba(245,158,11,0.22)"}`,
          padding: "8px 12px",
          fontSize: 11,
          fontWeight: 500,
          color: isStage1Done ? "#059669" : "#92400e",
        }}>
          {isStage1Done
            ? "Fill contacts and fees when ready, then create"
            : "Complete address, tenure and purchase type to continue"
          }
        </div>

      </div>
    </div>
  );
}
