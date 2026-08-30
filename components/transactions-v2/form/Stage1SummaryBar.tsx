"use client";

import { Pill } from "@/components/ui/Pill";

type Props = {
  streetAddress: string;
  city: string;
  postcode: string;
  tenure: "freehold" | "leasehold" | "";
  purchaseType: "mortgage" | "cash_buyer" | "cash_from_proceeds" | "";
  progressedBy: "agent" | "progressor";
  onEdit: () => void;
  onProgressedByChange?: (v: "agent" | "progressor") => void;
};

export function Stage1SummaryBar({
  streetAddress, city, postcode, tenure, purchaseType, progressedBy, onEdit, onProgressedByChange,
}: Props) {
  const addressParts = [streetAddress, city, postcode].map((s) => s.trim()).filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(", ") : "No address set";

  const tenureLabel = tenure === "freehold" ? "Freehold" : tenure === "leasehold" ? "Leasehold" : null;
  const purchaseTypeLabel =
    purchaseType === "mortgage" ? "Mortgage" :
    purchaseType === "cash_buyer" ? "Cash" :
    purchaseType === "cash_from_proceeds" ? "Cash from Proceeds" :
    null;

  return (
    <div
      className="agent-glass-strong"
      style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: "0 0 6px",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--agent-text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {address}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {tenureLabel && <Pill glass tone="default">{tenureLabel}</Pill>}
          {purchaseTypeLabel && <Pill glass tone="default">{purchaseTypeLabel}</Pill>}
          {onProgressedByChange ? (
            <button
              type="button"
              className="v2-swap-btn"
              onClick={() => onProgressedByChange(progressedBy === "agent" ? "progressor" : "agent")}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center" }}
              title="Click to switch"
            >
              <Pill glass tone={progressedBy === "agent" ? "success" : "brand"}>
                {progressedBy === "agent" ? "Self-progress" : "Send to us"}
                <span className="v2-swap-arrow" style={{ marginLeft: 1 }}>⇄</span>
              </Pill>
            </button>
          ) : (
            <Pill glass tone={progressedBy === "agent" ? "success" : "brand"}>
              {progressedBy === "agent" ? "Self-progress" : "Send to us"}
            </Pill>
          )}
        </div>
      </div>

      <button
        type="button"
        className="agent-link"
        onClick={onEdit}
        style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, padding: "2px 0" }}
      >
        Edit
      </button>
    </div>
  );
}
