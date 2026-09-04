"use client";

// Responsive add-partner popup shell. A centred card on desktop, a bottom
// sheet on mobile (≤ 640px, via .partner-popup-* in globals.css), animated in
// AND out. Neither the Modal nor Drawer primitive does a bottom sheet or an
// exit animation, so this is the "real consumer" the Drawer notes deferred to
// (MODAL_DRAWER_SYSTEM §1.1). Kept partner-scoped for now; a candidate to
// promote to a ui/ primitive if a second consumer appears. 2026-08-31.

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";

const CLOSE_MS = 220; // must cover the longest -out animation (sheet-out).

export function PartnerPopup({
  open,
  onClose,
  ariaLabel,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  title: string;
  children: React.ReactNode;
}) {
  // Keep the node mounted through the exit animation: render stays true until
  // the closing animation has played.
  const [render, setRender] = useState(open);
  const [closing, setClosing] = useState(false);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // The popup portals to <body>, outside .agent-shell-root, so the --agent-*
  // theme tokens don't resolve. Stamp the current agent theme on the panel so
  // its contents (text, borders, coral, glass inputs) pick them up — same
  // pattern as AddBrokerModal.
  const { theme, isNight } = usePortalTheme();

  useEffect(() => {
    if (open) {
      setRender(true);
      setClosing(false);
      return;
    }
    if (render) {
      setClosing(true);
      const t = window.setTimeout(() => {
        setRender(false);
        setClosing(false);
      }, CLOSE_MS);
      return () => window.clearTimeout(t);
    }
  }, [open, render]);

  // Focus capture/restore + initial focus, matching the Modal primitive.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    const t = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (focusable ?? panelRef.current)?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Body scroll lock while mounted.
  useEffect(() => {
    if (!render) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [render]);

  const onBackdrop = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!render) return null;
  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      className="agent-backdrop-overlay partner-popup-overlay"
      data-closing={closing ? "true" : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onBackdrop}
    >
      <div ref={panelRef} tabIndex={-1} data-theme={theme} data-night={isNight ? "" : undefined} className="partner-popup-panel" data-closing={closing ? "true" : undefined}>
        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            ...SHEET_BAND_STYLE,
          }}
        >
          <SheetBandHeader kicker="Partner" title={title} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32, height: 32, flexShrink: 0,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: "transparent", border: "none", borderRadius: 8,
              cursor: "pointer", color: "rgba(255,255,255,0.85)",
              transition: "background 150ms ease, color 150ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.85)"; }}
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Body (scrolls) */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px 22px" }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
