// Canonical Modal primitive. Wraps the agent app's modal pattern (portal +
// backdrop + centred card + coral accent line + animation) behind a typed
// React API. Replaces 18 inline `createPortal`-based modal implementations.
//
// Phase 2 Week 6-7 of the discipline migration (see docs/BUILD_PLAN.md).
//
// Pattern spec: docs/reference/MODAL_DRAWER_SYSTEM.md §1.2 (Modal). The
// primitive implements every required-chrome rule:
//   - createPortal to document.body
//   - agent-backdrop-overlay backdrop with click-to-dismiss (configurable)
//   - 2px coral accent line on the top edge of the card
//   - Phosphor X close button (rounded-lg, ghost) in the header
//   - Escape key closes
//   - Body scroll lock while open
//   - Initial focus to first focusable element (or the modal card itself)
//   - Focus restoration to the trigger element when closed
//   - z-index per the locked escalation rule (DESIGN_TOKENS §z-index)
//
// Compound parts: Modal.Header, Modal.Body, Modal.Footer. Each has the
// padding tokens documented in MODAL_DRAWER_SYSTEM §1.3 / §1.4 / §1.5.
//
// Out of scope for Phase 2 Week 6-7 (deferred to consumer-driven Phase 3):
//   - Full focus trap (we only set initial focus + restore on close).
//     None of the 18 existing modals have a focus trap either — they
//     rely on the same initial-focus pattern. Adding a focus trap is an
//     accessibility upgrade that should be applied uniformly during the
//     Phase 3 surface remediation, not bolted on now per Law 16.
//   - Confirmation dialogs (Modal.Confirm) — emerge from the first
//     consumer that needs them.
//   - Multi-step / wizard composition — same.
//
// See docs/reference/COMPONENT_LIBRARY_CATALOG.md §2.2 for the catalog
// entry. Gallery story at app/dev/gallery/modal/page.tsx.
"use client";

import type { ReactNode, HTMLAttributes } from "react";
import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";

type Size = "sm" | "md" | "lg";
type Surface = "solid" | "glass";
type ZLayer = "default" | "escalated" | "deep";

const sizeMaxWidth: Record<Size, string> = {
  sm: "384px",
  md: "448px",
  lg: "512px",
};

// z-index per docs/reference/DESIGN_TOKENS.md "Z-index — modal escalation rule".
// default — sits above the page (50). escalated — modal-over-modal e.g.
// AddBrokerModal opened on top of RelistFileModal (1500). deep — confirmation
// on top of an escalated modal (2000).
const zIndex: Record<ZLayer, number> = {
  default: 50,
  escalated: 1500,
  deep: 2000,
};

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  size?: Size;
  surface?: Surface;
  zLayer?: ZLayer;
  // When false, clicking the backdrop does NOT dismiss. Use for forms with
  // unsaved input where accidental click-out would lose data. Default true.
  dismissOnBackdrop?: boolean;
  // When false, hides the X close button in the header. Use only for
  // mandatory confirmation flows where the user MUST pick an action.
  // Escape key still works. Default true.
  showCloseButton?: boolean;
  children: ReactNode;
};

export function Modal({
  open,
  onClose,
  ariaLabel,
  size = "md",
  surface = "solid",
  zLayer = "default",
  dismissOnBackdrop = true,
  showCloseButton = true,
  children,
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Capture the element that had focus when the modal opens, then restore it
  // on close. Matches OS-modal behaviour — closing returns the user to
  // exactly where they were.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Initial focus: first focusable input/button inside the card, or the card
  // itself. Matches the AddBrokerModal canonical pattern.
  useEffect(() => {
    if (!open || !cardRef.current) return;
    const focusable = cardRef.current.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? cardRef.current).focus();
  }, [open]);

  // Escape key handler. Document-level listener so we don't depend on focus
  // being inside the modal.
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

  // Body scroll lock while open. Records the previous overflow value so
  // nested modals don't fight each other when stacked.
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
      // Only fire when clicking the backdrop directly, not bubbled from the
      // card. The card has stopPropagation on its own click handler.
      if (e.target === e.currentTarget) onClose();
    },
    [dismissOnBackdrop, onClose],
  );

  if (!open) return null;
  if (typeof window === "undefined") return null;

  const cardBackground =
    surface === "glass"
      ? { background: "rgba(255, 255, 255, 0.92)", backdropFilter: "blur(40px) saturate(180%)" as const, WebkitBackdropFilter: "blur(40px) saturate(180%)" as const }
      : { background: "white" };

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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="agent-modal-in"
        style={{
          ...cardBackground,
          width: "100%",
          maxWidth: sizeMaxWidth[size],
          maxHeight: "88vh",
          borderRadius: 16,
          // 2px coral accent line on the top edge.
          borderTop: "2px solid var(--agent-coral-deep, #FF6B4A)",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {showCloseButton && (
          // Close button rendered ABOVE the header so it sits in the
          // canonical top-right position regardless of which header
          // variant the consumer composes.
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

export function ModalHeader({
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
        padding: "20px 24px 16px",
        borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function ModalBody({
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

export function ModalFooter({
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
        borderTop: "1px solid rgba(15, 23, 42, 0.06)",
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

// Attach compound parts to the Modal namespace for the common pattern:
//   <Modal.Header>, <Modal.Body>, <Modal.Footer>
Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
