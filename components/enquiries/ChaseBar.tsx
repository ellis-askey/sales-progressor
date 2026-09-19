"use client";

// The court-track chase bar. A clear ball sits on the side the ball is with; a
// coloured fill grows from that side toward the other as the chase (coral, 0→7
// working days) then escalation (red, 7→13) nears. Blue = holding to an expected
// date. On a HANDOVER (the side flips) it plays the staged dance: the fill drains
// on the old side, then the ball switches and a fresh fill grows from the new
// side. Reduced-motion collapses that to an instant switch.

import { useEffect, useRef, useState } from "react";

const STAGE_COLOR: Record<string, string> = {
  chase: "var(--agent-coral)",
  escalate: "var(--agent-danger)",
  escalated: "var(--agent-danger)",
  hold: "var(--agent-info)",
};

export function ChaseBar({
  stage,
  progress,
  isSeller,
}: {
  stage: "chase" | "escalate" | "escalated" | "hold";
  progress: number;
  isSeller: boolean;
}) {
  const targetPct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  const color = STAGE_COLOR[stage] ?? "var(--agent-coral)";

  // Displayed side + width — driven directly except during the handover dance.
  const [side, setSide] = useState(isSeller);
  const [pct, setPct] = useState(targetPct);
  const prevSide = useRef(isSeller);
  const first = useRef(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
    if (first.current) {
      first.current = false;
      prevSide.current = isSeller;
      setSide(isSeller);
      setPct(targetPct);
      return;
    }
    const reduce = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prevSide.current !== isSeller) {
      prevSide.current = isSeller;
      if (reduce) { setSide(isSeller); setPct(targetPct); return; }
      clear();
      // 1) drain on the current side → 2) switch side (still empty) →
      // 3) grow from the new side.
      setPct(0);
      timers.current.push(setTimeout(() => {
        setSide(isSeller);
        timers.current.push(setTimeout(() => setPct(targetPct), 90));
      }, 380));
      return clear;
    }

    // Same side: track the target (covers the coral→red reset at day 7, where
    // targetPct drops back near 0 and regrows red).
    setSide(isSeller);
    setPct(targetPct);
    return clear;
  }, [isSeller, targetPct]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const opacity = 0.45 + 0.5 * (pct / 100);

  return (
    <div className="enq-track">
      {pct > 0 && (
        <span
          className="enq-fill"
          style={{ left: side ? 0 : undefined, right: side ? undefined : 0, width: `${pct}%`, background: color, opacity }}
        />
      )}
      <span
        className="enq-ball"
        style={{ left: side ? -2 : undefined, right: side ? undefined : -2, background: color }}
        aria-hidden
      />
    </div>
  );
}
