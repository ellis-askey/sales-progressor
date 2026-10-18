"use client";

// FINAL (proposal, dev-only) — the two settings menus, MIRRORED.
// Decision D6: keep both persona-appropriate names ("Account" for agencies,
// "Settings" for businesses) but make the same feature sit under the same-named
// tab in the same order in both. This shows the proposed aligned structure, not
// a live nav. Items present in only one persona are marked.

import { CaretRight } from "@phosphor-icons/react";

type Item = { label: string; only?: "account" | "settings"; note?: string };

// One shared order for both menus. The "Automated chasing" and "Emails" tabs are
// the consolidated homes from this plan.
const TABS: Item[] = [
  { label: "Profile" },
  { label: "Team" },
  { label: "Emails", note: "copy + look + sender + which-send, one workspace" },
  { label: "Automated chasing", note: "every chase + timing, one screen" },
  { label: "What clients see", only: "account", note: "agencies only; businesses manage this per client" },
  { label: "Notifications", note: "how we ping you (no client-email controls here)" },
  { label: "Connections" },
  { label: "Billing" },
  { label: "Security" },
];

const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--agent-border-default)", borderRadius: 14, padding: "18px 20px" };

function Menu({ title, persona }: { title: string; persona: "account" | "settings" }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--agent-text-muted)", fontWeight: 600, marginBottom: 9 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {TABS.map((t) => {
          const hidden = t.only && t.only !== persona;
          return (
            <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, background: hidden ? "transparent" : "var(--agent-coral-bg-tint)", opacity: hidden ? 0.32 : 1 }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", textDecoration: hidden ? "line-through" : "none" }}>{t.label}</span>
              {hidden ? <span style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>n/a</span> : <CaretRight size={13} weight="bold" style={{ color: "var(--agent-coral-deep)" }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FinalSettingsNav() {
  return (
    <div style={card}>
      <div style={{ fontSize: 15.5, fontWeight: 720, letterSpacing: "-.01em", color: "var(--agent-text-primary)", marginBottom: 2 }}>Settings menus, aligned</div>
      <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", margin: "0 0 16px" }}>
        Two names stay (agencies see Account, businesses see Settings) but every feature now sits under the same tab, in the same order, in both. Same components underneath; this is reconciliation, not a merge.
      </p>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <Menu title="Account · agencies" persona="account" />
        <Menu title="Settings · businesses" persona="settings" />
      </div>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 4 }}>
        {TABS.filter((t) => t.note).map((t) => (
          <div key={t.label} style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>
            <b style={{ color: "var(--agent-text-secondary)", fontWeight: 650 }}>{t.label}</b>: {t.note}
          </div>
        ))}
      </div>
    </div>
  );
}
