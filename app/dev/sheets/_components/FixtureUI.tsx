"use client";

// Fixture chrome for inline (in-page) previews. Notifications, banners and
// empty-states are judged in context, so the inline inspector drops the real
// component into a faux agent page column — a page header + glass cards — so
// the reviewer sees it the way it actually sits above/inside real content,
// against the live app background.
//
// These are deliberately lightweight look-alikes of real agent chrome (they
// reuse the same .glass-card / agent-* tokens), NOT the production components,
// so nothing here can drift a real page.

import type { ReactNode } from "react";

export function FixturePage({
  title = "14 Oakwood Avenue, Kingston upon Thames",
  subtitle = "Sample file · for layout context only",
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ width: "100%", maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
          {subtitle}
        </p>
        <h2 style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)" }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

// A neutral glass card the notice can sit inside or beside, so callouts that
// normally live within card content read correctly.
export function FixtureCard({ children, muted, style }: { children?: ReactNode; muted?: boolean; style?: React.CSSProperties }) {
  return (
    <div
      className="glass-card rounded-[14px]"
      style={{ padding: 18, opacity: muted ? 0.55 : 1, ...style }}
    >
      {children ?? <FixtureRows />}
    </div>
  );
}

// Filler rows so a card isn't visually empty when used purely as context.
export function FixtureRows({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--agent-hover-tint)", flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ height: 9, width: `${60 + ((i * 13) % 30)}%`, borderRadius: 5, background: "var(--agent-border-strong)" }} />
            <div style={{ height: 8, width: `${30 + ((i * 17) % 25)}%`, borderRadius: 5, background: "var(--agent-border-subtle)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// A labelled band so the reviewer knows where a notice normally sits
// (e.g. "Top of the property file").
export function FixtureContextLabel({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--agent-coral)" }} />
      {children}
    </p>
  );
}
