"use client";

// Canonical hub attention-card shell — the baked GlassCard + the collapsible header
// (24px tinted icon · count-in-title · subtitle · rotating chevron) + the agent-acc
// drawer body. Extracted 2026-11-21 from the six cards that each hand-rolled this exact
// shell (HubListCard, AttentionCard, ReviewsDueCard, ExchangeOverdueCard,
// StalledEnquiriesCard, NeedsFilingCard). Layout + look are UNCHANGED — pure dedup.

import type { ReactNode, Ref } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import type { GlassVariantId } from "@/lib/glass/variants";

export function HubCard({
  glassId,
  label,
  defaultVariant = "v27",
  icon,
  iconColor,
  title,
  subtitle,
  collapsed,
  onToggleCollapse,
  bodyRef,
  children,
}: {
  glassId: string;
  label: string;
  defaultVariant?: GlassVariantId;
  /** 24px Phosphor glyph (bare, tone-coloured). */
  icon: ReactNode;
  iconColor: string;
  /** The title node — includes the tone-coloured count ("3 files at risk"). */
  title: ReactNode;
  subtitle?: ReactNode;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Optional ref onto the inner body (for @formkit/auto-animate row reflow). */
  bodyRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <GlassCard glassId={glassId} label={label} defaultVariant={defaultVariant} style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        className="agent-hover-ctl"
        style={{ width: "100%", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, border: "none", borderBottom: collapsed ? "none" : "0.5px solid var(--agent-border-subtle)", cursor: "pointer", textAlign: "left" }}
      >
        <span aria-hidden style={{ color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="agent-card-title-emphasis" style={{ margin: 0, display: "block" }}>{title}</span>
          {subtitle != null && <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2, lineHeight: 1.4 }}>{subtitle}</span>}
        </span>
        <span aria-hidden style={{ color: "var(--agent-text-muted)", display: "flex", alignItems: "center", transition: "transform 180ms ease", transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", flexShrink: 0 }}>
          <CaretDown size={14} weight="bold" />
        </span>
      </button>

      <div className={`agent-acc${collapsed ? "" : " open"}`}>
        <div className="agent-acc-in">
          <div ref={bodyRef}>{children}</div>
        </div>
      </div>
    </GlassCard>
  );
}
