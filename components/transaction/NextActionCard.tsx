"use client";

// Overview restyle 2026-07-03 — the highest-priority thing to do on this
// file, surfaced as a call-to-action tile. Data feeds from the top-priority
// reminder if one exists, else from the next pending milestone as fallback.
//
// Layout (mock 2026-07-03):
//   [flame]  NEXT ACTION                                       [calendar]
//            <title>
//            <description>
//            [Due badge]
//            [Primary]  [Secondary]  [Tertiary]  [more]
//
// Buttons + more menu are prop callbacks. No internal state — the
// container decides what "Mark complete" means (advance the reminder,
// tick the milestone, whatever).

import { Fire, CalendarBlank, DotsThree, Phone, EnvelopeSimple, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

export type NextActionKind = "chase" | "milestone" | "reminder";

export type NextActionCardProps = {
  title: string;
  description: string;
  dueLabel: string;                 // e.g. "Due today", "Due in 2 days", "Overdue"
  dueTone?: "coral" | "warn" | "muted";
  kind?: NextActionKind;
  primaryLabel?: string;            // default "Call progressor"
  secondaryLabel?: string;          // default "Send email"
  tertiaryLabel?: string;           // default "Mark complete"
  onPrimary?: () => void;
  onSecondary?: () => void;
  onTertiary?: () => void;
  onMore?: () => void;
  onCalendar?: () => void;          // top-right calendar icon
};

const DUE_TONE: Record<Required<NextActionCardProps>["dueTone"], { color: string; bg: string }> = {
  coral: { color: "var(--agent-coral-deep)", bg: "rgba(var(--agent-coral-rgb), 0.12)" },
  warn:  { color: "var(--agent-warning)",    bg: "rgba(245, 158, 11, 0.12)" },
  muted: { color: "var(--agent-text-secondary)", bg: "rgba(15,23,42,0.06)" },
};

export function NextActionCard({
  title,
  description,
  dueLabel,
  dueTone = "coral",
  primaryLabel = "Call progressor",
  secondaryLabel = "Send email",
  tertiaryLabel = "Mark complete",
  onPrimary,
  onSecondary,
  onTertiary,
  onMore,
  onCalendar,
}: NextActionCardProps) {
  const due = DUE_TONE[dueTone];

  return (
    <div
      style={{
        padding: "16px 18px",
        background: "linear-gradient(180deg, rgba(var(--agent-coral-rgb), 0.05) 0%, var(--agent-surface-elevated) 60%)",
        border: "0.5px solid rgba(var(--agent-coral-rgb), 0.14)",
        borderRadius: 14,
        position: "relative",
      }}
    >
      {/* Top row: eyebrow (with flame) + top-right calendar icon */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "rgba(var(--agent-coral-rgb), 0.12)",
            color: "var(--agent-coral-deep)",
          }}>
            <Fire size={14} weight="fill" />
          </span>
          <span className="agent-eyebrow" style={{ margin: 0 }}>
            Next action
          </span>
        </div>
        {onCalendar && (
          <IconButton onClick={onCalendar} title="Reschedule">
            <CalendarBlank size={16} weight="regular" />
          </IconButton>
        )}
      </div>

      {/* Title + description */}
      <p style={{
        margin: 0,
        fontSize: 15,
        fontWeight: 600,
        color: "var(--agent-text-primary)",
        lineHeight: 1.35,
      }}>{title}</p>
      {description && (
        <p style={{
          margin: "4px 0 0",
          fontSize: 13,
          color: "var(--agent-text-secondary)",
          lineHeight: 1.5,
        }}>{description}</p>
      )}

      {/* Due badge */}
      <p style={{
        margin: "10px 0 12px",
        display: "inline-block",
        fontSize: 12,
        fontWeight: 600,
        color: due.color,
        background: due.bg,
        borderRadius: 6,
        padding: "3px 9px",
      }}>{dueLabel}</p>

      {/* Action row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}>
        {onPrimary && (
          <ActionButton
            kind="primary"
            icon={<Phone size={14} weight="regular" />}
            label={primaryLabel}
            onClick={onPrimary}
          />
        )}
        {onSecondary && (
          <ActionButton
            kind="secondary"
            icon={<EnvelopeSimple size={14} weight="regular" />}
            label={secondaryLabel}
            onClick={onSecondary}
          />
        )}
        {onTertiary && (
          <ActionButton
            kind="secondary"
            icon={<CheckCircle size={14} weight="regular" />}
            label={tertiaryLabel}
            onClick={onTertiary}
          />
        )}
        {onMore && (
          <IconButton onClick={onMore} title="More actions">
            <DotsThree size={18} weight="bold" />
          </IconButton>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  kind, icon, label, onClick,
}: {
  kind: "primary" | "secondary";
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  const isPrimary = kind === "primary";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 12px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background 140ms ease, border-color 140ms ease",
        color: isPrimary ? "white" : "var(--agent-text-primary)",
        background: isPrimary ? "var(--agent-coral)" : "white",
        border: isPrimary ? "none" : "0.5px solid var(--agent-border-default)",
        fontFamily: "inherit",
      }}
      className={isPrimary ? "hover:bg-[var(--agent-coral-deep)]" : "hover:bg-black/[0.03]"}
    >
      {icon}
      {label}
    </button>
  );
}

function IconButton({
  onClick, title, children,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        borderRadius: 8,
        cursor: "pointer",
        color: "var(--agent-text-secondary)",
        background: "transparent",
        border: "none",
        transition: "background 140ms ease",
      }}
      className="hover:bg-black/[0.05]"
    >
      {children}
    </button>
  );
}
