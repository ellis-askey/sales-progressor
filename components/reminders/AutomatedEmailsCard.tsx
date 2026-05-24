"use client";

// Compact "automated emails on this file" accordion at the top of the
// RemindersSection. The summary text in the header gives the count + the
// next-event preview; clicking expands the body inline (pushing Due today /
// Coming up cards down) to show three grouped sections: Pending now /
// Sent today / Upcoming predicted.
//
// Uses the same accordion CSS classes as the existing reminder sections
// (agent-acc-hdr / agent-acc / agent-acc-in) so the visual + animation
// behaviour matches Due today / Coming up / Snoozed / Completed sections.
//
// Refactored from a right-side drawer (v1) to inline expansion after Ellis
// flagged the Glass-theme drawer was see-through + raised that the data
// belonged inline alongside the other accordion cards.

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react";
import { getShortName } from "@/lib/contacts/displayName";
import { EmailPreviewModal } from "@/components/email/EmailPreviewModal";
import { RoleIcon, asRole, roleLabel } from "@/components/ui/RoleIcon";
import type {
  AutomatedEmailsPreview,
  PendingEmail,
  SentEmail,
  UpcomingChase,
} from "@/lib/services/automated-emails-preview";

type Props = {
  data: AutomatedEmailsPreview;
  // Optional: when provided, renders a "View all for this file →" link at
  // the bottom of the accordion that deep-links into the platform-wide
  // automated-emails feed, filtered to just this transaction.
  transactionId?: string;
};

// Compact day-label for the inline summary.
// Returns: "today", "tomorrow", "Mon", "in 9 days" — depending on distance.
function relativeDayLabel(target: Date, now: Date = new Date()): string {
  const startOfNow = new Date(now);
  startOfNow.setUTCHours(0, 0, 0, 0);
  const startOfTarget = new Date(target);
  startOfTarget.setUTCHours(0, 0, 0, 0);
  const diffDays = Math.round((startOfTarget.getTime() - startOfNow.getTime()) / 86_400_000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays < 0) return "overdue";
  if (diffDays < 7) {
    return target.toLocaleDateString("en-GB", { weekday: "short" });
  }
  return `in ${diffDays} days`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDayAndTime(d: Date, now: Date = new Date()): string {
  const startOfNow = new Date(now);
  startOfNow.setUTCHours(0, 0, 0, 0);
  const startOfTarget = new Date(d);
  startOfTarget.setUTCHours(0, 0, 0, 0);
  const diffDays = Math.round((startOfTarget.getTime() - startOfNow.getTime()) / 86_400_000);
  const time = formatTime(d);
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Tomorrow ${time}`;
  if (diffDays < 0) return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${time}`;
  if (diffDays < 7) return `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${time}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${time}`;
}

function summaryText(data: AutomatedEmailsPreview): string {
  const todayCount = data.pending.length + data.sentToday.length;
  const nextUpcoming: UpcomingChase | undefined = data.upcoming[0];

  const nextClause = nextUpcoming
    ? `Next: ${nextUpcoming.milestoneLabel} chase to ${getShortName({ name: nextUpcoming.contactName })} ${relativeDayLabel(nextUpcoming.predictedFireDate)} ${formatTime(nextUpcoming.predictedFireDate)}`
    : null;

  if (todayCount > 0 && nextClause) {
    return `${todayCount} today · ${nextClause}`;
  }
  if (todayCount > 0) {
    return `${todayCount} automated email${todayCount === 1 ? "" : "s"} today`;
  }
  if (nextClause) {
    return nextClause;
  }
  return "No automated emails on this file in the next 14 days";
}

// ─── Section sub-components (lifted from the deleted drawer) ────────────

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

function Row({
  category,
  primary,
  secondary,
  trailing,
  previewLabel,
  onPreview,
}: {
  category: "chase" | "notification";
  primary: string;
  secondary: ReactNode;
  trailing: string;
  // When provided, shows a small "View →" / "View / Edit →" link on the
  // trailing line that opens the preview modal. Predicted-upcoming rows
  // don't have a queue row to preview — they call without onPreview.
  previewLabel?: string;
  onPreview?: () => void;
}) {
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
        <div style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary, rgba(15,23,42,0.65))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
          {secondary}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {previewLabel && onPreview && (
            <button type="button" onClick={onPreview} className="agent-link" style={{ fontSize: 11, fontWeight: 600 }}>
              {previewLabel}
            </button>
          )}
          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: "var(--agent-text-muted, rgba(15,23,42,0.50))" }}>
            {trailing}
          </p>
        </div>
      </div>
    </div>
  );
}

// Renders "To {name}" with an inline role pill (icon + capitalised label)
// derived from the contact's role string.
function ToWithRole({ name, role }: { name: string; role: string }) {
  const r = asRole(role);
  return (
    <>
      <span>To {name}</span>
      {r && (
        <>
          <span>·</span>
          <RoleIcon role={r} size={11} />
          <span>{roleLabel(r)}</span>
        </>
      )}
    </>
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

// ─── Card component ──────────────────────────────────────────────────────

export function AutomatedEmailsCard({ data, transactionId }: Props) {
  const [open, setOpen] = useState(false);
  const [previewEmailId, setPreviewEmailId] = useState<string | null>(null);
  const text = summaryText(data);
  const hasAny = data.pending.length > 0 || data.sentToday.length > 0 || data.upcoming.length > 0;

  return (
    <div className="glass-card overflow-hidden rounded-[12px] mb-3">
      <div
        className="agent-acc-hdr"
        style={{ cursor: "pointer", borderBottom: open ? undefined : "none" }}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded"
            style={{ background: hasAny ? "rgba(255,107,74,0.10)" : "rgba(15,23,42,0.05)" }}
            aria-hidden
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={hasAny ? "#FF6B4A" : "rgba(15,23,42,0.40)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-10 5L2 7" />
            </svg>
          </span>
          <p
            className="agent-acc-title truncate"
            style={{
              color: hasAny ? "var(--agent-text-primary, #1A1D29)" : "var(--agent-text-muted, rgba(15,23,42,0.50))",
              fontWeight: hasAny ? 600 : 500,
            }}
          >
            {text}
          </p>
        </div>
        <button
          type="button"
          className="agent-link agent-link-muted"
          style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        >
          <CaretDown
            size={10}
            weight="bold"
            style={{
              transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
          {open ? "Hide" : "Show"}
        </button>
      </div>

      <div className={`agent-acc ${open ? "open" : ""}`}>
        <div className="agent-acc-in">
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
                secondary={<ToWithRole name={getShortName({ name: p.recipientName })} role={p.recipientRole} />}
                trailing={`Send ${formatDayAndTime(p.scheduledFor)}`}
                previewLabel={p.category === "chase" ? "View / Edit" : "View"}
                onPreview={() => setPreviewEmailId(p.id)}
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
                secondary={<ToWithRole name={getShortName({ name: s.recipientName })} role={s.recipientRole} />}
                trailing={`Sent ${formatTime(s.sentAt)}`}
                previewLabel="View"
                onPreview={() => setPreviewEmailId(s.id)}
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
                secondary={<><ToWithRole name={getShortName({ name: u.contactName })} role={u.contactRole} /><span>· chase {u.chaseNumber} of 2</span></>}
                trailing={formatDayAndTime(u.predictedFireDate)}
              />
            ))
          )}

          {/* Caveat */}
          <p style={{ padding: "14px 20px 8px", margin: 0, fontSize: 11, color: "var(--agent-text-muted, rgba(15,23,42,0.50))", lineHeight: 1.5 }}>
            Predicted dates can shift if a chase fires earlier than expected or if the client engages.
          </p>

          {/* Deep link to the platform-wide feed, filtered to this file */}
          {transactionId && (
            <div style={{ padding: "0 20px 14px", display: "flex", justifyContent: "flex-end" }}>
              <Link
                href={`/agent/automated-emails?tab=sent&fileId=${transactionId}`}
                className="agent-link"
                style={{ fontSize: 12, fontWeight: 600 }}
              >
                View all for this file →
              </Link>
            </div>
          )}
        </div>
      </div>

      {previewEmailId && (
        <EmailPreviewModal
          emailId={previewEmailId}
          onClose={() => setPreviewEmailId(null)}
        />
      )}
    </div>
  );
}
