// /agent/dev preview for the new nav empty states (critique #298) — Auto emails
// and Chains, laid out exactly like Reminders/Completions/etc. Hero art falls
// back to the generic image until /auto-emails-hero.png + /chains-hero.png land.

import { AutoEmailsEmptyState } from "@/components/agent/AutoEmailsEmptyState";
import { ChainsEmptyState } from "@/components/agent/ChainsEmptyState";

export default function NavEmptyStatesDevPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40, padding: "8px 4px 64px", maxWidth: 1040 }}>
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--agent-text-muted)", margin: "0 0 12px" }}>
          Auto emails — empty state
        </p>
        <AutoEmailsEmptyState />
      </div>
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--agent-text-muted)", margin: "0 0 12px" }}>
          Chains — empty state
        </p>
        <ChainsEmptyState />
      </div>
    </div>
  );
}
