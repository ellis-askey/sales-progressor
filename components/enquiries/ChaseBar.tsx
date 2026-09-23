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
  onDragCommit,
}: {
  stage: "chase" | "escalate" | "escalated" | "hold";
  progress: number;
  isSeller: boolean;
  // When provided, the ball becomes draggable: drag it across to the other side
  // and release past the halfway threshold to fire onDragCommit (the parent then
  // confirms). The ball snaps back on release; the real position only changes when
  // the confirmed action flips isSeller (which plays the normal handover dance).
  onDragCommit?: (dir: "to_seller" | "to_buyer") => void;
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

  // ── Drag-to-move (critique #20b) ──────────────────────────────────────────
  const draggable = !!onDragCommit;
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; width: number } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  function onDown(e: React.PointerEvent) {
    if (!draggable) return;
    const track = trackRef.current;
    if (!track) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, width: track.getBoundingClientRect().width };
    setDragging(true);
    e.preventDefault();
    e.stopPropagation();
  }
  function onMove(e: React.PointerEvent) {
    if (!dragging || !drag.current) return;
    const { startX, width } = drag.current;
    let dx = e.clientX - startX;
    // The ball leaves from the side it's on: seller (left) drags right only,
    // buyer (right) drags left only. Clamp to the track width.
    dx = side ? Math.max(0, Math.min(width, dx)) : Math.min(0, Math.max(-width, dx));
    setDragX(dx);
  }
  function onUp() {
    if (!dragging || !drag.current) return;
    const { width } = drag.current;
    const crossed = Math.abs(dragX) >= width * 0.55;
    setDragging(false);
    setDragX(0); // snap back; the real move happens only on confirm
    drag.current = null;
    if (crossed && onDragCommit) onDragCommit(side ? "to_buyer" : "to_seller");
  }

  return (
    <div className="enq-track" ref={trackRef}>
      {pct > 0 && (
        <span
          className="enq-fill"
          style={{ left: side ? 0 : undefined, right: side ? undefined : 0, width: `${pct}%`, background: color, opacity }}
        />
      )}
      <span
        className={`enq-ball${draggable ? " is-draggable" : ""}${dragging ? " is-dragging" : ""}`}
        style={{ left: side ? -2 : undefined, right: side ? undefined : -2, background: color, transform: dragX ? `translateX(${dragX}px)` : undefined }}
        aria-hidden={!draggable}
        role={draggable ? "button" : undefined}
        aria-label={draggable ? "Drag across to move the enquiries to the other side" : undefined}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
    </div>
  );
}
