"use client";

// Canonical portal bottom sheet. One place for the shell every sheet shares:
// a blurred backdrop, the slide-up entrance AND slide-down exit (kept mounted
// through the close so it animates out instead of vanishing), the drag handle,
// the close button, body-scroll lock, and tap-the-backdrop-to-close.
//
// Why a wrapper (not a hook): the sheet's body is driven by data that the
// parent clears on close (e.g. `confirmingStep`). We cache the last body while
// open, so during the exit animation the frozen content slides down cleanly
// instead of blanking as the data goes null.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { P } from "./portal-ui";

const EXIT_MS = 320;

export function PortalSheet({
  open,
  onClose,
  children,
  closeDisabled = false,
  showClose = true,
  maxWidthClass = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Block backdrop / close-button dismissal (e.g. mid-save). */
  closeDisabled?: boolean;
  showClose?: boolean;
  maxWidthClass?: string;
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  // Freeze the body while open so it survives the exit animation after the
  // parent clears the data that produced it.
  const cached = useRef<React.ReactNode>(children);
  if (open) cached.current = children;

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  // Lock the page behind while mounted (covers the exit animation too).
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mounted]);

  if (!mounted || typeof document === "undefined") return null;

  const dismiss = () => { if (!closeDisabled) onClose(); };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end" onClick={dismiss}>
      {/* Backdrop — blur + tint fade in and out together with the sheet. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "rgba(15,23,42,0.45)",
          backdropFilter: shown ? "blur(4px)" : "blur(0px)",
          WebkitBackdropFilter: shown ? "blur(4px)" : "blur(0px)",
          opacity: shown ? 1 : 0,
          transition: `opacity ${EXIT_MS}ms ease, backdrop-filter ${EXIT_MS}ms ease`,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidthClass} mx-auto`}
        style={{
          background: P.cardBg,
          borderRadius: `${P.radiusXl} ${P.radiusXl} 0 0`,
          boxShadow: P.shadowXl,
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
          maxHeight: "90vh",
          overflowY: "auto",
          transform: shown ? "translateY(0)" : "translateY(100%)",
          transition: `transform ${EXIT_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div aria-hidden className="w-10 h-1 rounded-full" style={{ background: "rgba(139,145,163,0.30)" }} />
        </div>
        {showClose && (
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center pbtn-press"
            style={{ background: "rgba(15,23,42,0.06)", color: P.textMuted }}
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        {cached.current}
      </div>
    </div>,
    document.body,
  );
}
