"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import type { ExtractedMemoData } from "@/components/transactions-v2/types";

// ── Field definitions (used only during "reading" animation) ──────────────────

type FieldDef = { key: string; label: string };

const FIELD_DEFS: FieldDef[] = [
  { key: "address",    label: "Address" },
  { key: "price",      label: "Purchase price" },
  { key: "tenure",     label: "Tenure" },
  { key: "vendors",    label: "Vendor details" },
  { key: "purchasers", label: "Purchaser details" },
  { key: "vsol",       label: "Vendor solicitor" },
  { key: "psol",       label: "Purchaser solicitor" },
];

// ── Missing pill definition (submit-priority order) ───────────────────────────

type MissingPill = { key: string; label: string };

function computeMissingPills(
  extractedData: ExtractedMemoData,
  formTenure: string,
  formPurchaseType: string,
  formStreetAddress: string,
  formCity: string,
  formPostcode: string,
): MissingPill[] {
  return [
    { key: "tenure",        label: "Tenure",         missing: !formTenure },
    { key: "purchaseType",  label: "Purchase type",  missing: !formPurchaseType },
    { key: "streetAddress", label: "Street address", missing: !extractedData.streetAddress && !formStreetAddress },
    { key: "city",          label: "City",           missing: !extractedData.city          && !formCity          },
    { key: "postcode",      label: "Postcode",       missing: !extractedData.postcode      && !formPostcode      },
    { key: "purchasePrice", label: "Price",          missing: extractedData.purchasePricePence == null },
    { key: "vendors",       label: "Vendors",        missing: !extractedData.vendors.some((v) => v.name?.trim()) },
    { key: "purchasers",    label: "Purchasers",     missing: !extractedData.purchasers.some((p) => p.name?.trim()) },
  ].filter((p) => p.missing).map(({ key, label }) => ({ key, label }));
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  status: "reading" | "done" | "error";
  isSlow: boolean;
  extractedData: ExtractedMemoData | null;
  errorMessage?: string | null;
  formTenure?: string;
  formPurchaseType?: string;
  formStreetAddress?: string;
  formCity?: string;
  formPostcode?: string;
  onCancel: () => void;
  onChangeFile: () => void;
  onFocusField?: (fieldKey: string) => void;
};

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 14 14" fill="none"
      style={{ animation: "memo-spin 0.8s linear infinite", flexShrink: 0 }}
    >
      <circle cx="7" cy="7" r="5.5" stroke="var(--nv2-border-medium)" strokeWidth="2" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="var(--agent-coral-deep)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MemoStatusBar({
  status, isSlow, extractedData, errorMessage,
  formTenure = "", formPurchaseType = "",
  formStreetAddress = "", formCity = "", formPostcode = "",
  onCancel, onChangeFile, onFocusField,
}: Props) {
  const [visibleCount, setVisibleCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick through fields during "reading"; snap to all when done/error
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (status === "reading") {
      setVisibleCount(0);
      let count = 0;
      intervalRef.current = setInterval(() => {
        count++;
        setVisibleCount(count);
        if (count >= FIELD_DEFS.length) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
        }
      }, 380);
    } else {
      setVisibleCount(FIELD_DEFS.length);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status]);

  const missingPills: MissingPill[] = status === "done" && extractedData
    ? computeMissingPills(extractedData, formTenure, formPurchaseType, formStreetAddress, formCity, formPostcode)
    : [];

  const topBorderColor =
    status === "done" && missingPills.length === 0
      ? "var(--agent-success)"
      : status === "done"
      ? "var(--agent-warning)"
      : status === "error"
      ? "var(--agent-warning)"
      : "var(--agent-coral-deep)";

  return (
    <div
      style={{
        borderRadius: "var(--agent-radius-xl)",
        background: "var(--agent-glass-bg-strong)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "0.5px solid var(--agent-glass-border)",
        borderTop: `2px solid ${topBorderColor}`,
        boxShadow: "var(--agent-glass-shadow)",
        padding: "16px 20px",
        width: "100%",
      }}
    >
      <style>{`
        @keyframes memo-spin {
          to { transform: rotate(360deg); }
        }
        /* Soft coral pulse for pending rows during reading. Conveys
           "queued, waiting" rather than the previous dead grey dot. */
        @keyframes memo-pending-pulse {
          0%, 100% { opacity: 0.45; transform: scale(0.9); }
          50%      { opacity: 0.95; transform: scale(1);    }
        }
      `}</style>

      {/* ── Reading state — animated tick-through ────────────────────────── */}
      {status === "reading" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Spinner />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--nv2-text-primary)" }}>
              Reading your memo…
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {FIELD_DEFS.map((field, i) => {
              const isVisible = i < visibleCount;
              const isActive = i === visibleCount - 1;
              // Stagger the pulse on each pending row so they don't all
              // breathe in sync — gives the list a gentle wave.
              const pulseDelay = `${(i % 4) * 220}ms`;
              return (
                <div
                  key={field.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    opacity: isVisible ? 1 : 0.35,
                    transition: "opacity 250ms",
                  }}
                >
                  {isVisible
                    ? isActive
                      ? <Spinner />
                      : (
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: "rgba(var(--agent-coral-base-rgb), 0.55)",
                              boxShadow: "0 0 0 3px rgba(var(--agent-coral-base-rgb), 0.10)",
                              display: "inline-block",
                              animation: `memo-pending-pulse 1.8s ease-in-out ${pulseDelay} infinite`,
                            }}
                          />
                        </span>
                      )
                    : (
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            border: "1px solid rgba(var(--agent-coral-base-rgb), 0.30)",
                            display: "inline-block",
                          }}
                        />
                      </span>
                    )
                  }
                  <span style={{ fontSize: 12, color: isVisible ? "var(--nv2-text-reading)" : "var(--nv2-text-ghost)" }}>
                    {field.label}
                  </span>
                </div>
              );
            })}
          </div>
          {isSlow && (
            <p style={{ margin: "14px 0 0", fontSize: 12, color: "var(--nv2-text-muted)" }}>
              This is taking a while —{" "}
              <button
                className="agent-link-muted"
                onClick={onCancel}
                style={{ fontSize: 12 }}
              >
                cancel and fill manually
              </button>
              {" "}instead.
            </p>
          )}
        </>
      )}

      {/* ── Error state ──────────────────────────────────────────────────── */}
      {status === "error" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <WarningCircle size={16} weight="fill" color="var(--agent-warning)" style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--nv2-text-primary)" }}>
            {errorMessage ?? "Couldn't read the memo — fill in the form below"}
          </p>
        </div>
      )}

      {/* ── Done state — State 1 (nothing missing) ───────────────────────── */}
      {status === "done" && missingPills.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle size={14} weight="fill" color="var(--agent-success)" style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--nv2-text-primary)" }}>
              Memo read · all fields filled
            </p>
          </div>
          <button
            className="agent-link-muted"
            onClick={onChangeFile}
            style={{ fontSize: 12, flexShrink: 0, marginLeft: 12 }}
          >
            Change file
          </button>
        </div>
      )}

      {/* ── Done state — State 2 (fields missing) ────────────────────────── */}
      {status === "done" && missingPills.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <WarningCircle size={16} weight="fill" color="var(--agent-warning)" style={{ flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--nv2-text-primary)" }}>
                Memo read · {missingPills.length} {missingPills.length === 1 ? "field needs" : "fields need"} attention
              </p>
            </div>
            <button
              className="agent-link-muted"
              onClick={onChangeFile}
              style={{ fontSize: 12, flexShrink: 0, marginLeft: 12 }}
            >
              Change file
            </button>
          </div>

          {/* Amber pills — horizontally scrollable, tappable */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
            {missingPills.map((pill) => (
              <button
                key={pill.key}
                type="button"
                className="memo-missing-pill"
                onClick={() => onFocusField?.(pill.key)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.72"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                style={{
                  flexShrink: 0,
                  padding: "4px 10px",
                  borderRadius: 20,
                  border: "1px solid var(--agent-warning-border)",
                  background: "var(--agent-warning-bg)",
                  color: "var(--agent-warning)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: onFocusField ? "pointer" : "default",
                  whiteSpace: "nowrap",
                  lineHeight: 1.4,
                }}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
