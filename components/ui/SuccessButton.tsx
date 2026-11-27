"use client";

// SuccessButton (interaction audit, 2026-11-27). The button you press confirms on
// itself: idle -> "Saving..." (the arc Button's own spinner) -> a tick draws on +
// "Saved" -> settles back; a failed save shows "Try again". The tick appears ONLY
// after the async op resolves true, so success is never shown before it happens.
// Duplicate clicks while in-flight are ignored. A clean drop-in for the arc
// Button: same variant/size/className/style, plus a `run` that returns success.
// (Error-state shake intentionally omitted for v1 so this stays a single arc
// Button with no transform conflict against the Button's own Framer whileTap.)

import { useState, useCallback, type ReactNode, type CSSProperties } from "react";
import { Button, type ButtonVariant, type ButtonSize } from "@/components/arc/button/button";
import { AnimatedTick } from "@/components/ui/AnimatedTick";

type State = "idle" | "loading" | "success" | "error";

export function SuccessButton({
  run,
  children,
  savingLabel = "Saving...",
  successLabel = "Saved",
  errorLabel = "Try again",
  variant = "primary",
  size = "md",
  disabled = false,
  className,
  style,
}: {
  /** The real save. Resolve true for success, false (or throw) for failure. */
  run: () => Promise<boolean>;
  /** Idle label / content. */
  children: ReactNode;
  savingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const [state, setState] = useState<State>("idle");

  const onClick = useCallback(async () => {
    if (state === "loading") return; // ignore duplicate clicks while saving
    setState("loading");
    let ok = false;
    try { ok = await run(); } catch { ok = false; }
    setState(ok ? "success" : "error");
    window.setTimeout(() => setState("idle"), ok ? 1400 : 1600);
  }, [state, run]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      loading={state === "loading"}
      disabled={disabled}
      onClick={onClick}
      aria-live="polite"
      style={style}
    >
      {state === "success" && <AnimatedTick size={15} color="currentColor" strokeWidth={2.5} style={{ marginRight: 6 }} />}
      {state === "loading" ? savingLabel : state === "success" ? successLabel : state === "error" ? errorLabel : children}
    </Button>
  );
}
