"use client";

const OUTSTANDING = [
  { name: "Vendor's solicitor confirmed ready to exchange", side: "Vendor", checked: true },
  { name: "Buyer's solicitor confirmed ready to exchange", side: "Purchaser", checked: true },
  { name: "Anti-money laundering checks complete", side: "Purchaser", checked: false },
  { name: "Completion statement received", side: "Purchaser", checked: false },
];

export function ReconciliationModalHelpExample(_props: Record<string, string>) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 20,
      boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
      maxWidth: 420,
      overflow: "hidden",
      fontFamily: "inherit",
    }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 4px" }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#0f172a" }}>Confirm exchange</p>
      </div>

      {/* Date section */}
      <div style={{ margin: "12px 24px 0", background: "#f8fafc", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#475569" }}>Date contracts exchanged</p>
          <div style={{
            border: "1px solid #e2e8f0", borderRadius: 8,
            padding: "8px 12px", fontSize: 13, color: "#0f172a", background: "#fff",
          }}>
            13 June 2026
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#94a3b8" }}>Pre-filled with today — change if it was different</p>
        </div>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#475569" }}>
            Expected completion date <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span>
          </p>
          <div style={{
            border: "1px solid #e2e8f0", borderRadius: 8,
            padding: "8px 12px", fontSize: 13, color: "#94a3b8", background: "#fff",
          }}>
            27 June 2026
          </div>
        </div>
      </div>

      {/* Outstanding milestones */}
      <div style={{ padding: "14px 24px 0" }}>
        <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Outstanding milestones
        </p>
        <p style={{ margin: "0 0 10px", fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
          Tick those that are done — they{"'"}ll be marked as reconciled at exchange.
        </p>
        <div style={{ borderRadius: 8, border: "1px solid #f1f5f9", overflow: "hidden" }}>
          {OUTSTANDING.map((item, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "10px 14px",
              borderBottom: i < OUTSTANDING.length - 1 ? "1px solid #f1f5f9" : "none",
              background: item.checked ? "rgba(59,130,246,0.03)" : "transparent",
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: 3, marginTop: 1, flexShrink: 0,
                border: item.checked ? "2px solid #3b82f6" : "2px solid #cbd5e1",
                background: item.checked ? "#3b82f6" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {item.checked && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, color: "#334155", lineHeight: 1.35 }}>{item.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>{item.side}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "14px 24px 20px", display: "flex", gap: 10 }}>
        <button style={{
          flex: 1, padding: "10px 0", borderRadius: 10,
          background: "#FF6B4A", border: "none", cursor: "pointer",
          fontSize: 13, fontWeight: 600, color: "#fff",
        }}>
          Confirm exchange
        </button>
        <button style={{
          flex: 1, padding: "10px 0", borderRadius: 10,
          background: "transparent", border: "1px solid #e2e8f0", cursor: "pointer",
          fontSize: 13, fontWeight: 500, color: "#475569",
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
