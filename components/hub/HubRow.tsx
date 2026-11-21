// Canonical hub property ROW scaffold. Extracted 2026-11-21 from the four attention
// cards that each hand-rolled the identical row chrome (HubListCard, StalledEnquiries,
// ExchangeOverdue, ReviewsDue). It owns ONLY the repeated scaffold — the `agent-hover-row`
// wrapper, the 3px left accent bar, the i>0 top separator, the flex body wrapper and the
// responsive `hub-r-tail`. Every card keeps its own tuned content (address, status text,
// meta line, actions) as slots, so the migration is byte-for-byte for the three cards that
// already matched this anatomy. ReviewsDue, which previously had no accent + 20px left pad,
// now flows through the same scaffold (accent = its per-row status colour, 17px pad) — the
// one approved visual change (compare: /dev/components/compare/hub-rows, N2·4).

import type { ReactNode } from "react";

export function HubRow({
  accent,
  separated,
  thumb,
  tail,
  children,
  bodyClassName,
  tailClassName,
  after,
}: {
  /** Left accent bar colour. null → a transparent 3px bar (keeps the 17px text edge). */
  accent: string | null;
  /** The i>0 flush-row separator (0.5px top hairline). */
  separated?: boolean;
  /** Thumbnail slot (the card builds its own Link / PropertyThumb). */
  thumb: ReactNode;
  /** Right-hand action cluster — rendered inside `.hub-r-tail` (the card owns breakpoints). */
  tail: ReactNode;
  /** Body: address block + optional status text + meta line. */
  children: ReactNode;
  /** Extra class on the body wrapper (e.g. HubListCard's "hub-r-body" mobile reflow). */
  bodyClassName?: string;
  /** Extra class on the tail (e.g. "hub-r-tail--x" for phone-hidden tails). */
  tailClassName?: string;
  /** Direct children rendered AFTER the tail — the phone-only subtext / ✕ dismiss. */
  after?: ReactNode;
}) {
  return (
    <div
      className="agent-hover-row"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "12px 20px 12px 17px",
        borderLeft: `3px solid ${accent ?? "transparent"}`,
        borderTop: separated ? "0.5px solid var(--agent-border-subtle)" : undefined,
      }}
    >
      {thumb}
      <div className={bodyClassName} style={{ minWidth: 0, flex: "1 1 220px" }}>{children}</div>
      <div className={tailClassName ? `hub-r-tail ${tailClassName}` : "hub-r-tail"}>{tail}</div>
      {after}
    </div>
  );
}
