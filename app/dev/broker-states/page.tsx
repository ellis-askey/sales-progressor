// DISPOSABLE test index for the mortgage broker card states (staging seed data
// from scripts/seed-broker-demo.ts). Public, no auth. Delete with the seed
// once the broker card is signed off. Links are relative, so this works on
// localhost:3001 or the staging deploy.

export const dynamic = "force-dynamic";

const STATES: { label: string; expect: string; token: string; positive: boolean }[] = [
  { label: "Agent's own broker — prompt", expect: "Coral card: 'Speak to a mortgage broker', Ashcroft Financial, recommended by your agent.", token: "2HJ8RAD_ttdwFjOfsUEG2-mL1VNeC0If", positive: true },
  { label: "TSP default broker — prompt (outsourced)", expect: "Coral card with the fallback broker (Beacon), 'We'll connect you with a trusted broker.'", token: "kyODC5Stezc3ujnrU5wsZU6GLPyTO7MA", positive: true },
  { label: "Requested — acknowledgment", expect: "Green 'Request sent' card instead of the prompt.", token: "rMKfEUd83_C4L8ik1zB93DmvyRw9sKHQ", positive: true },
  { label: "Team entry — agent broker confirmed", expect: "No card (past application). Broker appears in 'Your team' at the bottom.", token: "K0wE9xG3hcTXqYgCHvAISnod2fiOPbhU", positive: true },
  { label: "Team entry — TSP broker won", expect: "No card. Beacon appears in 'Your team' (QuoteRequest marked won).", token: "H_TiV1yO1ylGcH6P-qQb7xkkvPJK5KN_", positive: true },
  { label: "Cash buyer", expect: "NO broker card at all (cash buyers excluded).", token: "-kfPq7AdBXDlDsErKoWS3_df0AnG8fPs", positive: false },
  { label: "Self-managed, no agent broker", expect: "NO broker card (fallback is outsourced-only).", token: "Bxp5VPQai_ICcQ19DSSvRCTFuT4bUdPH", positive: false },
];

export default function BrokerStatesIndex() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif", color: "#1a1d29" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px" }}>Mortgage broker card — test states</h1>
      <p style={{ fontSize: 14, color: "#4a5162", margin: "0 0 24px" }}>
        Each link opens a seeded buyer portal. Tap the card to see the request drawer. Staging data only.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {STATES.map((s) => (
          <a
            key={s.token}
            href={`/portal/${s.token}`}
            style={{
              display: "block", textDecoration: "none", color: "inherit",
              border: `1px solid ${s.positive ? "rgba(255,107,74,0.35)" : "rgba(15,23,42,0.12)"}`,
              borderRadius: 12, padding: "14px 16px",
              background: s.positive ? "rgba(255,107,74,0.05)" : "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{s.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: s.positive ? "#cc4a2e" : "#8b91a3" }}>
                {s.positive ? "card shows" : "no card"}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#4a5162", margin: "5px 0 0", lineHeight: 1.4 }}>{s.expect}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
