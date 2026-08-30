"use client";

import { ArrowRight, X } from "@phosphor-icons/react";
import type { PropertyIntel } from "@/lib/hooks/usePropertyIntel";

// ── Formatters ─────────────────────────────────────────────────────────────

function formatPriceFull(p: number): string {
  return `£${p.toLocaleString("en-GB")}`;
}

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function epcColor(rating: string): string {
  const map: Record<string, string> = {
    A: "#007a3e", B: "#39a935", C: "#8dba2d",
    D: "#ffd500", E: "#f4a01c", F: "#ea6b25", G: "#e02020",
  };
  return map[rating.toUpperCase()] ?? "var(--agent-text-muted)";
}

// ── Tile ─────────────────────────────────────────────────────────────────

function Tile({
  label,
  children,
  accent = false,
}: {
  label: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div style={{
      padding: "10px 12px",
      borderRadius: 10,
      background: accent ? "var(--agent-success-bg)" : "var(--nv2-surface-glass)",
      border: `1px solid ${accent ? "var(--agent-success-border)" : "var(--nv2-border-glass)"}`,
    }}>
      <p style={{
        margin: "0 0 4px",
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: accent ? "var(--agent-success)" : "var(--agent-text-muted)",
      }}>
        {label}
      </p>
      {children}
    </div>
  );
}

// ── Sale row ──────────────────────────────────────────────────────────────

function SaleRow({ address, price, date }: { address: string; price: number; date: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "7px 10px",
      borderRadius: 8,
      background: "var(--nv2-surface-glass)",
      border: "1px solid var(--nv2-border-glass)",
    }}>
      <span style={{
        fontSize: 12,
        color: "var(--agent-text-primary)",
        fontWeight: 500,
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {address || "Address unknown"}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-text-primary)", flexShrink: 0 }}>
        {formatPriceFull(price)}
      </span>
      <span style={{ fontSize: 11, color: "var(--agent-text-muted)", flexShrink: 0 }}>
        {formatDateShort(date)}
      </span>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: "0 0 6px",
      fontSize: 9,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--agent-text-muted)",
    }}>
      {children}
    </p>
  );
}

// ── Main component ────────────────────────────────────────────────────────

type Props = {
  data: PropertyIntel;
  formTenure: "freehold" | "leasehold" | "";
  onUseTenure: (v: "freehold" | "leasehold") => void;
  onClear: () => void;
  fromMemo?: boolean;
};

export function PropertyDossier({ data, formTenure, onUseTenure, onClear, fromMemo }: Props) {
  const isModeB = data.address.street !== null;
  const lrTenure = data.tenure?.value ?? null;
  const tenureMismatch = lrTenure && (formTenure === "" || formTenure !== lrTenure);

  const hasPropertyData = !!(data.lastSold || data.epc || data.tenure);
  const hasRecentSales = (data.recentLocalSales?.length ?? 0) > 0;

  return (
    <div className="agent-glass-subtle" style={{ padding: "20px", borderRadius: 16 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: "0 0 3px",
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--agent-text-muted)",
          }}>
            {isModeB ? "Property Record" : `Area Research · ${data.address.postcode}`}
          </p>
          {isModeB ? (
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.3 }}>
              {data.address.street}{data.address.city ? `, ${data.address.city}` : ""}
              {data.address.postcode ? `, ${data.address.postcode}` : ""}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)", fontStyle: "italic", lineHeight: 1.4 }}>
              Postcode-level data. No specific property matched yet.
            </p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {fromMemo && (
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--agent-success)",
              background: "var(--agent-success-bg)",
              border: "1px solid var(--agent-success-border)",
              borderRadius: 4,
              padding: "2px 6px",
            }}>
              From memo
            </span>
          )}
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear property research"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--agent-text-muted)", display: "flex", alignItems: "center", padding: 2,
            }}
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      </div>

      {/* Mode B — this-property fact tiles */}
      {isModeB && hasPropertyData && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {data.lastSold && (
            <Tile label="Last sold">
              <p style={{ margin: "0 0 1px", fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)" }}>
                {formatPriceFull(data.lastSold.price)}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)" }}>
                {formatDateShort(data.lastSold.date)}
              </p>
            </Tile>
          )}

          {data.epc && (
            <Tile label="EPC rating">
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: epcColor(data.epc.rating), lineHeight: 1 }}>
                  {data.epc.rating.toUpperCase()}
                </span>
                {data.epc.score != null && (
                  <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{data.epc.score}</span>
                )}
              </div>
              {data.epc.validUntil && (
                <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--agent-text-muted)" }}>
                  Valid until {formatDateShort(data.epc.validUntil)}
                </p>
              )}
            </Tile>
          )}

          {data.tenure && (
            <Tile label={tenureMismatch ? "Tenure (Land Registry)" : "Tenure"} accent={!!tenureMismatch}>
              <p style={{
                margin: "0 0 1px",
                fontSize: 13,
                fontWeight: 600,
                color: tenureMismatch ? "var(--agent-success)" : "var(--agent-text-primary)",
                textTransform: "capitalize",
              }}>
                {data.tenure.value}
                {data.tenure.since && (
                  <span style={{ fontWeight: 400, fontSize: 11, color: "var(--agent-text-muted)" }}>
                    {" "}· since {data.tenure.since}
                  </span>
                )}
              </p>
              {tenureMismatch && (
                <button
                  type="button"
                  onClick={() => onUseTenure(data.tenure!.value)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 3,
                    marginTop: 4, background: "none", border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 700, color: "var(--agent-success)", padding: 0,
                  }}
                >
                  Use this <ArrowRight size={10} weight="bold" />
                </button>
              )}
            </Tile>
          )}
        </div>
      )}

      {/* Mode A — EPC if available (postcode-level) */}
      {!isModeB && data.epc && (
        <div style={{ marginBottom: 14 }}>
          <Tile label="EPC (postcode area)">
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: epcColor(data.epc.rating), lineHeight: 1 }}>
                {data.epc.rating.toUpperCase()}
              </span>
              {data.epc.score != null && (
                <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{data.epc.score}</span>
              )}
            </div>
          </Tile>
        </div>
      )}

      {/* Recent sales list — both modes */}
      {hasRecentSales && (
        <div style={{ marginBottom: 14 }}>
          <SectionLabel>
            {isModeB
              ? `Other recent sales in ${data.address.postcode}`
              : "Recent sales nearby"}
          </SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data.recentLocalSales!.map((s, i) => (
              <SaleRow key={i} address={s.address} price={s.price} date={s.date} />
            ))}
          </div>
        </div>
      )}

      {/* No data fallback */}
      {!hasPropertyData && !hasRecentSales && (
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--agent-text-muted)", fontStyle: "italic" }}>
          No property data found for this {isModeB ? "address" : "postcode"}.
        </p>
      )}

      {/* Source attribution */}
      <p style={{ margin: 0, fontSize: 10, color: "var(--agent-text-muted)", opacity: 0.65 }}>
        Sources: HM Land Registry · EPC Register
      </p>

    </div>
  );
}
