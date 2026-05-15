import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";

export function HubEmptyWelcomeCard() {
  return (
    <div className="agent-glass" style={{
      padding: "28px 32px",
      borderRadius: "var(--agent-radius-xl)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 24,
    }}>
      <div>
        <p style={{
          margin: "0 0 4px",
          fontSize: "var(--agent-text-h3)",
          fontWeight: 600,
          color: "var(--agent-text-primary)",
          letterSpacing: "var(--agent-tracking-tight)",
        }}>
          Your pipeline starts here.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          Add your first sale and we&apos;ll track it from offer to completion.
        </p>
      </div>
      <Link
        href="/agent/transactions/new-v2"
        className="agent-btn agent-btn-primary agent-btn-md"
        style={{ textDecoration: "none", flexShrink: 0 }}
      >
        <Plus size={16} weight="bold" />
        Add a sale
      </Link>
    </div>
  );
}
