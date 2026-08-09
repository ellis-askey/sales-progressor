// Inline "Loading X…" placeholder for hub Suspense fallbacks. Renders inside
// the real card container so the layout doesn't shift when the actual data
// arrives — the container is what's stable, only the inner text swaps.
//
// Deliberately no spinners, no shimmer, no pulse. Calm, one line of muted
// text.

export function SectionLoading({
  label,
  minHeight,
  className,
  bare = false,
}: {
  label: string;
  minHeight?: number | string;
  className?: string;
  /** Bare = no wrapper; caller has already provided a container. */
  bare?: boolean;
}) {
  const inner = (
    <p
      style={{
        margin: 0,
        fontSize: 12,
        color: "var(--agent-text-muted)",
        lineHeight: 1.5,
      }}
    >
      {label}
    </p>
  );

  if (bare) return inner;

  return (
    <div
      className={className}
      style={{
        minHeight,
        display: "flex",
        alignItems: "center",
        padding: "16px 20px",
      }}
    >
      {inner}
    </div>
  );
}
