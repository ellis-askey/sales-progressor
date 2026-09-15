"use client";

// Shared overlay-behaviour hook for the BESPOKE drawers (ChainDrawer,
// AddNodeDrawer, IntroCallDrawer, ReconciliationDrawer, AccountDrawer) that
// createPortal their own chrome instead of using the canonical Drawer
// primitive. It gives them the same three guarantees the primitive already
// owns, so behaviour is consistent across every drawer:
//
//   1. Body scroll-lock while the overlay is open (page can't scroll behind it).
//   2. Escape closes — routed through the drawer's own close handler so its
//      exit animation still plays (pass the animated `doClose`, not raw onClose).
//   3. Focus restoration — returns focus to whatever was focused when the
//      overlay opened, on unmount (matches OS-modal behaviour).
//
// Mount = overlay opened, unmount = overlay closed, so everything keys off the
// component lifecycle. `onClose` is read through a ref so an unstable callback
// identity doesn't tear down + re-run the effect mid-life.
//
// Deliberately NOT included: initial focus (varies per drawer — some want a
// specific field) and a focus trap (the primitive doesn't trap either; a
// uniform a11y upgrade belongs in one place later). This hook changes no
// layout and no drawer functionality — it only adds the standard overlay
// behaviours that were missing.

import { useEffect, useRef } from "react";

// `enabled` lets a component that renders the same body both as a portal overlay
// AND inline (e.g. ChainView as a drawer vs a page tab) skip the overlay
// behaviours when inline — a tab must never scroll-lock the page or hijack Escape.
// Defaults to true so every existing single-arg caller is unchanged.
export function useOverlayChrome(onClose: () => void, enabled: boolean = true): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [enabled]);
}
