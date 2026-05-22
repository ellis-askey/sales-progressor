"use client";

// Right-side slide-out drawer showing the full automated-emails breakdown
// for a single transaction. Three grouped sections:
//   - Pending now (queued, not yet sent) — amber accent
//   - Sent today (last 24h) — green accent
//   - Upcoming (predicted from active ClientChaseState) — neutral accent
//
// Shell pattern mirrors components/chase/ChaseDrawer.tsx — portal-rendered,
// backdrop blur, .agent-drawer-in / .agent-drawer-out animations, 200ms
// close-delay so the slide-out completes before unmounting.
//
// Read-only view; no actions in v1.

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import type {
  AutomatedEmailsPreview,
  PendingEmail,
  SentEmail,
  UpcomingChase,
} from "@/lib/services/automated-emails-preview";

type Props = {
  data: AutomatedEmailsPreview;
  onClose: () => void;
};

function formatTimeOfDay(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDayAndTime(d: Date, now: Date = new Date()): string {
  const startOfNow = new Date(now);
  startOfNow.setUTCHours(0, 0, 0, 0);
  const startOfTarget = new Date(d);
  startOfTarget.setUTCHours(0, 0, 0, 0);
  const diffDays = Math.round((startOfTarget.getTime() - startOfNow.getTime()) / 86_400_000);
  const time = formatTimeOfDay(d);
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Tomorrow ${time}`;
  if (diffDays < 0) return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${time}`;
  if (diffDays < 7) return `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${time}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${time}`;
}

function CategoryChip({ category }: { category: "chase" | "notification" }) {
  const style = category === "chase"
    ? { background: "#ffedd5", color: "#9a3412" }
    : { background: "#dbeafe", color: "#1e40af" };
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontWeight: 700,
        padding: "1px 6px",
        borderRadius: 4,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        flexShrink: 0,
        ...style,
      }}
    >
      {category}
    </span>
  );
}

function SectionHeader({ label, count, accent }: { label: string; count: number; accent: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 20px",
        borderBottom: "0.5px solid var(--agent-border-subtle, rgba(15,23,42,0.08))",
        background: accent,
      }}
    >
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--agent-text-primary, #1A1D29)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </p>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-secondary, rgba(15,23,42,0.65))" }}>
        {count}
      </span>
    </div>
  );
}

function Row({ category, primary, secondary, trailing }: { category: "chase" | "notification"; primary: string; secondary: string; trailing: string }) {
  return (
    <div
      style={{
        padding: "10px 20px",
        borderBottom: "0.5px solid var(--agent-border-subtle, rgba(15,23,42,0.06))",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <CategoryChip category={category} />
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary, #1A1D29)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {primary}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingLeft: 2 }}>
        <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary, rgba(15,23,42,0.65))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {secondary}
        </p>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: "var(--agent-text-muted, rgba(15,23,42,0.50))", flexShrink: 0 }}>
          {trailing}
        </p>
      </div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle, rgba(15,23,42,0.06))" }}>
      <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted, rgba(15,23,42,0.50))", fontStyle: "italic" }}>
        {text}
      </p>
    </div>
  );
}

export function AutomatedEmailsDrawer({ data, onClose }: Props) {
  const theme = usePortalTheme();
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  function doClose() {
    if (closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 200);
  }

  return createPortal(
    <div className="fixed inset-0 flex justify-end" data-theme={theme} style={{ zIndex: 1000 }}>
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", animation: "agent-backdrop-in 200ms ease both" }}
        onClick={doClose}
      />

      <div
        className="relative z-10 flex flex-col h-full"
        style={{
          width: "min(440px, 100vw)",
          background: "var(--agent-surface-elevated)",
          borderLeft: "0.5px solid rgba(0,0,0,0.08)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.10)",
          animation: closing
            ? "agent-drawer-out 200ms cubic-bezier(0.25,0,0,1) forwards"
            : "agent-drawer-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 20px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              Automated emails
            </p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-secondary)" }}>
              Pending, sent today, and predicted upcoming
            </p>
          </div>
          <button onClick={doClose} aria-label="Close" className="agent-icon-btn agent-icon-btn-sm">
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Pending now */}
          <SectionHeader label="Pending now" count={data.pending.length} accent="rgba(254, 215, 170, 0.20)" />
          {data.pending.length === 0 ? (
            <EmptyLine text="Nothing queued right now." />
          ) : (
            data.pending.map((p: PendingEmail) => (
              <Row
                key={p.id}
                category={p.category}
                primary={p.subject}
                secondary={`To ${p.recipientName} (${p.recipientRole})`}
                trailing={`Send ${formatDayAndTime(p.scheduledFor)}`}
              />
            ))
          )}

          {/* Sent today */}
          <SectionHeader label="Sent today" count={data.sentToday.length} accent="rgba(187, 247, 208, 0.20)" />
          {data.sentToday.length === 0 ? (
            <EmptyLine text="Nothing sent today yet." />
          ) : (
            data.sentToday.map((s: SentEmail) => (
              <Row
                key={s.id}
                category={s.category}
                primary={s.subject}
                secondary={`To ${s.recipientName} (${s.recipientRole})`}
                trailing={`Sent ${formatTimeOfDay(s.sentAt)}`}
              />
            ))
          )}

          {/* Upcoming */}
          <SectionHeader label="Upcoming (predicted)" count={data.upcoming.length} accent="rgba(15, 23, 42, 0.04)" />
          {data.upcoming.length === 0 ? (
            <EmptyLine text="Nothing predicted in the next 14 days." />
          ) : (
            data.upcoming.map((u: UpcomingChase, i: number) => (
              <Row
                key={`${u.contactId}-${u.milestoneCode}-${i}`}
                category="chase"
                primary={`${u.milestoneLabel} chase`}
                secondary={`To ${u.contactName} (${u.contactRole}) · chase ${u.chaseNumber} of 2`}
                trailing={formatDayAndTime(u.predictedFireDate)}
              />
            ))
          )}

          {/* Caveat */}
          <p style={{ padding: "14px 20px", margin: 0, fontSize: 11, color: "var(--agent-text-muted, rgba(15,23,42,0.50))", lineHeight: 1.5 }}>
            Predicted dates can shift if a chase fires earlier than expected or if the client engages.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
