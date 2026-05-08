"use client";

const CASCADE_ITEMS = [
  { name: "Vendor searches received", reconciled: false },
  { name: "Contract pack sent to buyer's solicitor", reconciled: false },
  { name: "Initial enquiries raised by buyer's solicitor", reconciled: false },
];

export function UndoCascadeModalHelpExample(_props: Record<string, string>) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 20,
      boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
      maxWidth: 400,
      overflow: "hidden",
      fontFamily: "inherit",
    }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9" }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#0f172a" }}>Undo milestone</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
          Vendor searches applied for — what would you like to do?
        </p>
      </div>

      {/* Body */}
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Option 1 — target only, selected */}
        <div style={{
          borderRadius: 12,
          border: "2px solid #3b82f6",
          background: "rgba(59,130,246,0.04)",
          padding: "14px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{
              width: 16, height: 16, borderRadius: "50%",
              background: "#3b82f6", border: "2px solid #3b82f6",
              flexShrink: 0, marginTop: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Undo this milestone only</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
                Reverse this milestone but keep downstream work as-is.
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                Progress: <span style={{ fontWeight: 600 }}>58% → 47%</span>
              </p>
            </div>
          </div>
        </div>

        {/* Option 2 — cascade */}
        <div style={{
          borderRadius: 12,
          border: "2px solid #e2e8f0",
          padding: "14px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{
              width: 16, height: 16, borderRadius: "50%",
              border: "2px solid #cbd5e1",
              flexShrink: 0, marginTop: 1,
            }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Undo this and downstream milestones</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
                Reverse this milestone and all completed dependents.
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                Progress: <span style={{ fontWeight: 600 }}>58% → 28%</span>
              </p>
              <div style={{ marginTop: 10, borderRadius: 8, border: "1px solid #f1f5f9", overflow: "hidden" }}>
                {CASCADE_ITEMS.map((item, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px",
                    borderBottom: i < CASCADE_ITEMS.length - 1 ? "1px solid #f8fafc" : "none",
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    <span style={{ fontSize: 12, color: "#475569" }}>{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "0 24px 20px", display: "flex", gap: 10 }}>
        <button style={{
          flex: 1, padding: "10px 0", borderRadius: 12,
          background: "#f97316", border: "none", cursor: "pointer",
          fontSize: 13, fontWeight: 600, color: "#fff",
        }}>
          Undo milestone
        </button>
        <button style={{
          flex: 1, padding: "10px 0", borderRadius: 12,
          background: "transparent", border: "1px solid #e2e8f0", cursor: "pointer",
          fontSize: 13, fontWeight: 500, color: "#475569",
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
