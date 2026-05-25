"use client";

// components/billing/polish/BuildingInvoice.tsx
//
// The centrepiece of the billing hub — the current month rendered as a
// real itemised invoice. Lines, totals, VAT (when active), credits, and a
// "Preview PDF" action that downloads the live preview from
// /api/billing/invoice-pdf/preview.
//
// Total animates on mount (useCountUp). Empty state when no exchanges.

import { useCountUp } from "@/lib/hooks/useCountUp";
import { FilePdf } from "@phosphor-icons/react/dist/ssr";

type Line = {
  transactionId: string;
  exchangedAt: Date;
  address: string;
  service: string;
  totalPence: number;
  variant: "normal" | "trial" | "credit";
};

export type BuildingInvoiceProps = {
  periodLabel: string;
  status: "building";
  lines: Line[];
  subtotalPence: number;
  vatPence: number;
  vatActive: boolean;
  creditsAppliedPence: number;
  totalPence: number;
  /** When true, hide the Preview-PDF button (e.g. brand-new agency). */
  hidePreviewButton?: boolean;
};

function fmt(p: number): string {
  const neg = p < 0;
  const abs = Math.abs(p);
  const s = `£${(abs / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return neg ? `−${s}` : s;
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function BuildingInvoice(props: BuildingInvoiceProps) {
  const displayTotal = useCountUp(props.totalPence, { duration: 800 });

  return (
    <div
      className="agent-glass"
      style={{
        borderRadius: "var(--agent-radius-xl, 14px)",
        padding: "20px 22px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--agent-text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              fontWeight: 500,
            }}
          >
            Current invoice
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              {props.periodLabel}
            </h2>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                color: "#92400e",
                background: "#fef3c7",
                padding: "3px 7px",
                borderRadius: 4,
              }}
            >
              Building
            </span>
          </div>
        </div>
        {!props.hidePreviewButton && (
          <a
            href="/api/billing/invoice-pdf/preview"
            className="agent-btn agent-btn-secondary agent-btn-sm"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <FilePdf size={14} weight="regular" />
            Preview PDF
          </a>
        )}
      </div>

      {/* Body — lines */}
      {props.lines.length === 0 ? (
        <div
          style={{
            padding: "28px 16px",
            textAlign: "center",
            color: "var(--agent-text-muted)",
            border: "1px dashed var(--agent-border-subtle, rgba(0,0,0,0.08))",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--agent-text-secondary)" }}>
            No exchanges yet this month
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Fees appear here the moment a file exchanges.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Column header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "70px 1fr auto 120px",
              gap: 12,
              padding: "8px 4px",
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              color: "var(--agent-text-muted)",
              borderBottom: "1px solid var(--agent-border-subtle, rgba(0,0,0,0.08))",
            }}
          >
            <div>Date</div>
            <div>File</div>
            <div>Service</div>
            <div style={{ textAlign: "right" }}>Fee</div>
          </div>
          {props.lines.map((l) => (
            <div
              key={l.transactionId + l.variant}
              style={{
                display: "grid",
                gridTemplateColumns: "70px 1fr auto 120px",
                gap: 12,
                padding: "11px 4px",
                fontSize: 13.5,
                color: "var(--agent-text-primary)",
                borderBottom: "1px solid var(--agent-border-subtle, rgba(0,0,0,0.06))",
                alignItems: "baseline",
                background:
                  l.variant === "trial"
                    ? "var(--agent-readonly-bg, rgba(0,0,0,0.025))"
                    : l.variant === "credit"
                    ? "var(--agent-readonly-bg, rgba(0,0,0,0.025))"
                    : undefined,
                opacity: l.variant === "trial" ? 0.8 : 1,
              }}
            >
              <div style={{ color: "var(--agent-text-muted)" }}>{fmtDate(l.exchangedAt)}</div>
              <div>{l.address}</div>
              <div style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{l.service}</div>
              <div
                style={{
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 500,
                  color:
                    l.variant === "credit"
                      ? "var(--agent-status-positive, #047857)"
                      : l.variant === "trial"
                      ? "var(--agent-text-muted)"
                      : "var(--agent-text-primary)",
                }}
              >
                {l.variant === "trial" ? "Free" : fmt(l.totalPence)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Totals block */}
      {props.lines.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <div style={{ minWidth: 240, display: "flex", flexDirection: "column", gap: 4 }}>
            {props.creditsAppliedPence > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--agent-text-muted)" }}>
                  <span>Subtotal</span>
                  {/* Sum of gross line fees before credits — computed from
                      totalPence + creditsAppliedPence so the math reads
                      regardless of VAT-on/off (props.subtotalPence is the
                      dormant ex-VAT amount on VAT-on agencies). */}
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(props.totalPence + props.creditsAppliedPence)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--agent-status-positive, #047857)" }}>
                  <span>Pending credit</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>−{fmt(props.creditsAppliedPence)}</span>
                </div>
              </>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                paddingTop: 8,
                marginTop: 6,
                borderTop: "1px solid var(--agent-border-subtle, rgba(0,0,0,0.12))",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>Total</span>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--agent-text-primary)",
                }}
              >
                {fmt(displayTotal)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
