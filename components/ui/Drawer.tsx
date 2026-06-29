// Canonical Drawer primitive. Right-anchored full-height panel with the
// same chrome contract as Modal — portal + backdrop + coral accent line +
// animation — but slid in from the right edge instead of centred.
//
// Phase 2 Week 7-8 of the discipline migration (see docs/BUILD_PLAN.md).
//
// Pattern spec: docs/reference/MODAL_DRAWER_SYSTEM.md §1.1 (Drawer).
//
// What the primitive owns (matches the spec):
//   - createPortal to document.body
//   - agent-backdrop-overlay backdrop with click-to-dismiss
//   - 2px coral accent line on top edge (suppressed when isTopmost=false
//     to prevent stacked-drawer accent collision per spec §1.1)
//   - agent-drawer-in slide-in animation
//   - Phosphor X close button (rounded-lg, ghost) in header
//   - Escape key closes
//   - Body scroll lock while open
//   - Initial focus to first focusable element (or panel itself)
//   - Focus restoration to trigger on close
//   - z-index per the locked escalation rule
//
// Compound parts: Drawer.Header, Drawer.Body, Drawer.Footer.
//
// Out of scope for Phase 2 Week 7-8 (deferred to consumer-driven Phase 3):
//   - hasUnsavedSections + close prompt — domain-specific flow that
//     composes around the primitive, not part of it.
//   - Bottom-sheet variant — emerge from real consumer per Law 14.
//   - Mobile responsive behaviour beyond viewport-clamp — spec flags
//     for future mobile pass.
//   - Full focus trap — same trade-off as Modal: matches existing
//     canonical pattern; uniform a11y upgrade in Phase 3.
//
// See docs/reference/COMPONENT_LIBRARY_CATALOG.md §2.4 for the catalog
// entry. Gallery story at app/dev/gallery/drawer/page.tsx.
"use client";

import type { ReactNode, HTMLAttributes } from "react";
import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";

type Size = "sm" | "md" | "lg" | "xl";
type ZLayer = "default" | "escalated" | "deep";

// Widths per MODAL_DRAWER_SYSTEM.md §1.1
const sizeWidth: Record<Size, string> = {
  sm: "440px",
  md: "460px",
  lg: "480px",
  xl: "560px",
};

// z-index per DESIGN_TOKENS.md "Z-index — modal escalation rule"
const zIndex: Record<ZLayer, number> = {
  default: 50,
  escalated: 1500,
  deep: 2000,
};

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  size?: Size;
  zLayer?: ZLayer;
  // When false, clicking the backdrop does NOT dismiss. Default true.
  dismissOnBackdrop?: boolean;
  // When false, hides the X close button in the header. Escape still works.
  // Default true.
  showCloseButton?: boolean;
  // Stacked-drawer accent line rule (spec §1.1). When this drawer is sitting
  // BEHIND another drawer (e.g. AddNodeDrawer opened on top of ChainDrawer),
  // pass isTopmost={false} to suppress the coral accent line so the two
  // accents don't visually collide.
  isTopmost?: boolean;
  children: ReactNode;
};

export function Drawer({
  open,
  onClose,
  ariaLabel,
  size = "md",
  zLayer = "default",
  dismissOnBackdrop = true,
  showCloseButton = true,
  isTopmost = true,
  children,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Focus restoration on close. Same pattern as Modal.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Initial focus to first focusable element inside the panel, or the
  // panel itself.
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const focusable = panelRef.current.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? panelRef.current).focus();
  }, [open]);

  // Escape key handler.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Body scroll lock while open. Records previous overflow so stacked
  // drawers don't conflict.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dismissOnBackdrop) return;
      if (e.target === e.currentTarget) onClose();
    },
    [dismissOnBackdrop, onClose],
  );

  if (!open) return null;
  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="agent-backdrop-overlay"
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: zIndex[zLayer],
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="agent-drawer-in"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          height: "100vh",
          width: "100%",
          maxWidth: sizeWidth[size],
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(32px) saturate(1.8)",
          WebkitBackdropFilter: "blur(32px) saturate(1.8)",
          borderLeft: "1px solid rgba(255,255,255,0.5)",
          // 2px coral accent line on top — suppressed when this drawer
          // is sitting behind another drawer (stacked-drawer rule §1.1).
          borderTop: isTopmost ? "2px solid var(--agent-coral-deep, #FF6B4A)" : "none",
          boxShadow: "-8px 0 40px rgba(0, 0, 0, 0.20)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 32,
              height: 32,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              color: "var(--agent-text-muted)",
              transition: "background 150ms ease",
              zIndex: 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(15,23,42,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <X size={16} weight="bold" />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ─── Compound parts ──────────────────────────────────────────────────────
//
// Padding per MODAL_DRAWER_SYSTEM.md §1.3 / §1.4 / §1.5: px-6 py-5 for
// Header + Body, px-6 py-4 for Footer. Background of bg-white/20 for
// drawers (vs none for modals) is implemented inline since it's a
// drawer-vs-modal distinction the primitive owns.

export function DrawerHeader({
  children,
  className = "",
  style,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={className}
      style={{
        flexShrink: 0,
        padding: "20px 24px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.30)",
        background: "rgba(255, 255, 255, 0.20)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function DrawerBody({
  children,
  className = "",
  style,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={className}
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "20px 24px",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function DrawerFooter({
  children,
  className = "",
  style,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={className}
      style={{
        flexShrink: 0,
        padding: "16px 24px",
        borderTop: "1px solid rgba(255, 255, 255, 0.30)",
        background: "rgba(255, 255, 255, 0.20)",
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

// Attach compound parts to the Drawer namespace.
Drawer.Header = DrawerHeader;
Drawer.Body = DrawerBody;
Drawer.Footer = DrawerFooter;
