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
import { GlassCard } from "@/components/glass/GlassCard";
import { Pill } from "@/components/ui/Pill";

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
  belowActions?: ReactNode;         // e.g. the "up next" reminder list, in-card
};

const DUE_PILL_TONE: Record<Required<NextActionCardProps>["dueTone"], "brand" | "warning" | "muted"> = {
  coral: "brand",
  warn:  "warning",
  muted: "muted",
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
  belowActions,
}: NextActionCardProps) {
  const duePillTone = DUE_PILL_TONE[dueTone];

  return (
    // Design Lab: `overview-next-action`. Default v15 (Gradient hairline)
    // per Ellis's final pick set, 2026-08-08 evening pass. Coral tint /
    // border stripped from the inline style — surface treatment lives in
    // the glass variant class.
    <GlassCard
      glassId="overview-next-action"
      label="Overview · Next action"
      defaultVariant="v15"
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        position: "relative",
      }}
    >
      {/* Option B — hero + queue. Two panes on wide screens: the action on the
          left, the "Up next" queue (belowActions) on the right; stacks on
          mobile. Same props/callbacks — nothing added or removed, just laid
          out in two columns. */}
      <div className={belowActions ? "na-wrap na-two" : "na-wrap"}>
        <div className="na-hero">
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
                width: 26,
                height: 26,
                color: "var(--agent-coral-deep)",
              }}>
                <Fire size={17} weight="fill" />
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

          {/* Title, with the due pill to its right on wide screens */}
          <div className="na-titlerow">
            <p className="na-title" style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              color: "var(--agent-text-primary)",
              lineHeight: 1.35,
            }}>{title}</p>
            <span className="na-due-inline">
              <Pill glass tone={duePillTone} size="md">{dueLabel}</Pill>
            </span>
          </div>
          {description && (
            <p style={{
              margin: "4px 0 0",
              fontSize: 13,
              color: "var(--agent-text-secondary)",
              lineHeight: 1.5,
            }}>{description}</p>
          )}

          {/* Due badge — drops below on the tablet/mobile breakpoint */}
          <div className="na-due-block" style={{ marginTop: 10 }}>
            <Pill glass tone={duePillTone} size="md">{dueLabel}</Pill>
          </div>

          {/* Action row */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 14,
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

        {belowActions && (
          <div className="na-queue">
            {belowActions}
          </div>
        )}
      </div>

      <style>{`
        .na-titlerow{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
        .na-title{flex:1;min-width:0}
        .na-due-inline{flex-shrink:0;margin-top:1px}
        .na-due-block{display:none}
        .na-queue{margin-top:14px;border-top:0.5px solid var(--agent-border-default);padding-top:12px}
        @media (max-width:767px){
          .na-due-inline{display:none}
          .na-due-block{display:block}
        }
        @media (min-width:768px){
          .na-two{display:grid;grid-template-columns:1.5fr 1fr;gap:18px;align-items:start}
          .na-two .na-queue{margin-top:0;border-top:none;border-left:0.5px solid var(--agent-border-default);padding-top:0;padding-left:18px}
        }
      `}</style>
    </GlassCard>
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
        background: isPrimary ? "var(--agent-coral)" : "var(--agent-surface-elevated)",
        border: isPrimary ? "none" : "0.5px solid var(--agent-border-default)",
        fontFamily: "inherit",
      }}
      className={isPrimary ? "hover:bg-[var(--agent-coral-deep)]" : "agent-hover-row"}
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
      className="agent-hover-row"
    >
      {children}
    </button>
  );
}
