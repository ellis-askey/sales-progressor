// components/billing/polish/InvoiceHistory.tsx
//
// Past months list. Quiet, scannable, each row downloadable as a PDF.
// Server component — pure render from passed-in invoice rows.

import { FilePdf } from "@phosphor-icons/react/dist/ssr";

type HistoryRow = {
  id: string;
  monthLabel: string;       // "April 2026"
  status: "issued" | "paid" | "failed" | "void";
  totalPence: number;
};

const STATUS_COLOUR: Record<HistoryRow["status"], { bg: string; fg: string; label: string }> = {
  paid:   { bg: "#d1fae5", fg: "#065f46", label: "Paid"   },
  issued: { bg: "#dbeafe", fg: "#1e40af", label: "Issued" },
  failed: { bg: "#fee2e2", fg: "#991b1b", label: "Failed" },
  void:   { bg: "#e5e7eb", fg: "#374151", label: "Void"   },
};

function fmt(p: number): string {
  return `£${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function InvoiceHistory({ rows }: { rows: HistoryRow[] }) {
  return (
    <div
      className="agent-glass"
      style={{
        borderRadius: "var(--agent-radius-xl, 14px)",
        padding: "18px 20px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
          Invoice history
        </h2>
        {rows.length > 0 && (
          <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>
            {rows.length} closed invoice{rows.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            padding: "20px 12px",
            textAlign: "center",
            color: "var(--agent-text-muted)",
            fontSize: 13,
          }}
        >
          Your past invoices will appear here once your first month closes.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
          {rows.map((r) => {
            const s = STATUS_COLOUR[r.status];
            return (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto auto",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 4px",
                  borderBottom: "1px solid var(--agent-border-subtle, rgba(0,0,0,0.06))",
                  fontSize: 13.5,
                }}
              >
                <div style={{ color: "var(--agent-text-primary)" }}>{r.monthLabel}</div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    background: s.bg,
                    color: s.fg,
                    padding: "3px 8px",
                    borderRadius: 4,
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 500,
                    color: "var(--agent-text-primary)",
                    minWidth: 80,
                    textAlign: "right",
                  }}
                >
                  {fmt(r.totalPence)}
                </div>
                <a
                  href={`/api/billing/invoice-pdf/${r.id}`}
                  className="agent-btn agent-btn-ghost agent-btn-sm"
                  style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <FilePdf size={13} weight="regular" />
                  PDF
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
