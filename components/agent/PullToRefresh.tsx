"use client";

// Pull-to-refresh for touch devices (mobile + tablet), installed once in the
// agent shell. Reason (critique j39kxr): a home-screen PWA has no browser
// chrome to refresh from, so a page whose photos failed to load had no way to
// reload. This adds the familiar drag-down-from-the-very-top gesture.
//
// Guards: only on coarse pointers up to tablet width; only when the page is
// scrolled to the very top; never inside a dialog or an opted-out region
// ([data-no-pull]); ignores primarily-horizontal swipes so it can't hijack a
// carousel. The gesture calls router.refresh() — a soft refresh that re-runs the
// server components (re-signing photo URLs, so failed images reload) without a
// full white-flash reload.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowClockwise } from "@phosphor-icons/react";

const TRIGGER = 64; // px pulled (after resistance) to fire a refresh
const MAX = 96;     // clamp the indicator travel
const RESISTANCE = 0.5;

export function PullToRefresh() {
  const router = useRouter();
  const [dist, setDist] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  const startY = useRef<number | null>(null);
  const startX = useRef(0);
  const distRef = useRef(0);
  const armed = useRef(false);
  const busy = useRef(false);

  // Mirror the pending state into a ref so the bound-once touch handlers see it,
  // and snap the indicator away once a refresh completes.
  useEffect(() => {
    busy.current = refreshing;
    if (!refreshing) { distRef.current = 0; setDist(0); setDragging(false); }
  }, [refreshing]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: coarse) and (max-width: 1024px)").matches) return;

    function onStart(e: TouchEvent) {
      if (busy.current || window.scrollY > 0) { startY.current = null; return; }
      const t = e.target as Element | null;
      if (t && t.closest('[role="dialog"], [data-no-pull]')) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      armed.current = false;
    }

    function onMove(e: TouchEvent) {
      if (startY.current === null || busy.current) return;
      const dy = e.touches[0].clientY - startY.current;
      const dx = e.touches[0].clientX - startX.current;
      if (!armed.current) {
        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return; // wait for a real move
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) { startY.current = null; return; } // not a downward pull
        armed.current = true;
        setDragging(true);
      }
      const d = Math.min(MAX, dy * RESISTANCE);
      distRef.current = d;
      setDist(d);
      if (e.cancelable) e.preventDefault(); // suppress native overscroll / browser pull-to-refresh
    }

    function onEnd() {
      if (startY.current === null) return;
      const fire = distRef.current >= TRIGGER;
      startY.current = null;
      armed.current = false;
      setDragging(false);
      if (fire) {
        setDist(TRIGGER); // hold the spinner at the trigger line while it refreshes
        startRefresh(() => router.refresh());
      } else {
        distRef.current = 0;
        setDist(0);
      }
    }

    function onCancel() {
      startY.current = null; armed.current = false; distRef.current = 0;
      setDragging(false); setDist(0);
    }

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
    };
  }, [router]);

  const progress = Math.min(1, dist / TRIGGER);
  const visible = dist > 0 || refreshing;
  const y = visible ? Math.max(8, dist - 6) : -44;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 60,
        display: "flex", justifyContent: "center", pointerEvents: "none",
        transform: `translateY(${y}px)`,
        transition: dragging ? "none" : "transform 280ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <span
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 34, height: 34, borderRadius: "50%",
          background: "var(--agent-surface-elevated, #fff)",
          boxShadow: "0 4px 14px rgba(15,23,42,0.18)",
          border: "0.5px solid var(--agent-border-subtle, rgba(15,23,42,0.10))",
          color: "var(--agent-coral-deep, #E0492B)",
          opacity: visible ? 1 : 0,
        }}
      >
        <ArrowClockwise
          size={18}
          weight="bold"
          style={
            refreshing
              ? { animation: "agent-spin 700ms linear infinite" }
              : { transform: `rotate(${progress * 270}deg)`, transition: dragging ? "none" : "transform 120ms linear" }
          }
        />
      </span>
    </div>
  );
}
