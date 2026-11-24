import type { ReactNode } from "react";

// Shared team-member row: a 34px leading slot (avatar / role chip / envelope),
// a name + secondary line, and a trailing slot (badge + any controls). The same
// anatomy was written out separately in the roster, the pending-invite list, the
// removed-member list and the active-invitation card; this is the one copy.
// Text colours come from the agent theme tokens.

export function TeamMemberRow({
  leading,
  name,
  sub,
  trailing,
  last = false,
}: {
  leading: ReactNode;
  name: ReactNode;
  /** Secondary line (string or JSX). Omit for a single-line row. */
  sub?: ReactNode;
  /** Right-aligned slot: a Badge, a control, a menu, etc. */
  trailing?: ReactNode;
  /** Drop the bottom hairline on the last row. */
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "13px 2px",
        borderBottom: last ? "none" : "0.5px solid rgba(0,0,0,0.06)",
      }}
    >
      {leading}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </p>
        {sub != null && (
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sub}
          </p>
        )}
      </div>
      {trailing}
    </div>
  );
}
