import type { ReactNode } from "react";

// Canonical in-card activity row — a leading marker (an Avatar or an IconChip),
// a main sentence, an optional meta eyebrow + secondary line, and a relative
// time; divided from the row above by a hairline. These are the quiet rows that
// live INSIDE a card (the Updates feed, etc.), NOT standalone bordered rows
// (that's FeedRowShell). Type sizes are the design tokens (body-sm / caption /
// micro) rather than hand-set pixels.

export function ActivityRow({
  leading,
  main,
  meta,
  secondary,
  time,
  first = false,
}: {
  /** Leading marker — a 26px Avatar or IconChip. */
  leading: ReactNode;
  /** The headline sentence. */
  main: ReactNode;
  /** Optional eyebrow-style meta line (e.g. "Shared with client"). */
  meta?: ReactNode;
  /** Optional secondary line (clamped to 2 lines). */
  secondary?: ReactNode;
  /** Relative time ("22h ago"). */
  time: ReactNode;
  /** First row in the list — no top divider. */
  first?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3" style={{ borderTop: first ? undefined : "0.5px solid var(--agent-border-subtle)" }}>
      {leading}
      <div className="flex-1 min-w-0">
        <p style={{ margin: 0, fontSize: "var(--agent-text-body-sm)", fontWeight: 500, color: "var(--agent-text-primary)", lineHeight: 1.4 }}>{main}</p>
        {meta}
        {secondary != null && (
          <p style={{ margin: "2px 0 0", fontSize: "var(--agent-text-caption)", color: "var(--agent-text-muted)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{secondary}</p>
        )}
        <p style={{ margin: "2px 0 0", fontSize: "var(--agent-text-micro)", color: "var(--agent-text-muted)" }}>{time}</p>
      </div>
    </div>
  );
}
