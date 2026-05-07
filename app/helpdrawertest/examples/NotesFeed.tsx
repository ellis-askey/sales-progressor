// Activity feed showing 3 example notes

const NOTES = [
  {
    author: "Olivia Chen",
    initials: "OC",
    time: "Today, 09:14",
    text: "Called Smith & Partners re VM7. They said contract pack should be ready by Friday — chasing again Thursday if not received.",
  },
  {
    author: "Tom Hartwell",
    initials: "TH",
    time: "Yesterday, 16:40",
    text: "Sarah Mitchell confirmed she's happy with the survey report. No further action needed on PM9/PM10.",
  },
  {
    author: "Olivia Chen",
    initials: "OC",
    time: "3 May 2026",
    text: "Buyer's solicitor (Harrison & Co) confirmed searches ordered. PM8 marked complete.",
  },
];

export function NotesFeedExample() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 380 }}>
      {NOTES.map((n, i) => (
        <div key={i} style={{
          background: "rgba(255,255,255,0.70)",
          border: "0.5px solid rgba(45,24,16,0.10)",
          borderRadius: 10,
          padding: "12px 14px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: "linear-gradient(135deg, #FF8A65, #FF6B4A)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#fff" }}>{n.initials}</span>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#2D1810" }}>{n.author}</p>
              <p style={{ margin: 0, fontSize: 10, color: "rgba(45,24,16,0.45)" }}>{n.time}</p>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#5A3A28", lineHeight: 1.6 }}>{n.text}</p>
        </div>
      ))}
    </div>
  );
}
