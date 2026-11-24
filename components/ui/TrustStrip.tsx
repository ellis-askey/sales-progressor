import type { ReactNode } from "react";

export interface TrustItem {
  label: string;
  /** Optional leading icon; defaults to a tick. */
  icon?: ReactNode;
}

function Tick() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" width="100%" height="100%">
      <path d="m4 10.5 3.5 3.5L16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Trust strip — a centred row of short reassurance points. Two variants:
 *   · "ticks" (default): each item carries a small coral tick (or its own
 *     `icon`). The chain-invite landing's "Free to self-progress ..." row.
 *   · "plain": no icons, middot-separated, muted. The login / register / reset
 *     footer ("SSL encrypted · GDPR compliant · UK data").
 * `accent` colours the tick icons (ticks variant only).
 */
export function TrustStrip({
  items,
  accent = "#FF6B4A",
  variant = "ticks",
}: {
  items: TrustItem[];
  accent?: string;
  variant?: "ticks" | "plain";
}) {
  if (variant === "plain") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: "10px" }}>
        {items.map((it, i) => (
          <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--agent-text-muted, rgba(32,36,46,0.45))" }}>{it.label}</span>
            {i < items.length - 1 && (
              <span aria-hidden="true" style={{ fontSize: "11px", color: "var(--agent-text-faint, rgba(32,36,46,0.22))" }}>·</span>
            )}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: "10px 22px" }}>
      {items.map((it) => (
        <span
          key={it.label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            fontSize: "12.5px",
            fontWeight: 500,
            color: "var(--agent-text-secondary, #3F3F46)",
          }}
        >
          <span aria-hidden="true" style={{ width: 16, height: 16, flex: "none", color: accent, display: "inline-flex" }}>
            {it.icon ?? <Tick />}
          </span>
          {it.label}
        </span>
      ))}
    </div>
  );
}
