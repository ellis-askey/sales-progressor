// Canonical Button primitive. Wraps the agent app's agent-btn CSS system
// behind a typed React API. Replaces 54 inline `<button className="agent-btn ...">`
// usages across domain folders (see docs/inventory/COMPONENTS.md).
//
// Phase 2 Week 5 of the discipline migration (see docs/BUILD_PLAN.md).
//
// Scope (locked Week 5):
//   - Button element only. Link-shaped buttons that today use
//     `<Link className="agent-btn">` stay grandfathered until a separate
//     `ButtonLink` primitive ships, because the polymorphic <button>/<a>
//     types pull in significant complexity for marginal value.
//   - Variants: primary / secondary / ghost / danger (matches existing CSS).
//   - Sizes: xs / sm / md / lg.
//   - States covered: default, hover, focus-visible, active, disabled, loading.
//
// The `agent-btn-color-primary` escape hatch from
// docs/reference/COMPONENT_LIBRARY.md is intentionally NOT exposed via this
// API — that class exists to defeat Tailwind cascade pollution in specific
// modal contexts. Consumers who need it stay on the raw className pattern
// and are grandfathered.
//
// See docs/reference/COMPONENT_LIBRARY_CATALOG.md §2.5 for the catalog
// entry. Gallery story at app/dev/gallery/button/page.tsx.

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "xs" | "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary:   "agent-btn-primary",
  secondary: "agent-btn-secondary",
  ghost:     "agent-btn-ghost",
  danger:    "agent-btn-danger",
};

const sizeClass: Record<Size, string> = {
  xs: "agent-btn-xs",
  sm: "agent-btn-sm",
  md: "agent-btn-md",
  lg: "agent-btn-lg",
};

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  variant?: Variant;
  size?: Size;
  // When true, replaces children with a spinner and disables interaction.
  // Visually suppresses the children so the button keeps its width — no
  // layout shift when toggling.
  loading?: boolean;
  // Default "button" so a primitive dropped inside a <form> doesn't
  // accidentally submit. Forms explicitly set type="submit".
  type?: "button" | "submit" | "reset";
  children?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    type = "button",
    className = "",
    children,
    ...rest
  },
  ref,
) {
  const classes = ["agent-btn", sizeClass[size], variantClass[variant], className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={size} /> : children}
    </button>
  );
});

// Inline spinner. Sized to match the button height's interior, animated
// via the same approach as the existing AgentToaster — a continuous
// 600ms rotation with reduced-motion fallback to a static dot.
function Spinner({ size }: { size: Size }) {
  const px = size === "xs" || size === "sm" ? 12 : size === "md" ? 14 : 16;
  return (
    <span
      role="presentation"
      style={{
        display: "inline-block",
        width: px,
        height: px,
        border: "2px solid currentColor",
        borderRightColor: "transparent",
        borderRadius: "50%",
        animation: "agent-spin 600ms linear infinite",
      }}
    />
  );
}
