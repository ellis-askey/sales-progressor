// Shared promo / nudge card (Direction A — "clean tile", founder-approved
// 2026-11-24, prototyped at /dev/components/compare/promo-banners). A SOLID
// coral icon tile anchors each card (no faded wash anywhere), with a confident
// heading, muted body, optional footnote and a CTA row. Presentational only —
// every handler, link and gate lives at the call site. Used by the hub email
// nudge, the All Files demo card and the Partners "no sales yet" card.

import type { ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";

// Right-chevron used inside CTAs that want the "go" arrow. Matches the shared
// .agent-arrow-i styling (hover nudge handled by the button's own CSS).
export function PromoArrow() {
  return (
    <svg className="agent-arrow-i" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="4" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  );
}

// Solid coral icon tile — the attention anchor. Gradient fill, white glyph, a
// soft coral drop-shadow for lift + an inner top highlight for gloss. No wash.
export function IconTile({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center",
        background: "linear-gradient(145deg, var(--agent-coral), var(--agent-coral-deep))",
        color: "#fff",
        boxShadow: "0 5px 14px rgba(var(--agent-coral-rgb), 0.40), inset 0 1px 0 rgba(255,255,255,0.38)",
      }}
    >
      {children}
    </span>
  );
}

export function PromoCard({
  icon, title, body, cta, footnote, onDismiss, glassId, label, className,
}: {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  cta: ReactNode;
  footnote?: ReactNode;
  onDismiss?: () => void;
  glassId: string;
  label: string;
  className?: string;
}) {
  return (
    <GlassCard
      glassId={glassId}
      label={label}
      className={className}
      style={{
        position: "relative", overflow: "hidden",
        padding: "16px 20px",
        borderRadius: "var(--agent-radius-lg)",
        display: "flex", alignItems: "flex-start", gap: 14,
        boxShadow: "0 6px 20px rgba(0,0,0,0.07)",
      }}
    >
      <IconTile>{icon}</IconTile>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 3px", fontSize: 14.5, fontWeight: 650, color: "var(--agent-text-primary)", lineHeight: 1.3, letterSpacing: "-0.01em" }}>{title}</p>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>{body}</p>
        {footnote && <p style={{ margin: "7px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--agent-text-secondary)" }}>{footnote}</p>}
        {cta && <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12 }}>{cta}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="agent-icon-btn agent-icon-btn-md" style={{ flexShrink: 0 }}>
          <X size={14} weight="bold" />
        </button>
      )}
    </GlassCard>
  );
}
