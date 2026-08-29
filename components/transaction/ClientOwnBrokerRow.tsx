import { Card } from "@/components/ui/Card";

// The client's OWN mortgage broker, shown on the agent file's Professionals tab
// beside the solicitors. Distinct from the file's in-house/TSP broker (that's the
// separate BrokerSection): this is the broker the client named themselves via
// their portal, when no broker was on the file. Read-only; "Added by {name}" so
// the agent knows it came from the client.

const SECONDARY = "var(--agent-text-secondary)";
const MUTED = "var(--agent-text-muted, var(--agent-text-secondary))";

export type OwnBrokerInfo = {
  side: "vendor" | "purchaser";
  name: string;
  contactName: string | null;
  contact: string | null;
  addedByName: string | null;
};

export function ClientOwnBrokerRow({ brokers }: { brokers: OwnBrokerInfo[] }) {
  if (brokers.length === 0) return null;
  return (
    <Card padding="none">
      <div style={{ padding: "12px 16px 6px", display: "flex", alignItems: "center", gap: 8 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: SECONDARY, margin: 0 }}>Client&apos;s own broker</h3>
        <span
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
            color: "#C6360F", background: "rgba(255,107,74,0.10)", border: "1px solid rgba(255,107,74,0.42)",
            padding: "1px 6px", borderRadius: 5,
          }}
        >
          Client&apos;s own
        </span>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: "0 16px 12px" }}>
        {brokers.map((b, i) => (
          <li key={i} style={{ paddingTop: 8, marginTop: i > 0 ? 8 : 0, borderTop: i > 0 ? "1px solid var(--agent-border, rgba(0,0,0,0.06))" : undefined }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary, #111)" }}>{b.name}</div>
            {(b.contactName || b.contact) && (
              <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>
                {[b.contactName, b.contact].filter(Boolean).join(" · ")}
              </div>
            )}
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3 }}>
              {b.side === "vendor" ? "For their onward purchase. " : ""}Added by {b.addedByName ?? "the client"}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
