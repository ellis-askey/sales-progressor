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

import { Fire, DotsThree, Phone, EnvelopeSimple, CheckCircle, Bell, BellRinging, Clock, Siren, ArrowsClockwise, LinkBreak, SealCheck, ChatCircleDots, Warning, ListChecks, Star, HandWaving } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { GlassCard } from "@/components/glass/GlassCard";

// Icon state picked per Ellis's selections (2026-11-08 state-icon artifact):
// snoozed=Zzz, overdue=BellRinging, due=Bell, upcoming=Clock, escalated=Siren,
// auto=ArrowsClockwise (loop), chain=LinkBreak. Default keeps the flame.
//
// Per-row TYPE glyphs (critique #280) — as the card grows past chases into a
// typed feed, each non-chase action leads with its own glyph: confirm a step,
// an enquiry to action, a file problem, a to-do, a review to request, file setup.
export type NextActionIcon =
  | "overdue" | "due" | "snoozed" | "upcoming" | "escalated" | "auto" | "chain" | "default"
  | "confirm" | "enquiry" | "problem" | "task" | "review" | "setup";

// Three "z" sleeping glyph — phosphor has no Zzz, so this is the artifact's.
function Zzz({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h6l-6 7h6M13 5h5l-5 6h5M18 14h4l-4 4h4" />
    </svg>
  );
}

function stateIcon(icon: NextActionIcon): ReactNode {
  switch (icon) {
    case "overdue":   return <BellRinging size={24} weight="fill" />;
    case "due":       return <Bell size={24} weight="fill" />;
    case "snoozed":   return <Zzz size={24} />;
    case "upcoming":  return <Clock size={24} weight="fill" />;
    case "escalated": return <Siren size={24} weight="fill" />;
    case "auto":      return <ArrowsClockwise size={24} weight="bold" />;
    case "chain":     return <LinkBreak size={24} weight="bold" />;
    case "confirm":   return <SealCheck size={24} weight="fill" />;
    case "enquiry":   return <ChatCircleDots size={24} weight="fill" />;
    case "problem":   return <Warning size={24} weight="fill" />;
    case "task":      return <ListChecks size={24} weight="bold" />;
    case "review":    return <Star size={24} weight="fill" />;
    case "setup":     return <HandWaving size={24} weight="fill" />;
    default:          return <Fire size={24} weight="fill" />;
  }
}

export type NextActionKind = "chase" | "milestone" | "reminder";

export type NextActionCardProps = {
  title: string;
  description: string;
  dueLabel: string;                 // e.g. "Due today", "Due in 2 days", "Overdue"
  dueTone?: "coral" | "warn" | "muted";
  // Which glyph leads the card. Defaults to the flame; swaps with the state.
  icon?: NextActionIcon;
  kind?: NextActionKind;
  primaryLabel?: string;            // default "Call progressor"
  secondaryLabel?: string;          // default "Send email"
  tertiaryLabel?: string;           // default "Mark complete"
  onPrimary?: () => void;
  onSecondary?: () => void;
  onTertiary?: () => void;
  onMore?: () => void;
  snoozeSlot?: ReactNode;           // top-right control (the snooze popover trigger)
  belowActions?: ReactNode;         // e.g. the "up next" reminder list, in-card
};

const DUE_TEXT_COLOR: Record<Required<NextActionCardProps>["dueTone"], string> = {
  coral: "var(--agent-coral-deep)",
  warn:  "var(--agent-warning)",
  muted: "var(--agent-text-muted)",
};

export function NextActionCard({
  title,
  description,
  dueLabel,
  dueTone = "coral",
  icon = "default",
  primaryLabel = "Call progressor",
  secondaryLabel = "Send email",
  tertiaryLabel = "Mark complete",
  onPrimary,
  onSecondary,
  onTertiary,
  onMore,
  snoozeSlot,
  belowActions,
}: NextActionCardProps) {
  const dueColor = DUE_TEXT_COLOR[dueTone];
  // State icons take the status colour so glyph + line read as one; the default
  // flame keeps its brand coral.
  const iconColor = icon === "default" ? "var(--agent-coral-deep)" : dueColor;

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
          {/* Eyebrow + top-right snooze control */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <span className="agent-eyebrow" style={{ margin: 0 }}>
              Next action
            </span>
            {snoozeSlot}
          </div>

          {/* Flame to the left of a stacked [title / status] block. The status
              (overdue / snoozed-until / no-reminder) is a plain coloured line
              here, not a pill. */}
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: iconColor,
            }}>
              {stateIcon(icon)}
            </span>
            <div style={{ minWidth: 0 }}>
              <p className="na-title" style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 600,
                color: "var(--agent-text-primary)",
                lineHeight: 1.3,
              }}>{title}</p>
              <div style={{
                marginTop: 2,
                fontSize: 12.5,
                fontWeight: 600,
                color: dueColor,
                lineHeight: 1.3,
              }}>{dueLabel}</div>
            </div>
          </div>

          {description && (
            <p style={{
              margin: "9px 0 0",
              paddingLeft: 35,
              fontSize: 13,
              color: "var(--agent-text-secondary)",
              lineHeight: 1.5,
            }}>{description}</p>
          )}

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
        .na-queue{margin-top:14px;border-top:0.5px solid var(--agent-border-default);padding-top:12px}
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
