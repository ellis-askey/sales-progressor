// Zone 2 of the file-detail page — a single unified strip of three
// stats with a small coral icon per column.

import { Tag, Receipt, CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { PurchaseType } from "@prisma/client";

type Props = {
  purchasePrice: number | null;
  purchaseType: PurchaseType | null;
  expectedExchangeDate: Date | null;
  overridePredictedDate: Date | null;
};

function formatPrice(pence: number | null): string {
  if (!pence) return "–";
  return "£" + (pence / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function formatPurchaseType(p: PurchaseType | null): string {
  if (!p) return "–";
  return { mortgage: "Mortgage", cash_buyer: "Cash buyer", cash_from_proceeds: "Cash from Proceeds" }[p] ?? p;
}

function formatExchangeDate(d: Date | null): string {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function TransactionStatsStrip({ purchasePrice, purchaseType, expectedExchangeDate, overridePredictedDate }: Props) {
  const exchangeDate = overridePredictedDate ?? expectedExchangeDate;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      alignItems: "center",
      padding: "14px 18px",
      background: "var(--agent-surface-elevated)",
      border: "0.5px solid rgba(15, 23, 42, 0.06)",
      borderRadius: 10,
    }}>
      <StatCell Icon={Tag}           label="Sale price"        value={formatPrice(purchasePrice)}          data-sensitive="true" />
      <StatCell Icon={Receipt}       label="Sale type"         value={formatPurchaseType(purchaseType)}   divider="left" />
      <StatCell Icon={CalendarBlank} label="Expected exchange" value={formatExchangeDate(exchangeDate)}   divider="left" />
    </div>
  );
}

function StatCell({
  Icon, label, value, valueColor, divider, "data-sensitive": sensitive,
}: {
  Icon: Icon;
  label: string;
  value: string;
  valueColor?: string;
  divider?: "left";
  "data-sensitive"?: string;
}) {
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      paddingLeft: divider === "left" ? 14 : 0,
      borderLeft: divider === "left" ? "1px solid rgba(15, 23, 42, 0.06)" : "none",
    }}>
      <span
        className="stat-cell-icon"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          background: "rgba(var(--agent-coral-rgb), 0.12)",
          color: "var(--agent-coral-deep)",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <Icon size={14} weight="regular" />
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: 10,
          fontWeight: 600,
          color: "var(--agent-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}>{label}</p>
        <p
          data-sensitive={sensitive}
          className="stat-cell-value"
          style={{
            margin: "2px 0 0",
            fontWeight: 600,
            color: valueColor ?? "var(--agent-text-primary)",
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >{value}</p>
      </div>
    </div>
  );
}
