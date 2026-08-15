"use client";

// Portal primary button (PRIMARY-A3, chosen in /test/portal-lab 2026-08-15).
// Tactile coral gradient with a real press-down, plus the full state set:
//   hover / pressed / focus-visible / disabled / loading.
// Interaction states live in globals.css (.pbtn / .pbtn-primary); this file
// owns the shape, colour, sizing and the loading spinner. One component so
// every primary CTA (Confirm this step, sheet buttons, Add agent) matches.

import { PORTAL_BTN } from "./portal-ui";

type Props = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  /** Full-width (default) or hug-content for small inline actions. */
  full?: boolean;
  size?: "md" | "sm";
  ariaLabel?: string;
};

export function PortalButton({
  children, onClick, type = "button", disabled = false, loading = false, full = true, size = "md", ariaLabel,
}: Props) {
  const sm = size === "sm";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      className="pbtn pbtn-primary"
      style={{
        width: full ? "100%" : undefined,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: sm ? "8px 15px" : "14px 18px",
        borderRadius: sm ? 11 : 14,
        fontSize: sm ? 13 : 16,
        fontWeight: sm ? 700 : 600,
        letterSpacing: "-0.01em",
        color: "#fff",
        background: PORTAL_BTN.primaryBg,
        boxShadow: PORTAL_BTN.primaryShadow,
      }}
    >
      {loading && (
        <svg className="pbtn-spin" width={sm ? 14 : 18} height={sm ? 14 : 18} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}
