"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue, useSpring, useTransform, useVelocity } from "framer-motion";
import "./LiquidToggle.css";

/* ══ Liquid toggle ════════════════════════════════════════
   Bencho's liquid toggle (bencho.dev, MIT), adapted for this app:
   made CONTROLLED (checked / onChange) and SIZEABLE (width / height /
   colour) so it can stand in for every hand-rolled switch at its own
   current size and on-colour, with the existing wiring untouched.

   Bencho's own reasoning comments are kept verbatim below — they are
   why the numbers are what they are. The toggle uses NO goo filter: it
   is one DOM circle that lengthens along its travel and thins across it
   (area-preserving), so the "liquid" is the shape of the thumb moving,
   not an SVG pass.  Two things are mine, marked [app]: the controlled
   wiring and the size/colour props. */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ══ 1 · Toggle ═══════════════════════════════════════════
   One body. The thumb crosses and lengthens into its own travel, so a
   fast flick necks it out and a slow drag keeps it round. */

/* Bencho's reference geometry is a 92×46 track with a 36 thumb and a 5
   inset. [app] We keep those RATIOS and derive the real pixels from the
   width/height each call site passes, so a 44×24 settings switch and a
   58×26 card switch are the same toggle at two sizes. */
const REF_H = 46;
const REF_THUMB = 36;
const REF_PAD = (REF_H - REF_THUMB) / 2; // 5
/* the travel on the reference (OPEN - SHUT = 92-36-5-5 = 46). The
   velocity→stretch divisor is tuned to that crossing; on a shorter track
   the peak velocity is lower, so we scale the divisor by the travel ratio
   to keep the liquid give readable at every size. */
const REF_TRAVEL = 92 - REF_THUMB - REF_PAD * 2;

export function LiquidToggle({
  /* [app] controlled: the switch reflects `checked` and reports every
     change through `onChange`, so it drops into existing state untouched. */
  checked,
  onChange,
  /* [app] the track's pixel size — each call site passes its current
     dimensions so nothing resizes. Defaults to the dominant 44×24. */
  width = 44,
  height = 24,
  /* [app] the ON colour (the track when on). A CSS colour or var, so each
     site keeps its own on-colour — coral, coral-deep, the green "fee
     received" switches, etc. Defaults to the agency's primary. */
  color = "var(--agent-coral-deep, #ff6b4a)",
  disabled = false,
  "aria-label": ariaLabel = "Toggle",
  /* how much the droplet lengthens into its own travel, 0..100 — the
     dragging ball's knob, and the same idea */
  stretch = 36,
  /* how fast it crosses, 0..100 */
  speed = 50,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  width?: number;
  height?: number;
  color?: string;
  disabled?: boolean;
  "aria-label"?: string;
  stretch?: number;
  speed?: number;
}) {
  /* [app] geometry derived from the passed size, keeping Bencho's ratios */
  const { THUMB, SHUT_X, OPEN_X, MID_X, travel } = useMemo(() => {
    const pad = Math.max(2, Math.round(height * (REF_PAD / REF_H)));
    const thumb = height - pad * 2;
    const shut = pad;
    const open = width - thumb - pad;
    return { THUMB: thumb, SHUT_X: shut, OPEN_X: open, MID_X: (shut + open) / 2, travel: Math.max(1, open - shut) };
  }, [width, height]);

  /* [app] controlled value, mirrored internally so a drag can flip it
     optimistically mid-gesture (then onChange tells the parent, whose
     update syncs back here as a no-op). */
  const [on, setOnState] = useState(checked);
  useEffect(() => { setOnState(checked); }, [checked]);
  const flip = (next: boolean) => { setOnState(next); onChange(next); };

  /* held, so the settling spring knows to keep out of the way while a
     finger owns the thumb */
  const [held, setHeld] = useState(false);
  /* the pointer is over the switch. State and not `:hover`, because what
     it drives is a spring in the same transform the position lives in. */
  const [hot, setHot] = useState(false);

  const rail = useRef<HTMLButtonElement | null>(null);
  const grip = useRef<{ id: number; grab: number | null; moved: boolean } | null>(null);

  /* ── ONE POSITION, WRITTEN TWO WAYS ──────────────────────
     The thumb's x is a motion value rather than a prop, which is what lets
     a finger and a spring both drive it without one of them having to know
     about the other: a drag writes it directly, a release animates it, and
     nothing re-renders either way. */
  const x = useMotionValue<number>(checked ? OPEN_X : SHUT_X);

  /* ── ONE BODY. STRETCH, NOT A TRAIL. ─────────────────────
     The ONE body lengthens along its direction of travel and thins across
     it, so the elasticity is in the shape of the thing moving. Area is
     kept: scaleY is 1/scaleX, so the thumb is the same amount of droplet
     whatever it is doing. */
  const vel = useVelocity(x);
  const eased = useSpring(vel, { stiffness: 380, damping: 34, mass: 0.6 });
  /* ── the divisor is the whole tuning ─────────────────────
     600 puts the peak at about 1.09 at the default, which is the ball's
     own kind of give, and the cap at 0.4 leaves the top of the knob
     somewhere to go. [app] scaled by the travel ratio so the give reads
     the same on a short track as on the reference. */
  const DIV = 600 * (travel / REF_TRAVEL);
  const lengthen = (v: number) =>
    1 + Math.min(0.4, Math.abs(v) / DIV) * (clamp(stretch, 0, 100) / 100);

  /* ── the hover swell goes in the SAME transform ──────────
     Multiplied into scaleX and scaleY here, it is a swell about the
     droplet's own centre and the position is untouched. The stretch stays
     area-preserving inside it. */
  const swell = useSpring(hot && !disabled ? 1.035 : 1, { stiffness: 380, damping: 34, mass: 0.6 });
  const wide = useTransform([eased, swell], ([v, s]: number[]) => lengthen(v) * s);
  const tall = useTransform([eased, swell], ([v, s]: number[]) => s / lengthen(v));

  /* ── how the thumb lands when it is let go ───────────────
     170/21.5 is zeta 0.87: it still arrives with a hint of give, and the
     hint is the whole of it. Speed still moves, because how fast a switch
     crosses is a real question. */
  const settle = useMemo(
    () => ({ type: "spring" as const, stiffness: 170 - (50 - speed) * 1.1, damping: 21.5, mass: 0.9 }),
    [speed],
  );

  /* Rest is wherever `on` says, applied only when nothing is holding the
     thumb. The cleanup stopping the animation is what makes grabbing it
     mid-flight work: `held` turning true tears down the settle and leaves
     the value exactly where the spring had got to. */
  useEffect(() => {
    if (held) return;
    const run = animate(x, on ? OPEN_X : SHUT_X, settle);
    return () => run.stop();
  }, [on, held, x, settle, OPEN_X, SHUT_X]);

  /* the component is drawn at whatever fraction the card allows, so a
     client delta has to be divided back out before it means anything in
     the track's own units */
  const local = (clientX: number) => {
    const el = rail.current;
    if (!el) return 0;
    const b = el.getBoundingClientRect();
    const k = b.width / (el.offsetWidth || b.width) || 1;
    return (clientX - b.left) / k;
  };

  const down = (e: React.PointerEvent) => {
    if (disabled) return;
    /* ── NO OFFSET YET. It is taken at the first MOVE. ──────
       Taking the offset at the first move means that move produces no
       displacement at all and every one after it tracks the delta — so a
       drag always starts from where the droplet actually is. There is no
       press anywhere on this control that can make it jump. */
    grip.current = { id: e.pointerId, grab: null, moved: false };
    setHeld(true);
    /* it throws if the id is not a live pointer — a synthetic event from a
       test is exactly that — and the drag is perfectly usable without it,
       so it must not take the grab down with it */
    try { rail.current?.setPointerCapture(e.pointerId); } catch { /* not live */ }
  };

  const move = (e: React.PointerEvent) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    const at = local(e.clientX);
    /* the offset, taken from where the droplet IS — the first move asks
       for exactly the position it already has. */
    if (g.grab === null) g.grab = at - x.get();
    const next = clamp(at - g.grab, SHUT_X, OPEN_X);
    if (Math.abs(next - x.get()) > 0.4) g.moved = true;
    x.set(next);
    /* it flips as it passes the middle rather than on release, so the
       track answers under your finger */
    const past = next > MID_X;
    if (past !== on) flip(past);
  };

  const up = (e: React.PointerEvent) => {
    const g = grip.current;
    if (!g) return;
    grip.current = null;
    /* ── AND THE RELEASE IS GUARDED TOO ────────────────────
       releasePointerCapture throws if the pointer was never captured —
       possible because the capture in `down` is itself guarded. Unguarded
       it threw before setHeld(false), and a switch left `held` never
       settles. */
    try { rail.current?.releasePointerCapture?.(e.pointerId); } catch { /* never captured */ }
    /* A press that never travelled is a CLICK, and a click toggles — the
       switch has to keep working as a switch. */
    if (!g.moved) flip(!on);
    setHeld(false);
  };

  return (
    <button
      ref={rail}
      type="button"
      className="liq-sw"
      data-on={on}
      data-disabled={disabled || undefined}
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      style={{ width, height, "--liq-thumb": `${THUMB}px`, "--liq-on": color } as React.CSSProperties}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerEnter={() => setHot(true)}
      onPointerLeave={() => setHot(false)}
      /* the keyboard still gets a plain switch */
      onKeyDown={(e) => {
        if (disabled || (e.key !== " " && e.key !== "Enter")) return;
        e.preventDefault();
        flip(!on);
      }}
    >
      <span className="liq-sw-blobs" aria-hidden="true">
        <motion.span className="liq-thumb" style={{ x, scaleX: wide, scaleY: tall }} />
      </span>
    </button>
  );
}
