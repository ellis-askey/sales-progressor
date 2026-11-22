import type { CSSProperties, ReactNode } from "react";

// Canonical icon chip — a small tone-tinted circle holding an icon. The leading
// marker for non-people list items (a price change, a reply, a notification, an
// uploaded document). People rows use an Avatar instead; this pairs with the
// 26px ActorAvatar so mixed lists line up. Extracted from the Updates feed's
// KindBadge.

const TONE: Record<string, { bg: string; fg: string }> = {
  info: { bg: "rgba(var(--agent-info-rgb), 0.12)", fg: "var(--agent-info)" },
  coral: { bg: "rgba(var(--agent-coral-rgb), 0.12)", fg: "var(--agent-coral-deep)" },
  success: { bg: "rgba(var(--agent-success-rgb), 0.12)", fg: "var(--agent-success)" },
  warning: { bg: "rgba(var(--agent-warning-rgb), 0.12)", fg: "var(--agent-warning)" },
  muted: { bg: "var(--agent-hover-shade)", fg: "var(--agent-text-muted)" },
};

export function IconChip({
  children,
  tone = "info",
  size = 26,
  style,
}: {
  children: ReactNode;
  tone?: "info" | "coral" | "success" | "warning" | "muted";
  size?: number;
  style?: CSSProperties;
}) {
  const t = TONE[tone];
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: 999, background: t.bg, color: t.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...style }}>
      {children}
    </span>
  );
}
