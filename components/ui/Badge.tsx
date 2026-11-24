import type { ReactNode } from "react";

// Canonical badge — a small uppercase tag with a hairline border and coloured
// text, NO colour-fill wash (per the no-faded-fill rule). Used for roles
// (Director / Negotiator), statuses, and similar short labels.

export type BadgeTone = "neutral" | "accent" | "amber" | "success" | "danger";

const TONES: Record<BadgeTone, { border: string; color: string }> = {
  neutral: { border: "var(--agent-border-default, rgba(0,0,0,0.16))", color: "var(--agent-text-muted)" },
  accent: { border: "rgba(var(--agent-coral-rgb), 0.45)", color: "var(--agent-coral-deep, #E2452A)" },
  amber: { border: "rgba(201,125,26,0.45)", color: "#B07A1A" },
  success: { border: "rgba(47,158,107,0.4)", color: "#2F9E6B" },
  danger: { border: "rgba(199,62,62,0.4)", color: "#C73E3E" },
};

export function Badge({ children, tone = "neutral", caps = true }: { children: ReactNode; tone?: BadgeTone; caps?: boolean }) {
  const t = TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
        fontSize: caps ? 10 : 11,
        fontWeight: 700,
        textTransform: caps ? "uppercase" : "none",
        letterSpacing: caps ? 0.6 : 0.1,
        padding: "3px 8px",
        borderRadius: 6,
        background: "transparent",
        border: `1px solid ${t.border}`,
        color: t.color,
      }}
    >
      {children}
    </span>
  );
}
