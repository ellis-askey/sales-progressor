"use client";

// components/billing/v2/BuildingInvoiceHero.tsx
//
// The v2 centrepiece. Same data shape as v1 BuildingInvoice but rehoused
// for the near-document environment: no card chrome, hero treatment on
// the period + total, and a felt-liveness signal (pulsing dot + "Updated
// just now / Ns ago" stamp) so the page reads as alive every time the
// director opens it — without polling the server.
//
// Count-up on the total (useCountUp respects reduced-motion via the
// data-rm contract). The live-pulse dot uses the existing
// agent-pulse-dot keyframe; reduced-motion is honoured globally on
// keyframe animations elsewhere in the system (see agent-system.css
// reduced-motion block).
//
// Liveness model: animate-on-mount + timestamp, NOT real polling.
// Exchanges happen a few times a month, so the underlying number is
// almost always static between visits. The count-up gives felt liveness
// every visit; the "Updated Ns ago" stamp keeps it honest. Easy upgrade
// to live polling later if ever needed.

import { useEffect, useState } from "react";
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

export type BuildingInvoiceHeroProps = {
  periodLabel: string;
  lines: Line[];
  subtotalPence: number;
  creditsAppliedPence: number;
  totalPence: number;
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

function useLiveTimestamp(): string {
  const [tick, setTick] = useState(0);
  const [mountedAt] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  void tick;
  const elapsed = Math.floor((Date.now() - mountedAt) / 1000);
  if (elapsed < 5) return "Updated just now";
  if (elapsed < 60) return `Updated ${elapsed}s ago`;
  const mins = Math.floor(elapsed / 60);
  if (mins < 60) return `Updated ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `Updated ${hrs}h ago`;
}

export function BuildingInvoiceHero(props: BuildingInvoiceHeroProps) {
  const displayTotal = useCountUp(props.totalPence, { duration: 900 });
  const liveStamp = useLiveTimestamp();
  const hasLines = props.lines.length > 0;

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 22,
        padding: "12px 0 0",
      }}
    >
      {/* Eyebrow row — period + building badge + live stamp + preview button */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: 0.7,
              fontWeight: 500,
            }}
          >
            Current invoice
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 600,
                color: "#111827",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              {props.periodLabel}
            </h1>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                color: "#92400e",
                background: "#fef3c7",
                padding: "4px 8px",
                borderRadius: 4,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#f59e0b",
                  animation: "agent-pulse-dot 1.6s ease-in-out infinite",
                }}
              />
              Building
            </span>
          </div>
          <div style={{ marginTop: 6, fontSize: 11.5, color: "#9ca3af" }}>{liveStamp}</div>
        </div>
        {hasLines && !props.hidePreviewButton && (
          <a
            href="/api/billing/invoice-pdf/preview"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              fontSize: 12.5,
              fontWeight: 500,
              color: "#374151",
              textDecoration: "none",
              border: "0.5px solid rgba(0,0,0,0.18)",
              borderRadius: 8,
              background: "#fff",
              transition: "background 150ms, border-color 150ms",
            }}
            className="hover:bg-black/[0.03]"
          >
            <FilePdf size={14} weight="regular" />
            Preview PDF
          </a>
        )}
      </div>

      {/* Body — lines or empty state */}
      {!hasLines ? (
        <div
          style={{
            padding: "36px 16px",
            textAlign: "center",
            color: "#6b7280",
            border: "1px dashed rgba(0,0,0,0.10)",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>
            No exchanges yet this month
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Fees appear here the moment a file exchanges.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "70px 1fr auto 120px",
              gap: 12,
              padding: "8px 4px",
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.7,
              color: "#9ca3af",
              borderBottom: "0.5px solid rgba(0,0,0,0.16)",
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
                padding: "13px 4px",
                fontSize: 13.5,
                color: "#111827",
                borderBottom: "0.5px solid rgba(0,0,0,0.06)",
                alignItems: "baseline",
              }}
            >
              <div style={{ color: "#9ca3af", fontSize: 12.5 }}>{fmtDate(l.exchangedAt)}</div>
              <div>{l.address}</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{l.service}</div>
              <div
                style={{
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 500,
                  color:
                    l.variant === "credit"
                      ? "#047857"
                      : l.variant === "trial"
                      ? "#9ca3af"
                      : "#111827",
                }}
              >
                {l.variant === "trial" ? "Free" : fmt(l.totalPence)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hero totals */}
      {hasLines && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 8,
          }}
        >
          <div style={{ minWidth: 280, display: "flex", flexDirection: "column", gap: 6 }}>
            {props.creditsAppliedPence > 0 && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  <span>Subtotal</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {fmt(props.subtotalPence)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    color: "#047857",
                  }}
                >
                  <span>Pending credit</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    −{fmt(props.creditsAppliedPence)}
                  </span>
                </div>
              </>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                paddingTop: 10,
                marginTop: 8,
                borderTop: "0.5px solid rgba(0,0,0,0.18)",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Total</span>
              <span
                style={{
                  fontSize: 34,
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  fontVariantNumeric: "tabular-nums",
                  color: "#111827",
                  lineHeight: 1.05,
                }}
              >
                {fmt(displayTotal)}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
