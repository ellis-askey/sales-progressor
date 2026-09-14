import { Card } from "@/components/ui/Card";

// Legacy broker/IFA contacts, shown on the agent file's Professionals tab beside
// the solicitors (2026-09-14). These are contacts that were added with the old
// "Broker / IFA" client role before brokers moved to Professionals. Read-only
// here — the referral broker (BrokerSection) is the live way to attach a broker.

const SECONDARY = "var(--agent-text-secondary)";
const MUTED = "var(--agent-text-muted, var(--agent-text-secondary))";

export type BrokerContactInfo = {
  name: string;
  phone: string | null;
  email: string | null;
};

export function BrokerContactsList({ contacts }: { contacts: BrokerContactInfo[] }) {
  if (contacts.length === 0) return null;
  return (
    <Card padding="none">
      <div style={{ padding: "12px 16px 6px" }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: SECONDARY, margin: 0 }}>Broker / IFA</h3>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: "0 16px 12px" }}>
        {contacts.map((c, i) => (
          <li key={i} style={{ paddingTop: 8, marginTop: i > 0 ? 8 : 0, borderTop: i > 0 ? "1px solid var(--agent-border, rgba(0,0,0,0.06))" : undefined }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary, #111)" }}>{c.name}</div>
            {(c.phone || c.email) && (
              <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>
                {[c.phone, c.email].filter(Boolean).join(" · ")}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
