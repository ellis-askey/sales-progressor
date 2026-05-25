// components/billing/v2/InvoiceHistoryLines.tsx
//
// Past invoices as a bare list — no card chrome. Hairline-separated rows
// on the clean canvas. Status pill stays for at-a-glance recognition.
// PDF link per row uses the same /api/billing/invoice-pdf/[id] route.

import { FilePdf } from "@phosphor-icons/react/dist/ssr";

type HistoryRow = {
  id: string;
  monthLabel: string;
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

export function InvoiceHistoryLines({ rows }: { rows: HistoryRow[] }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
          Invoice history
        </h2>
        {rows.length > 0 && (
          <span style={{ fontSize: 11, color: "#9ca3af" }}>
            {rows.length} closed invoice{rows.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: "14px 0", fontSize: 13, color: "#9ca3af" }}>
          Your past invoices will appear here once your first month closes.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((r) => {
            const s = STATUS_COLOUR[r.status];
            return (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto auto",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 4px",
                  borderBottom: "0.5px solid rgba(0,0,0,0.06)",
                  fontSize: 13.5,
                }}
              >
                <div style={{ color: "#111827" }}>{r.monthLabel}</div>
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
                    color: "#111827",
                    minWidth: 80,
                    textAlign: "right",
                  }}
                >
                  {fmt(r.totalPence)}
                </div>
                <a
                  href={`/api/billing/invoice-pdf/${r.id}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 10px",
                    fontSize: 12,
                    color: "#374151",
                    textDecoration: "none",
                    borderRadius: 6,
                    transition: "background 150ms",
                  }}
                  className="hover:bg-black/[0.05]"
                >
                  <FilePdf size={13} weight="regular" />
                  PDF
                </a>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
