// Server-safe class-string helper for the arc Button, extracted from button.tsx.
//
// button.tsx is a "use client" module, which makes every one of its exports a
// client reference. Calling such an export during a SERVER render throws
// "Attempted to call buttonClasses() from the server but buttonClasses is on the
// client" — which took down /agent/hub in prod on 2026-11-26 (hub-view.tsx +
// FirstSaleHero.tsx are server components that build the button class string).
//
// buttonClasses is a pure function (it only joins CSS-module class names, no
// React, no motion), so it lives here with no "use client" and both server and
// client components can import it. button.tsx re-exports it for existing callers.

import styles from "./button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

/** The arc Button's class string, for things that must be an anchor/Link rather than a
 *  <button> (the shadcn-style escape hatch). A `<Link className={buttonClasses({…})}>`
 *  gets the identical look — just without the press-spring / label-morph motion, which a
 *  navigation doesn't need. This is how agent-btn-on-<Link>/<a> CTAs migrate. */
export function buttonClasses(
  { variant = "primary", size = "md", icon = false, className }:
  { variant?: ButtonVariant; size?: ButtonSize; icon?: boolean; className?: string } = {},
): string {
  return [styles.button, styles[variant], styles[size], icon ? styles.icon : null, className].filter(Boolean).join(" ");
}
