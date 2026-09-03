import type { ReactNode } from "react";

// Labeled comms action button (Call / WhatsApp / Email). Renders an <a> when a
// href is given, a disabled <button> otherwise. Shared by the Contacts card and
// the Solicitors card so both lay out identically. Extracted from
// ContactsSection, 2026-08-10.
export function CommsButton({
  href,
  label,
  icon,
  disabled,
  title,
  // compact = icon-only pill (no label, no min-width). Additive; the default
  // labelled button is unchanged, so the Solicitors card is unaffected. Used by
  // the Contacts roster rows where space is tight. Title still carries the
  // action name for hover/screen-readers.
  compact = false,
}: {
  href?: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  title?: string;
  compact?: boolean;
}) {
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 500,
    color: disabled ? "var(--agent-text-muted)" : "var(--agent-text-secondary)",
    padding: compact ? "7px 9px" : "7px 12px",
    borderRadius: 8,
    border: "0.5px solid var(--agent-border-default)",
    background: "var(--agent-surface-elevated)",
    textDecoration: "none",
    minWidth: compact ? undefined : 88,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "background 140ms ease, border-color 140ms ease, transform 120ms ease",
  };
  if (disabled || !href) {
    return (
      <button type="button" disabled title={title ?? label} aria-label={label} style={style}>
        {icon}
        {!compact && <span>{label}</span>}
      </button>
    );
  }
  return (
    <a
      href={href}
      title={title ?? label}
      aria-label={label}
      style={style}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(15,23,42,0.045)"; e.currentTarget.style.borderColor = "rgba(15,23,42,0.20)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--agent-surface-elevated)"; e.currentTarget.style.borderColor = "var(--agent-border-default)"; e.currentTarget.style.transform = "none"; }}
      onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.95)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {icon}
      {!compact && <span>{label}</span>}
    </a>
  );
}
