"use client";

// Canonical agent-app banner. Used for any horizontal alert/info card on the
// agent surfaces. Replaces ad-hoc coloured-tint banners (OnHold, FileHealth,
// ReconcileLater, ChainSetupFailed, DirectorJoined, ChainDecline) that were
// washing out on the warm peachy iridescent agent background.
//
// Recipe — "grouped inset" iOS material (critique #13, chosen 2026-09-27):
//   - Background: a translucent frosted material (--agent-banner-mat-bg ~55%)
//     with backdrop-filter blur + saturate, so the surface reads as glass and
//     the content behind it shows through. Tokens live in agent-system.css;
//     dark mode is handled there.
//   - Border: 1px neutral material edge (--agent-banner-mat-border) + an inner
//     top highlight, so it floats like an iOS Settings card. Rounder (18px).
//   - Icon: caller-supplied (Phosphor recommended), tinted the kind colour —
//     this is the ONLY thing that carries semantic meaning, so the surface
//     stays neutral and reliable over any photo/background in either theme.
//   - Heading: 13/600 in --agent-text-primary (neutral, not the kind colour)
//   - Body:    12/normal in --agent-text-secondary
//   - Action:  the kind colour
//   - Mount animation: agent-reveal-in

import type { ReactNode } from "react";
import { X, CaretRight } from "@phosphor-icons/react";

export type BannerKind = "info" | "warning" | "danger" | "success";

type Props = {
  kind: BannerKind;
  icon: ReactNode;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  // Where the action link sits. "inline" (default) puts it centre-right on the
  // same row as the title. "bottom-right" drops it below the body, right-
  // aligned — used when the banner also carries a top-right dismiss X so the
  // two controls don't crowd the same corner. "inline-responsive" keeps it on
  // the title row on wider screens but drops it beneath the title below the
  // `sm` breakpoint (the X stays top-right throughout) — so the banner isn't
  // needlessly tall when there's room.
  // "top-right" sits the action on the header row, immediately left of the
  // dismiss X, so there's no bottom action row and the banner tightens up.
  actionPlacement?: "inline" | "bottom-right" | "inline-responsive" | "top-right";
  dismissible?: { onDismiss: () => void };
  // Optional className for cases where a caller needs extra spacing (e.g.
  // mb-3). Container styling otherwise comes from this component.
  className?: string;
};

const TOKEN_FOR_KIND: Record<BannerKind, { tint: string; border: string }> = {
  info:    { tint: "var(--agent-info)",    border: "var(--agent-info-border-strong)"    },
  warning: { tint: "var(--agent-warning)", border: "var(--agent-warning-border-strong)" },
  danger:  { tint: "var(--agent-danger)",  border: "var(--agent-danger-border-strong)"  },
  success: { tint: "var(--agent-success)", border: "var(--agent-success-border-strong)" },
};

export function AgentBanner({ kind, icon, title, body, action, actionPlacement = "inline", dismissible, className }: Props) {
  const t = TOKEN_FOR_KIND[kind];
  // A label ending in "→" is a navigate action: render the arrow as a nudging
  // icon (.agent-arrow-i) with NO underline — the arrow is the affordance.
  // Everything else keeps the underlined .agent-link.
  const hasArrow = action ? /\s*→\s*$/.test(action.label) : false;
  const cleanLabel = action ? action.label.replace(/\s*→\s*$/, "") : "";
  const actionBtn = action ? (
    hasArrow ? (
      <button
        type="button"
        onClick={action.onClick}
        style={{
          flexShrink: 0, fontSize: 12, fontWeight: 600, color: t.tint, whiteSpace: "nowrap",
          display: "inline-flex", alignItems: "center", gap: 4,
          background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0,
        }}
      >
        {cleanLabel}
        <CaretRight size={12} weight="bold" className="agent-arrow-i" aria-hidden />
      </button>
    ) : (
      <button
        type="button"
        onClick={action.onClick}
        className="agent-link"
        style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: t.tint, whiteSpace: "nowrap" }}
      >
        {action.label}
      </button>
    )
  ) : null;
  return (
    <div
      className={`agent-reveal-in ${className ?? ""}`.trim()}
      role={kind === "danger" || kind === "warning" ? "alert" : "status"}
      style={{
        background: "var(--agent-banner-mat-bg, rgba(255,255,255,0.55))",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid var(--agent-banner-mat-border, rgba(255,255,255,0.7))",
        borderRadius: 18,
        padding: "15px 17px",
        boxShadow:
          "var(--agent-banner-mat-shadow, 0 10px 30px rgba(15,26,46,0.12)), inset 0 1px 0 var(--agent-banner-mat-highlight, rgba(255,255,255,0.4))",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          marginTop: 1,
          color: t.tint,
          display: "flex",
          alignItems: "center",
        }}
      >
        {icon}
      </span>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.35 }}>
          {title}
        </p>
        {body && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "var(--agent-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            {body}
          </p>
        )}
        {/* Below-title action: always for "bottom-right"; only below `sm` for
            "inline-responsive" (its top-row copy shows at ≥sm). */}
        {actionBtn && actionPlacement === "bottom-right" && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            {actionBtn}
          </div>
        )}
        {actionBtn && actionPlacement === "inline-responsive" && (
          <div className="flex justify-end sm:hidden" style={{ marginTop: 6 }}>
            {actionBtn}
          </div>
        )}
      </div>

      {actionBtn && actionPlacement === "inline" && (
        <span style={{ alignSelf: "center" }}>{actionBtn}</span>
      )}
      {actionBtn && actionPlacement === "inline-responsive" && (
        <span className="hidden sm:flex" style={{ alignSelf: "center" }}>{actionBtn}</span>
      )}
      {actionBtn && actionPlacement === "top-right" && (
        <span style={{ alignSelf: "flex-start", marginTop: 1 }}>{actionBtn}</span>
      )}

      {dismissible && (
        <button
          type="button"
          onClick={dismissible.onDismiss}
          aria-label="Dismiss"
          className="agent-icon-btn agent-icon-btn-sm"
          style={{ flexShrink: 0, alignSelf: "flex-start", marginTop: -2 }}
        >
          <X size={12} weight="bold" />
        </button>
      )}
    </div>
  );
}
