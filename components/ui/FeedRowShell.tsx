"use client";

import type { CSSProperties, ReactNode } from "react";

// Canonical list-row frame — the bordered strip every email / file row sits in
// (hairline border, rounded corners, glass ground, hover lift via
// .agent-email-feed-row). Previously the same recipe was hand-written in three
// places (the email feed row, the files row, the missing-email row). The frame
// is shared; the row's inner layout stays the consumer's (passed via children +
// className). Renders a <button> when onClick is given, else a <div>.
//
// `predicted` is the "forecast, not a record" treatment — a dashed left edge on
// a nested ground — used by upcoming/predicted email rows.

export function FeedRowShell({
  children,
  onClick,
  predicted = false,
  padding = "8px 10px",
  className = "",
  style,
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  predicted?: boolean;
  padding?: string;
  className?: string;
  style?: CSSProperties;
} & Record<string, unknown>) {
  const shell: CSSProperties = {
    padding,
    borderRadius: "var(--agent-radius-md, 8px)",
    border: "0.5px solid var(--agent-border-subtle, rgba(15,23,42,0.07))",
    borderLeft: predicted ? "2px dashed var(--agent-border-default, rgba(15,23,42,0.2))" : undefined,
    background: predicted ? "var(--agent-surface-nested, rgba(15,23,42,0.02))" : "var(--agent-surface-glass, transparent)",
    ...style,
  };
  const cls = `agent-email-feed-row ${className}`.trim();
  if (onClick) {
    return <button type="button" onClick={onClick} className={cls} style={shell} {...rest}>{children}</button>;
  }
  return <div className={cls} style={shell} {...rest}>{children}</div>;
}
