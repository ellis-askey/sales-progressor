"use client";

// Canonical inline confirm / cancel — a stacked tick + X that spring in together, the
// tick drawing itself. Replaces a "Done" button on an in-place editor (e.g. the sale-hero
// address editor). Deliberately a STANDALONE control, not part of any input component —
// the editor composes it. Confirm = keep + close; cancel = the caller decides (typically
// revert + close). The cancel X reuses the canonical circle-X treatment (quiet circle,
// tints on hover).

import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { X } from "@phosphor-icons/react";

// Snappy, no-overshoot spring — matches the app's icon-enter feel.
const SPRING = { type: "spring" as const, stiffness: 520, damping: 30, mass: 0.7 };

/** The tick draws itself from its short stroke, the way a hand would write it. */
function DrawnCheck({ reduced, size, delay }: { reduced: boolean; size: number; delay: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <motion.path
        d="M4 12.5l5 5L20 6.5"
        initial={reduced ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ pathLength: { duration: 0.22, ease: [0.22, 1, 0.36, 1], delay }, opacity: { duration: 0.05, delay } }}
      />
    </svg>
  );
}

export function EditConfirmActions({
  onConfirm,
  onCancel,
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  orientation = "column",
  size = 30,
  startDelay = 0,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  orientation?: "column" | "row";
  /** Diameter of each circle. */
  size?: number;
  /** Hold the whole control invisible, then spring it in after this many seconds —
   *  so it enters AFTER the editor it sits in has finished revealing, not clipped
   *  mid-reveal. Default 0 (immediate). */
  startDelay?: number;
}) {
  const reduced = useReducedMotion() ?? false;
  const enter = (delay: number) =>
    reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.12, delay: startDelay } }
      : {
          initial: { opacity: 0, scale: 0.6, filter: "blur(3px)" },
          animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
          transition: { ...SPRING, delay: startDelay + delay },
        };
  const circle: CSSProperties = { width: size, height: size, borderRadius: 999, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 };

  return (
    <div style={{ display: "flex", flexDirection: orientation, gap: 8, alignItems: "center" }}>
      <motion.button
        type="button"
        aria-label={confirmLabel}
        onPointerDown={(e) => e.preventDefault()}
        onClick={onConfirm}
        {...enter(0)}
        style={{ ...circle, border: "none", background: "var(--agent-coral-deep, #FF6B4A)", color: "#fff", boxShadow: "0 2px 10px rgba(255,107,74,0.35)" }}
      >
        <DrawnCheck reduced={reduced} size={Math.round(size * 0.5)} delay={reduced ? 0 : startDelay + 0.16} />
      </motion.button>
      <motion.button
        type="button"
        aria-label={cancelLabel}
        onPointerDown={(e) => e.preventDefault()}
        onClick={onCancel}
        {...enter(0.05)}
        className="eca-cancel"
        style={{ ...circle, background: "var(--agent-surface-muted, rgba(45,24,16,0.05))", border: "1px solid var(--agent-border-default)", color: "var(--agent-text-secondary)", boxShadow: "0 1px 3px rgba(45,24,16,0.08)", transition: "background .14s ease, color .14s ease" }}
      >
        <X size={Math.round(size * 0.47)} weight="bold" aria-hidden="true" />
      </motion.button>
    </div>
  );
}
