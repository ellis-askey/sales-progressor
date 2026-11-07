"use client";

// The 9-step "what you've heard confirmed" tick track, shown on the chain cards
// (ChainMapPanel) and mirrored by the Chains check-ins tab. Same nine steps, same
// ChainNodeStepMark data, same toggle — so a tick here is a tick there. The track
// scrolls sideways when it overflows a narrow card; on desktop it's click-drag
// scrollable, on touch it's swipe-scrollable. A drag never counts as a tap.

import { useRef } from "react";
import { CHECK_IN_STEPS } from "@/lib/chain/check-in-steps";

export function ChainStepTicks({
  steps,
  onToggle,
  disabled = false,
  busyKey = null,
}: {
  // The confirmed step keys (your side's ChainNodeStepMark set for this link).
  steps: readonly string[];
  onToggle: (key: string) => void;
  disabled?: boolean;
  busyKey?: string | null;
}) {
  const done = new Set(steps);
  const viewRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, moved: false, startX: 0, startScroll: 0 });

  return (
    <div
      ref={viewRef}
      className="cst-viewport"
      role="group"
      aria-label="Chain progress you've confirmed"
      onPointerDown={(e) => {
        const el = viewRef.current;
        if (!el) return;
        drag.current = { down: true, moved: false, startX: e.clientX, startScroll: el.scrollLeft };
      }}
      onPointerMove={(e) => {
        const el = viewRef.current;
        if (!el || !drag.current.down) return;
        const dx = e.clientX - drag.current.startX;
        if (!drag.current.moved && Math.abs(dx) > 4) {
          drag.current.moved = true;
          el.setPointerCapture?.(e.pointerId);
        }
        if (drag.current.moved) el.scrollLeft = drag.current.startScroll - dx;
      }}
      onPointerUp={() => { drag.current.down = false; }}
      onPointerCancel={() => { drag.current.down = false; }}
    >
      <div className="cst-track">
        {CHECK_IN_STEPS.map((s) => {
          const isDone = done.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              className={`cst-step${isDone ? " done" : ""}${s.finale ? " fin" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (drag.current.moved) return; // was a drag, not a tap
                if (!disabled && busyKey !== s.key) onToggle(s.key);
              }}
              disabled={disabled || busyKey === s.key}
              aria-pressed={isDone}
              title={s.label}
            >
              <span className="cst-node" aria-hidden>{isDone ? "✓" : ""}</span>
              <span className="cst-lbl">{s.shortLabel ?? s.label}</span>
            </button>
          );
        })}
      </div>
      <style>{`
        .cst-viewport { overflow-x: auto; overflow-y: hidden; max-width: 100%; cursor: grab;
          scrollbar-width: none; touch-action: pan-x; -webkit-overflow-scrolling: touch;
          -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 18px, #000 calc(100% - 22px), transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0, #000 18px, #000 calc(100% - 22px), transparent 100%); }
        .cst-viewport::-webkit-scrollbar { display: none; }
        .cst-viewport:active { cursor: grabbing; }
        .cst-track { display: flex; gap: 0; align-items: flex-start; width: max-content; min-width: 100%;
          padding: 6px 2px 2px; user-select: none; -webkit-user-select: none; }
        .cst-step { flex: 1 0 auto; min-width: 76px; position: relative; display: flex; flex-direction: column;
          align-items: center; gap: 7px; border: 0; background: none; font-family: inherit; cursor: inherit; padding: 0; }
        .cst-step::before, .cst-step::after { content: ""; position: absolute; top: 10px; height: 2px; background: var(--agent-border-subtle); width: 50%; }
        .cst-step::before { left: 0; } .cst-step::after { right: 0; }
        .cst-step:first-child::before, .cst-step:last-child::after { display: none; }
        .cst-step:disabled { cursor: default; }
        .cst-node { position: relative; z-index: 1; width: 22px; height: 22px; border-radius: 50%;
          background: var(--agent-surface-elevated, #fff); border: 1.5px solid var(--agent-border-default);
          display: grid; place-items: center; font-size: 11px; line-height: 1; color: transparent; flex-shrink: 0;
          transition: border-color 130ms ease, background 130ms ease, transform 130ms ease; }
        .cst-step:hover:not(:disabled) .cst-node { border-color: rgba(var(--agent-coral-rgb), 0.55); transform: scale(1.08); }
        .cst-step:focus-visible { outline: none; }
        .cst-step:focus-visible .cst-node { box-shadow: 0 0 0 2px rgba(var(--agent-coral-rgb), 0.4); }
        .cst-step.done .cst-node { background: linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep));
          border-color: transparent; color: #fff; box-shadow: 0 2px 6px rgba(var(--agent-coral-rgb), 0.3); }
        .cst-lbl { font-size: 9.5px; font-weight: 650; color: var(--agent-text-muted); line-height: 1.2;
          text-align: center; max-width: 72px; white-space: normal; overflow-wrap: anywhere; }
        .cst-step.done .cst-lbl { color: var(--agent-coral-darker); font-weight: 700; }
        .cst-step.fin .cst-lbl { font-weight: 750; color: var(--agent-text-secondary); }
        .cst-step.fin .cst-node { border-style: double; border-width: 3px; }
        .cst-step.fin.done .cst-node { border-style: solid; border-width: 1.5px; }
      `}</style>
    </div>
  );
}
