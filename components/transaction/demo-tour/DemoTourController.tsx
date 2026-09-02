"use client";

// The demo guided-walkthrough engine.
//
// Runs INSIDE the real demo file, so it renders under PropertyFileTabs'
// TabContext and can switch tabs programmatically. It resolves each step's real
// target by a stable selector, scrolls it into view, dims the rest of the file
// with a four-panel veil (leaving the target clickable through a hole), rings
// the target, and floats a small guide card. Every advance is an explicit user
// action. The whole overlay renders through a portal at the "escalated" z-rung
// so it clears the top bar + sidebar.
//
// Robustness (all handled below): target not yet mounted, tab change, scroll /
// resize reflow, the agent clicking elsewhere, refresh mid-tour, and a demo that
// gets removed. If a target can't be resolved it degrades (skips / finishes)
// rather than stalling. See docs/DEMO_SALE_GUIDED_EXPERIENCE_PLAN.md §12/§15.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { useTabContext } from "@/components/transaction/TabContext";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import * as analytics from "@/lib/analytics/posthog";
import { useReducedMotion } from "./useReducedMotion";
import { DEMO_TOUR_EVENTS, DEMO_TOUR_STEPS, type TourStep } from "./types";

type Rect = { top: number; left: number; width: number; height: number };

const Z = 1500; // "escalated" rung — above top bar (200) + sidebar (100)
const HOLE_PAD = 8;
const CARD_W = 344;
const CARD_GAP = 14;
const MOBILE_MAX = 640;
const RESOLVE_TIMEOUT = 1600; // ms to wait for a target to mount before skipping

// The overlay renders through a portal at document.body, OUTSIDE the agent CSS
// scope, so the scoped .agent-btn / .agent-glass classes don't reach it. Style
// the card + buttons inline so they render solid (not dimmed like the veil) and
// look like real buttons wherever they mount.
const CARD_STYLE: React.CSSProperties = {
  background: "var(--agent-surface-elevated)",
  border: "1px solid var(--agent-border-default)",
  borderRadius: 22,
  boxShadow: "0 24px 64px rgba(15, 23, 42, 0.32)",
};

// Button styles live in a stylesheet (injected into the portal) rather than
// inline, so they get real :hover / :active states — every tour button lifts
// on hover and presses on click, reduced-motion aware.
const TOUR_STYLES = `
  .dtour-btn-primary, .dtour-btn-secondary {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    border-radius: 12px; cursor: pointer;
    transition: filter 160ms ease, background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 120ms ease;
  }
  .dtour-btn-primary {
    background: linear-gradient(135deg, var(--agent-coral-deep), var(--agent-coral-light));
    color: var(--agent-text-on-coral); border: none;
    box-shadow: 0 4px 16px rgba(var(--agent-coral-rgb), 0.28);
  }
  .dtour-btn-primary:hover { filter: brightness(1.06); box-shadow: 0 6px 22px rgba(var(--agent-coral-rgb), 0.40); transform: translateY(-1px); }
  .dtour-btn-primary:active { transform: scale(0.98); }
  .dtour-btn-secondary {
    background: transparent; color: var(--agent-text-primary);
    border: 1px solid var(--agent-border-default);
  }
  .dtour-btn-secondary:hover { background: var(--agent-surface-nested, rgba(15, 23, 42, 0.04)); border-color: var(--agent-text-muted); }
  .dtour-btn-secondary:active { transform: scale(0.98); }
  .dtour-btn-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border-radius: 8px; padding: 0;
    background: transparent; color: var(--agent-text-muted); border: none; cursor: pointer;
    transition: background 160ms ease, color 160ms ease, transform 120ms ease;
  }
  .dtour-btn-icon:hover { background: var(--agent-surface-nested, rgba(15, 23, 42, 0.06)); color: var(--agent-text-primary); }
  .dtour-btn-icon:active { transform: scale(0.9); }
  .dtour-btn-primary:focus-visible, .dtour-btn-secondary:focus-visible, .dtour-btn-icon:focus-visible {
    outline: 2px solid var(--agent-coral); outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .dtour-btn-primary, .dtour-btn-secondary, .dtour-btn-icon { transition: none; }
    .dtour-btn-primary:hover, .dtour-btn-primary:active, .dtour-btn-secondary:active, .dtour-btn-icon:active { transform: none; }
  }
`;

function deviceClass(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth;
  return w < MOBILE_MAX ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

// Keep keyboard focus inside the guide/finish card while a step is active, so
// Tab doesn't wander into the dimmed-but-still-focusable file behind the veil.
function trapTab(e: React.KeyboardEvent<HTMLDivElement>) {
  if (e.key !== "Tab") return;
  const focusables = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])'),
  ).filter((el) => !el.hasAttribute("disabled"));
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const activeEl = document.activeElement;
  if (activeEl === e.currentTarget) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  } else if (e.shiftKey && activeEl === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && activeEl === last) {
    e.preventDefault();
    first.focus();
  }
}

export function DemoTourController({
  autoStart = false,
  onClose,
  steps = DEMO_TOUR_STEPS,
}: {
  autoStart?: boolean;
  // Called whenever the tour ends (finish or skip) so the host can persist
  // "seen" state. reason distinguishes a completed run from an early exit.
  onClose?: (reason: "completed" | "skipped") => void;
  steps?: TourStep[];
}) {
  const { setActiveTab } = useTabContext();
  const reducedMotion = useReducedMotion();
  // The overlay portals to document.body — a sibling of .agent-shell-root — so
  // it must stamp the theme on its own root or every var(--agent-*) resolves to
  // nothing (transparent card, unstyled buttons). Canonical portal pattern.
  const { theme, isNight } = usePortalTheme();

  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false); // terminal finish card
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const targetElRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const runTokenRef = useRef(0); // invalidates in-flight async work when the step changes
  // Always points at the latest advance() — lets the click-target listener (set
  // up inside enterStep) advance without enterStep closing over advance, which
  // would form a memoisation cycle.
  const advanceRef = useRef<() => void>(() => {});

  const total = steps.length;

  // ── Target measurement ────────────────────────────────────────────────────
  const measure = useCallback(() => {
    const el = targetElRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, []);

  const detachStep = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    targetElRef.current = null;
  }, []);

  // ── Fire analytics (names land in the allow-list in the analytics PR; calls
  //    are safely dropped until then) ────────────────────────────────────────
  const emit = useCallback((event: string, extra: Record<string, unknown> = {}) => {
    try {
      analytics.track(event, { deviceClass: deviceClass(), totalSteps: total, ...extra });
    } catch {
      /* analytics must never break the tour */
    }
  }, [total]);

  // ── End the tour ──────────────────────────────────────────────────────────
  const end = useCallback((reason: "completed" | "skipped", stepId?: string, stepNumber?: number) => {
    runTokenRef.current += 1;
    detachStep();
    setRunning(false);
    setFinished(false);
    setRect(null);
    if (reason === "completed") emit("demo_tour_completed");
    else emit("demo_tour_skipped", { stepId, stepNumber });
    onClose?.(reason);
  }, [detachStep, emit, onClose]);

  // ── Enter a step: switch tab, resolve + scroll to target, wire listeners ───
  const enterStep = useCallback(async (i: number) => {
    detachStep();
    const token = ++runTokenRef.current;

    if (i >= steps.length) {
      // Ran off the end via skips — show the finish card.
      setRunning(false);
      setRect(null);
      setFinished(true);
      return;
    }

    const step = steps[i];
    setIndex(i);
    setRect(null);

    if (step.tab) setActiveTab(step.tab);

    // Poll for the target to mount (panels are always in the DOM, but a
    // just-switched tab / late stream can lag a frame or two).
    const deadline = performance.now() + RESOLVE_TIMEOUT;
    const el = await new Promise<HTMLElement | null>((resolve) => {
      const tick = () => {
        if (token !== runTokenRef.current) return resolve(null); // superseded
        const found = document.querySelector(step.target) as HTMLElement | null;
        if (found && found.getBoundingClientRect().width > 0) return resolve(found);
        if (performance.now() > deadline) return resolve(null);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    if (token !== runTokenRef.current) return; // step changed while resolving

    if (!el) {
      // Target missing (e.g. Chase tab absent). Optional → skip; otherwise also
      // skip forward so the tour never stalls on a missing anchor.
      enterStep(i + 1);
      return;
    }

    targetElRef.current = el;
    emit("demo_tour_step_viewed", { stepId: step.id, stepNumber: i + 1 });

    el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center", inline: "nearest" });

    // Let the scroll settle, then measure and start tracking.
    const settle = reducedMotion ? 0 : 320;
    window.setTimeout(() => {
      if (token !== runTokenRef.current) return;
      measure();

      const onReflow = () => requestAnimationFrame(measure);
      window.addEventListener("scroll", onReflow, { passive: true });
      window.addEventListener("resize", onReflow);
      const ro = new ResizeObserver(onReflow);
      ro.observe(el);
      ro.observe(document.body);

      // click-target: advancing when the agent clicks the real element. Its own
      // handler still runs (we don't preventDefault) — the confirm is safe
      // (demo files emit nothing outbound).
      let onTargetClick: ((e: Event) => void) | null = null;
      if (step.advance === "click-target") {
        onTargetClick = () => advanceRef.current();
        el.addEventListener("click", onTargetClick, { once: true });
      }

      cleanupRef.current = () => {
        window.removeEventListener("scroll", onReflow);
        window.removeEventListener("resize", onReflow);
        ro.disconnect();
        if (onTargetClick) el.removeEventListener("click", onTargetClick);
      };
    }, settle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, setActiveTab, reducedMotion, measure, detachStep, emit]);

  // ── Advance / start ───────────────────────────────────────────────────────
  const advance = useCallback(() => {
    const cur = steps[index];
    emit("demo_tour_step_completed", { stepId: cur?.id, stepNumber: index + 1, interactionType: cur?.advance });
    const next = index + 1;
    if (next >= steps.length) {
      detachStep();
      setRunning(false);
      setRect(null);
      setFinished(true);
      return;
    }
    enterStep(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, steps, emit, enterStep, detachStep]);

  const start = useCallback(() => {
    setFinished(false);
    setRunning(true);
    emit("demo_tour_started");
    enterStep(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emit, enterStep]);

  // Keep the ref the click-target listener reads pointed at the latest advance.
  useEffect(() => { advanceRef.current = advance; }, [advance]);

  // ── Wiring: window event to (re)start, optional auto-start, Escape, cleanup ─
  useEffect(() => {
    const onStart = () => start();
    window.addEventListener(DEMO_TOUR_EVENTS.start, onStart);
    return () => window.removeEventListener(DEMO_TOUR_EVENTS.start, onStart);
  }, [start]);

  // The controller mounts only on a demo file, so mount == demo opened. Flag
  // the body so global chrome (the Getting-started checklist) can fade out
  // while we're on the demo, and reappear when the agent leaves it.
  useEffect(() => {
    emit("demo_opened", { autoStart });
    document.body.setAttribute("data-demo-file", "1");
    return () => { document.body.removeAttribute("data-demo-file"); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoStart) {
      const t = window.setTimeout(() => start(), 600);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end("skipped", steps[index]?.id, index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, index, steps, end]);

  useEffect(() => () => detachStep(), [detachStep]);

  // Focus the guide card heading on each step for keyboard + screen-reader users.
  useEffect(() => {
    if (running && rect) cardRef.current?.focus();
  }, [running, index, rect]);

  if (typeof document === "undefined") return null;
  if (!running && !finished) return null;

  const step = steps[index];
  const isMobile = typeof window !== "undefined" && window.innerWidth < MOBILE_MAX;

  return createPortal(
    <div
      data-theme={theme}
      data-night={isNight ? "" : undefined}
      aria-live="polite"
      style={{ position: "fixed", inset: 0, zIndex: Z, pointerEvents: "none" }}
    >
      <style>{TOUR_STYLES}</style>
      {running && rect && (
        <SpotlightOverlay
          rect={rect}
          step={step}
          index={index}
          total={total}
          isMobile={isMobile}
          reducedMotion={reducedMotion}
          cardRef={cardRef}
          onAdvance={advance}
          onSkip={() => end("skipped", step?.id, index + 1)}
        />
      )}
      {finished && (
        <FinishCard
          reducedMotion={reducedMotion}
          onAddSale={() => { end("completed"); window.location.assign("/agent/transactions/new"); }}
          onExplore={() => end("completed")}
        />
      )}
    </div>,
    document.body,
  );
}

// ── The dim veil (4 panels) + ring + guide card for one step ─────────────────
function SpotlightOverlay({
  rect, step, index, total, isMobile, reducedMotion, cardRef, onAdvance, onSkip,
}: {
  rect: Rect;
  step: TourStep;
  index: number;
  total: number;
  isMobile: boolean;
  reducedMotion: boolean;
  cardRef: React.RefObject<HTMLDivElement>;
  onAdvance: () => void;
  onSkip: () => void;
}) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // The clickable hole, clamped to the viewport.
  const hole = {
    t: Math.max(rect.top - HOLE_PAD, 0),
    l: Math.max(rect.left - HOLE_PAD, 0),
    w: Math.min(rect.width + HOLE_PAD * 2, vw),
    h: Math.min(rect.height + HOLE_PAD * 2, vh),
  };
  const veil = "rgba(15, 23, 42, 0.42)";
  const panelTransition = reducedMotion ? "none" : "all 240ms cubic-bezier(0.22,1,0.36,1)";
  const panelBase: React.CSSProperties = { position: "fixed", background: veil, pointerEvents: "auto", transition: panelTransition };

  // Guide-card placement.
  const roomBelow = vh - (hole.t + hole.h);
  const placeBelow = step.placement === "bottom" || (step.placement !== "top" && roomBelow > 220);
  const cardStyle: React.CSSProperties = isMobile
    ? { position: "fixed", left: 12, right: 12, bottom: 12, width: "auto" }
    : {
        position: "fixed",
        width: CARD_W,
        left: Math.min(Math.max(hole.l, 12), vw - CARD_W - 12),
        ...(placeBelow ? { top: hole.t + hole.h + CARD_GAP } : { bottom: vh - hole.t + CARD_GAP }),
      };

  return (
    <>
      {/* Dim frame — four panels leave the target hole open + clickable. */}
      <div style={{ ...panelBase, top: 0, left: 0, width: "100vw", height: hole.t }} />
      <div style={{ ...panelBase, top: hole.t + hole.h, left: 0, width: "100vw", height: Math.max(vh - (hole.t + hole.h), 0) }} />
      <div style={{ ...panelBase, top: hole.t, left: 0, width: hole.l, height: hole.h }} />
      <div style={{ ...panelBase, top: hole.t, left: hole.l + hole.w, width: Math.max(vw - (hole.l + hole.w), 0), height: hole.h }} />

      {/* Coral ring around the target. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: hole.t, left: hole.l, width: hole.w, height: hole.h,
          borderRadius: 16,
          boxShadow: "0 0 0 2px var(--agent-coral), 0 0 0 6px rgba(var(--agent-coral-rgb), 0.22)",
          pointerEvents: "none",
          transition: reducedMotion ? "none" : "all 240ms cubic-bezier(0.22,1,0.36,1)",
        }}
      />

      {/* Guide card. */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-label={`Walkthrough step ${index + 1} of ${total}: ${step.title}`}
        tabIndex={-1}
        onKeyDown={trapTab}
        style={{
          ...cardStyle,
          ...CARD_STYLE,
          pointerEvents: "auto",
          padding: "17px 19px",
          outline: "none",
          animation: reducedMotion ? "none" : "agent-modal-in 200ms cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-coral-deep)" }}>
            Step {index + 1} of {total}
          </span>
          <button onClick={onSkip} aria-label="Skip walkthrough" className="dtour-btn-icon">
            <X size={14} weight="bold" />
          </button>
        </div>
        <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.3 }}>
          {step.title}
        </p>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.55 }}>
          {step.body}
        </p>
        <button
          onClick={onAdvance}
          className="dtour-btn-primary"
          style={{ marginTop: 16, width: "100%", fontSize: 13.5, fontWeight: 700, padding: "11px 18px" }}
        >
          {index + 1 === total ? "Finish" : "Continue"}
        </button>
      </div>
    </>
  );
}

// ── Terminal finish card (centered, no target) ───────────────────────────────
function FinishCard({
  reducedMotion, onAddSale, onExplore,
}: {
  reducedMotion: boolean;
  onAddSale: () => void;
  onExplore: () => void;
}) {
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.42)", pointerEvents: "auto" }} />
      <div
        role="dialog"
        aria-label="Walkthrough complete"
        tabIndex={-1}
        onKeyDown={trapTab}
        style={{
          ...CARD_STYLE,
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: "min(430px, calc(100vw - 32px))",
          padding: "26px 28px", pointerEvents: "auto",
          animation: reducedMotion ? "none" : "agent-modal-in 220ms cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        <p style={{ margin: "0 0 7px", fontSize: 18, fontWeight: 700, color: "var(--agent-text-primary)" }}>
          That&rsquo;s a sale in Sales Progressor
        </p>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.55 }}>
          Add your first sale and we&rsquo;ll start doing the same for you. The demo will stay here if you want to come back and explore.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button autoFocus onClick={onAddSale} className="dtour-btn-primary" style={{ padding: "12px 18px", fontSize: 14, fontWeight: 700 }}>
            Add my first sale
          </button>
          <button onClick={onExplore} className="dtour-btn-secondary" style={{ padding: "11px 18px", fontSize: 13.5, fontWeight: 600 }}>
            Keep exploring
          </button>
        </div>
      </div>
    </>
  );
}
