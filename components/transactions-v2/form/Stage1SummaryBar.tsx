"use client";

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

function Pill({
  label,
  variant = "default",
}: {
  label: string;
  variant?: "default" | "green" | "coral" | "warning";
}) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.4,
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    default: {
      background: "rgba(15,23,42,0.06)",
      color: "rgba(15,23,42,0.55)",
    },
    green: {
      background: "var(--agent-success-bg)",
      color: "var(--agent-success)",
      border: "1px solid var(--agent-success-border)",
    },
    coral: {
      background: "rgba(var(--agent-coral-base-rgb), 0.08)",
      color: "var(--agent-coral-deep)",
      border: "1px solid rgba(var(--agent-coral-base-rgb), 0.20)",
    },
    warning: {
      background: "rgba(245,158,11,0.10)",
      color: "#92400e",
      border: "1px solid rgba(245,158,11,0.28)",
    },
  };

  return (
    <span style={{ ...base, ...variantStyles[variant] }}>
      {label}
    </span>
  );
}

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
          <Pill label={tenureLabel ?? "Tenure?"} variant={tenureLabel ? "default" : "warning"} />
          <Pill label={purchaseTypeLabel ?? "Purchase type?"} variant={purchaseTypeLabel ? "default" : "warning"} />
          {onProgressedByChange ? (
            <button
              type="button"
              onClick={() => onProgressedByChange(progressedBy === "agent" ? "progressor" : "agent")}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex" }}
              title="Click to switch"
            >
              <Pill
                label={progressedBy === "agent" ? "Self-progress ⇄" : "Send to us ⇄"}
                variant={progressedBy === "agent" ? "green" : "coral"}
              />
            </button>
          ) : (
            <Pill
              label={progressedBy === "agent" ? "Self-progress" : "Send to us"}
              variant={progressedBy === "agent" ? "green" : "coral"}
            />
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
