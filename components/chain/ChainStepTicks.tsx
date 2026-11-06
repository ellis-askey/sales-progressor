"use client";

// The 9-step "what you've heard confirmed" tick track, shared by the chain cards
// (LinkCard) and the Chains check-ins. Same nine steps, same ChainNodeStepMark
// data, same toggle action — so a tick here is a tick there. Visual mirrors the
// check-ins' expanded milestone line (nodes + connectors + finale pair),
// compacted a touch for the card. The track scrolls horizontally with a fade
// mask when it overflows a narrow card (see the .cst-scroll wrapper in LinkCard).

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
  return (
    <div className="cst-track" role="group" aria-label="Chain progress you've confirmed">
      {CHECK_IN_STEPS.map((s) => {
        const isDone = done.has(s.key);
        return (
          <button
            key={s.key}
            type="button"
            className={`cst-step${isDone ? " done" : ""}${s.finale ? " fin" : ""}`}
            onClick={(e) => { e.stopPropagation(); if (!disabled && busyKey !== s.key) onToggle(s.key); }}
            disabled={disabled || busyKey === s.key}
            aria-pressed={isDone}
            title={s.label}
          >
            <span className="cst-node" aria-hidden>{isDone ? "✓" : ""}</span>
            <span className="cst-lbl">{s.shortLabel ?? s.label}</span>
          </button>
        );
      })}
      <style>{`
        .cst-track { display: flex; gap: 0; align-items: flex-start; }
        .cst-step { flex: 1 0 auto; min-width: 58px; position: relative; display: flex; flex-direction: column; align-items: center; gap: 5px; border: 0; background: none; font-family: inherit; cursor: pointer; padding: 0; }
        .cst-step::before, .cst-step::after { content: ""; position: absolute; top: 11px; height: 2px; background: var(--agent-border-subtle); width: 50%; }
        .cst-step::before { left: 0; } .cst-step::after { right: 0; }
        .cst-step:first-child::before, .cst-step:last-child::after { display: none; }
        .cst-step:disabled { cursor: default; }
        .cst-node { position: relative; z-index: 1; width: 23px; height: 23px; border-radius: 50%; background: var(--agent-surface-elevated, #fff); border: 1.5px solid var(--agent-border-default); display: grid; place-items: center; font-size: 11px; line-height: 1; color: transparent; transition: border-color 130ms ease, background 130ms ease, transform 130ms ease; }
        .cst-step:hover:not(:disabled) .cst-node { border-color: rgba(var(--agent-coral-rgb), 0.55); transform: scale(1.07); }
        .cst-step:focus-visible { outline: none; }
        .cst-step:focus-visible .cst-node { box-shadow: var(--agent-focus-ring); }
        .cst-step.done .cst-node { background: linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep)); border-color: transparent; color: #fff; box-shadow: 0 2px 6px rgba(var(--agent-coral-rgb), 0.3); animation: cst-pop 200ms ease; }
        .cst-lbl { font-size: 9.5px; font-weight: 650; color: var(--agent-text-muted); line-height: 1.2; text-align: center; max-width: 72px; white-space: nowrap; }
        .cst-step.done .cst-lbl { color: var(--agent-coral-darker); font-weight: 700; }
        .cst-step.fin .cst-lbl { font-weight: 750; color: var(--agent-text-secondary); }
        .cst-step.fin .cst-node { border-style: double; border-width: 3px; }
        .cst-step.fin.done .cst-node { border-style: solid; border-width: 1.5px; }
        @keyframes cst-pop { 0% { transform: scale(0.9); } 60% { transform: scale(1.08); } 100% { transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .cst-step.done .cst-node { animation: none; } }
      `}</style>
    </div>
  );
}
