// Zone 2 of the file-detail page — a single unified strip of three
// stats (Sale price / Sale type / Progress). Sits below the hero and
// above the tab bar. No card chrome; just a horizontal band with
// thin vertical dividers between columns so it reads as one component
// rather than three floating text blocks.

import type { PurchaseType } from "@prisma/client";

type Props = {
  purchasePrice: number | null;
  purchaseType: PurchaseType | null;
  percent: number;
};

function formatPrice(pence: number | null): string {
  if (!pence) return "–";
  return "£" + (pence / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function formatPurchaseType(p: PurchaseType | null): string {
  if (!p) return "–";
  return { mortgage: "Mortgage", cash_buyer: "Cash buyer", cash_from_proceeds: "Cash from Proceeds" }[p] ?? p;
}

export function TransactionStatsStrip({ purchasePrice, purchaseType, percent }: Props) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      alignItems: "center",
      padding: "20px 24px",
      background: "var(--agent-surface-elevated)",
      border: "0.5px solid rgba(15, 23, 42, 0.06)",
      borderRadius: 14,
    }}>
      <StatCell label="Sale price" value={formatPrice(purchasePrice)} data-sensitive="true" />
      <StatCell
        label="Sale type"
        value={formatPurchaseType(purchaseType)}
        divider="left"
      />
      <StatCell
        label="Progress"
        value={`${percent}%`}
        valueColor="var(--agent-coral-deep)"
        divider="left"
      />
    </div>
  );
}

function StatCell({
  label, value, valueColor, divider, "data-sensitive": sensitive,
}: {
  label: string;
  value: string;
  valueColor?: string;
  divider?: "left";
  "data-sensitive"?: string;
}) {
  return (
    <div style={{
      paddingLeft: divider === "left" ? 24 : 0,
      borderLeft: divider === "left" ? "1px solid rgba(15, 23, 42, 0.08)" : "none",
    }}>
      <p style={{
        margin: 0,
        fontSize: 12,
        fontWeight: 600,
        color: "var(--agent-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}>{label}</p>
      <p
        data-sensitive={sensitive}
        style={{
          margin: "6px 0 0",
          fontSize: 28,
          fontWeight: 700,
          color: valueColor ?? "var(--agent-text-primary)",
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
        }}
      >{value}</p>
    </div>
  );
}
