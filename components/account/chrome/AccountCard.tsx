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
  title: string;
  subtitle?: string;
  headerAction?: ReactNode;
  children?: ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}) {
  return (
    <section
      className="account-card"
      style={{
        background: "#fff",
        border: "0.5px solid rgba(0,0,0,0.07)",
        borderRadius: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 6px 22px rgba(20,14,10,0.05)",
        padding: 22,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          {icon && (
            <span
              aria-hidden
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                flexShrink: 0,
                borderRadius: 10,
                background: "rgba(255,107,74,0.10)",
                color: "var(--agent-coral-deep, #E2452A)",
              }}
            >
              {icon}
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "#111827", letterSpacing: "-0.01em" }}>
              {title}
            </h2>
            {subtitle && (
              <p style={{ margin: "3px 0 0", fontSize: 13, lineHeight: 1.5, color: "#6b7280" }}>{subtitle}</p>
            )}
          </div>
        </div>
        {headerAction && <div style={{ flexShrink: 0 }}>{headerAction}</div>}
      </div>

      {children && <div style={{ marginTop: 18, ...bodyStyle }}>{children}</div>}

      <style>{`
        .account-card { animation: account-card-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes account-card-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .account-card { animation: none; }
        }
      `}</style>
    </section>
  );
}
