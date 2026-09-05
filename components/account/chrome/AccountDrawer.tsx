"use client";

// components/account/chrome/AccountDrawer.tsx
//
// Right-side slide-in panel for the Account area (hosts the email editors from
// the Emails page). Backdrop + Escape + click-outside close, body-scroll lock,
// slide/fade animation, focus moves into the panel on open. Light register.

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { useOverlayChrome } from "@/lib/agent/use-overlay-chrome";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";

export function AccountDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  // Gate the panel (and its overlay-chrome hook) on `open`. This drawer is left
  // mounted while closed (callers pass open={...}), so the scroll-lock + Escape
  // behaviour must only run while it's actually open — hence the inner panel.
  if (!open || typeof document === "undefined") return null;
  return (
    <AccountDrawerPanel onClose={onClose} title={title} subtitle={subtitle}>
      {children}
    </AccountDrawerPanel>
  );
}

function AccountDrawerPanel({
  onClose,
  title,
  subtitle,
  children,
}: {
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { theme, isNight } = usePortalTheme();

  // Body scroll-lock + Escape-to-close + focus restore. No animated close here,
  // so Escape routes through the raw onClose.
  useOverlayChrome(onClose);

  useEffect(() => {
    // Move focus into the panel.
    const t = window.setTimeout(() => panelRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, []);

  // Portalled to <body> so the fixed overlay escapes the AccountCard it's
  // mounted inside — that card's backdrop-filter + mount transform make it a
  // containing block for position:fixed, which otherwise traps the drawer
  // inside the card ("tucked into its own card").
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-theme={theme} data-night={isNight ? "" : undefined}
      style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", animation: "account-drawer-fade 180ms ease both" }}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          position: "relative",
          height: "100%",
          width: "min(520px, 100vw)",
          background: isNight ? "#161d2e" : "#fff",
          borderLeft: isNight ? "0.5px solid rgba(255,255,255,0.08)" : "0.5px solid rgba(0,0,0,0.08)",
          boxShadow: "-16px 0 48px rgba(20,14,10,0.14)",
          display: "flex",
          flexDirection: "column",
          animation: "account-drawer-slide 260ms cubic-bezier(0.22,1,0.36,1) both",
          outline: "none",
        }}
      >
        <div
          style={{
            ...SHEET_BAND_STYLE,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <SheetBandHeader kicker="Account" title={title} subtitle={subtitle} />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="account-drawer-close"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              flexShrink: 0,
              border: "none",
              background: "transparent",
              borderRadius: 8,
              color: "rgba(255,255,255,0.85)",
              cursor: "pointer",
              transition: "background 120ms",
            }}
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 22 }}>{children}</div>
      </div>

      <style>{`
        .account-drawer-close { transition: background 120ms, transform 120ms; }
        .account-drawer-close:hover { background: rgba(255,255,255,0.18); }
        .account-drawer-close:active { transform: scale(0.9); }
        @keyframes account-drawer-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes account-drawer-slide { from { transform: translateX(24px); opacity: 0.6; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>,
    document.body,
  );
}
