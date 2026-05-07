// Contact card with last-visited portal timestamp (from R2)

type ContactRole = "vendor" | "purchaser";

const EXAMPLES: Record<ContactRole, { name: string; email: string; lastSeen: string }> = {
  vendor:    { name: "James Patel", email: "james.patel@email.co.uk", lastSeen: "Viewed 2 hours ago" },
  purchaser: { name: "Sarah Mitchell", email: "sarah.m@outlook.com", lastSeen: "Viewed yesterday" },
};

export function ContactCardExample({ role = "purchaser" }: { role?: ContactRole }) {
  const ex = EXAMPLES[role] ?? EXAMPLES.purchaser;
  return (
    <div style={{
      background: "rgba(255,255,255,0.70)",
      border: "0.5px solid rgba(45,24,16,0.10)",
      borderRadius: 12,
      padding: "14px 16px",
      maxWidth: 320,
      display: "flex",
      alignItems: "center",
      gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: "linear-gradient(135deg, #FFB18F, #FF8A65)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
          {ex.name.split(" ").map(p => p[0]).join("")}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 1px", fontSize: 13, fontWeight: 600, color: "#2D1810" }}>{ex.name}</p>
        <p style={{ margin: "0 0 4px", fontSize: 11, color: "rgba(45,24,16,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.email}</p>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 10, color: "#1F8A4A", fontWeight: 500,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1F8A4A", display: "inline-block", flexShrink: 0 }} />
          {ex.lastSeen}
        </span>
      </div>
      <button style={{
        padding: "5px 10px", borderRadius: 7,
        background: "rgba(255,138,101,0.10)",
        border: "0.5px solid rgba(255,138,101,0.25)",
        color: "#FF6B4A", fontSize: 11, fontWeight: 600,
        cursor: "pointer", whiteSpace: "nowrap",
      }}>
        Send link
      </button>
    </div>
  );
}
