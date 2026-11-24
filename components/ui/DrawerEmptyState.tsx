import type { ReactNode } from "react";

// Canonical empty state for slide-over drawers — the "hero" treatment for the
// one primary-action moment in a drawer (e.g. "Build this sale's chain").
//
// Distinct from components/ui/EmptyState.tsx, which is the quieter, light-only
// icon+title+description used inline when there's nothing for the user to do.
// Drawers render on dark grounds too, so this one is theme-aware — it reads its
// type scale and colours from the --agent-* tokens rather than hardcoding
// slate/white, which also removes the per-call isNight branching consumers used
// to carry.
//
// It carries the flat canonical CTA treatment (.agent-canon-cta on the wrapper),
// so an action passed as `agent-btn agent-btn-primary` renders as the flat coral
// button (matching NoChainSetupCard / ViewChainButton), not the app-wide glossy
// primary. See docs/reference/COMPONENT_LIBRARY_CATALOG.md.
export function DrawerEmptyState({
  title,
  description,
  action,
  footnote,
  icon,
}: {
  title: string;
  description?: ReactNode;
  // Primary action — pass `agent-btn agent-btn-md agent-btn-primary` to get the
  // flat canonical coral CTA.
  action?: ReactNode;
  // Small helper line below the action (e.g. "You can add or change links at any time.").
  footnote?: ReactNode;
  // Optional icon, rendered in a coral-tint chip above the title.
  icon?: ReactNode;
}) {
  return (
    <div className="agent-canon-cta flex flex-col items-center justify-center text-center px-6 py-16">
      {icon && (
        <div
          className="flex items-center justify-center mb-4"
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            background: "rgba(var(--agent-coral-rgb), 0.12)",
            color: "var(--agent-coral-deep)",
          }}
        >
          {icon}
        </div>
      )}
      <h3
        className="font-bold tracking-tight"
        style={{ fontSize: "var(--agent-text-h2)", color: "var(--agent-text-primary)" }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="mt-2 max-w-sm leading-relaxed"
          style={{ fontSize: "var(--agent-text-body)", color: "var(--agent-text-muted)" }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
      {footnote && (
        <p
          className="mt-4"
          style={{ fontSize: "var(--agent-text-caption)", color: "var(--agent-text-disabled)" }}
        >
          {footnote}
        </p>
      )}
    </div>
  );
}
