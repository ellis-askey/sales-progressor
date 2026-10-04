// components/account/chrome/AccountCard.tsx
//
// The white rounded card used across the redesigned Account pages: a coral
// icon chip + title + subtitle header, an optional right-aligned header action
// (e.g. a Save button), and the section body. Pure presentational (no hooks),
// so it can be a server component. Cards fade up on mount unless the viewer
// prefers reduced motion.

import type { ReactNode } from "react";

export function AccountCard({
  icon,
  title,
  subtitle,
  headerAction,
  children,
  style,
  bodyStyle,
}: {
  icon?: ReactNode;
  /** Omit for a headerless panel (just the white card + children). */
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  children?: ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}) {
  const hasHeader = Boolean(title || headerAction);
  return (
    <section
      className="account-card"
      style={{
        // Lightly frosted so the streetscape backdrop reads through as a blur.
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(14px) saturate(115%)",
        WebkitBackdropFilter: "blur(14px) saturate(115%)",
        border: "0.5px solid rgba(0,0,0,0.07)",
        borderRadius: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 6px 22px rgba(20,14,10,0.05)",
        padding: 22,
        ...style,
      }}
    >
      {hasHeader && (
      <div className={`account-card-head${icon ? "" : " no-ico"}`}>
        {icon && (
          <span
            aria-hidden
            className="account-card-ico account-card-head-ico"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 1,
              color: "var(--agent-coral-deep, #E2452A)",
            }}
          >
            {icon}
          </span>
        )}
        {title && (
          <h2 className="account-card-head-title" style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "#111827", letterSpacing: "-0.01em", minWidth: 0 }}>
            {title}
          </h2>
        )}
        {headerAction && <div className="account-card-head-action" style={{ flexShrink: 0 }}>{headerAction}</div>}
        {subtitle && (
          <p className="account-card-head-sub" style={{ margin: "3px 0 0", fontSize: 13, lineHeight: 1.5, color: "#6b7280", minWidth: 0 }}>{subtitle}</p>
        )}
      </div>
      )}

      {children && <div style={{ marginTop: hasHeader ? 18 : 0, ...bodyStyle }}>{children}</div>}

      <style>{`
        /* Header as a 3-col grid: icon | title/subtitle (stacked) | action. The
           action spans both rows (so it sits top-right beside the title), exactly
           like the old flex layout. On mobile the subtitle breaks to its own
           full-width row under everything, so a long subtitle is no longer squeezed
           beside the header action. */
        .account-card-head {
          display: grid;
          grid-template-columns: auto 1fr auto;
          grid-template-areas: "ico title action" "ico sub action";
          column-gap: 12px;
          align-items: start;
        }
        .account-card-head.no-ico {
          grid-template-columns: 1fr auto;
          grid-template-areas: "title action" "sub action";
        }
        .account-card-head-ico { grid-area: ico; }
        .account-card-head-title { grid-area: title; }
        .account-card-head-action { grid-area: action; margin-left: 4px; }
        .account-card-head-sub { grid-area: sub; }
        @media (max-width: 600px) {
          .account-card-head { grid-template-areas: "ico title action" "sub sub sub"; }
          .account-card-head.no-ico { grid-template-areas: "title action" "sub sub"; }
        }
        /* Settings-icon standard: no container background, glyph a touch larger. */
        .account-card-ico svg { width: 20px; height: 20px; }
        /* Cards fade up as one on mount, alongside the count-up numbers. */
        .account-card { animation: account-card-in 520ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes account-card-in {
          from { opacity: 0; transform: translateY(13px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .account-card { animation: none; }
        }
      `}</style>
    </section>
  );
}
