"use client";

// Canonical agent-app banner. Used for any horizontal alert/info card on the
// agent surfaces. Replaces ad-hoc coloured-tint banners (OnHold, FileHealth,
// ReconcileLater, ChainSetupFailed, DirectorJoined, ChainDecline) that were
// washing out on the warm peachy iridescent agent background.
//
// Recipe — neutral surface + blur + coloured accent:
//   - Background: --agent-banner-bg (white at 90% in light, dark slate at 92%
//     in dark) with backdrop-filter blur, so it reads as visually distinct
//     from the app background AND from glass-card content below it. The token
//     is defined in agent-system.css; dark mode is handled there, not here.
//   - Border: 1px in the kind's "border-strong" token (45-55% opacity)
//   - Icon: caller-supplied (Phosphor recommended), tinted with the kind colour
//   - Heading: 13/600 in the kind colour
//   - Body:    12/normal in --agent-text-secondary
//   - Mount animation: agent-reveal-in
//
// Designed so the same chrome works for any of the four kinds — semantic
// meaning is carried by border + icon + heading colour, never by a tinted
// background. That's what gives us cross-theme + cross-background reliability.

import type { ReactNode } from "react";
import { X } from "@phosphor-icons/react";

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
  // two controls don't crowd the same corner.
  actionPlacement?: "inline" | "bottom-right";
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
  const actionBtn = action ? (
    <button
      type="button"
      onClick={action.onClick}
      className="agent-link"
      style={{
        flexShrink: 0,
        fontSize: 12,
        fontWeight: 600,
        color: t.tint,
        whiteSpace: "nowrap",
      }}
    >
      {action.label}
    </button>
  ) : null;
  return (
    <div
      className={`agent-reveal-in ${className ?? ""}`.trim()}
      role={kind === "danger" || kind === "warning" ? "alert" : "status"}
      style={{
        background: "var(--agent-banner-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        padding: "12px 16px",
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
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: t.tint, lineHeight: 1.35 }}>
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
        {actionBtn && actionPlacement === "bottom-right" && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            {actionBtn}
          </div>
        )}
      </div>

      {actionBtn && actionPlacement === "inline" && (
        <span style={{ alignSelf: "center" }}>{actionBtn}</span>
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
