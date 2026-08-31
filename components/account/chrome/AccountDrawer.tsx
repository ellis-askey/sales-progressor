"use client";

// components/account/chrome/AccountDrawer.tsx
//
// Right-side slide-in panel for the Account area (hosts the email editors from
// the Emails page). Backdrop + Escape + click-outside close, body-scroll lock,
// slide/fade animation, focus moves into the panel on open. Light register.

import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";

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
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the panel.
    const t = window.setTimeout(() => panelRef.current?.focus(), 20);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(20,14,10,0.28)", backdropFilter: "blur(2px)", animation: "account-drawer-fade 180ms ease both" }}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          position: "relative",
          height: "100%",
          width: "min(520px, 100vw)",
          background: "#fff",
          borderLeft: "0.5px solid rgba(0,0,0,0.08)",
          boxShadow: "-16px 0 48px rgba(20,14,10,0.14)",
          display: "flex",
          flexDirection: "column",
          animation: "account-drawer-slide 260ms cubic-bezier(0.22,1,0.36,1) both",
          outline: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            padding: "18px 22px",
            borderBottom: "0.5px solid rgba(0,0,0,0.08)",
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827", letterSpacing: "-0.01em" }}>{title}</h2>
            {subtitle && <p style={{ margin: "3px 0 0", fontSize: 13, lineHeight: 1.5, color: "#6b7280" }}>{subtitle}</p>}
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
              color: "#6b7280",
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
        .account-drawer-close:hover { background: rgba(0,0,0,0.05); }
        @keyframes account-drawer-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes account-drawer-slide { from { transform: translateX(24px); opacity: 0.6; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
