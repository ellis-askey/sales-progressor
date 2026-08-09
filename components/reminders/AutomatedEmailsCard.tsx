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
import { useAutoAnimate } from "@formkit/auto-animate/react";
import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react";
import { getShortName } from "@/lib/contacts/displayName";
import { EmailPreviewModal } from "@/components/email/EmailPreviewModal";
import { RoleIcon, asRole, roleLabel } from "@/components/ui/RoleIcon";
import { Card } from "@/components/ui/Card";
import type {
  AutomatedEmailsPreview,
  DeliveryStatus,
  PauseState,
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
  // Optimistic suppression — milestone codes the parent has just snoozed
  // (server roundtrip still in flight). The Upcoming list filters these out
  // locally so snoozed chases vanish instantly instead of sitting there
  // "as if they're going to send" for the few seconds before revalidation
  // catches up.
  optimisticallySnoozedCodes?: Set<string>;
  // When the parent file is on_hold, automation is paused at the cron
  // level (client-chase-cron only processes active txs). The card
  // reflects this with a paused state so the user sees "this is off"
  // instead of stale predictions.
  fileOnHold?: boolean;
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
  // Always render in UK time. The Date is stored UTC; without an explicit
  // timeZone the server-rendered string was Vercel's UTC and showed "01:00"
  // when the chase actually fires at 09:30 UK (08:30 UTC under BST). All
  // chase send times are normalised to 09:30 UK at the data layer
  // (lib/services/reminders.ts setUkChaseTime); this aligns the render.
  return d.toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDayAndTime(d: Date, now: Date = new Date(), missedSlot = false): string {
  if (missedSlot) return `waiting to send`;
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

// A predicted chase fire is "missed" when its calendar day equals today
// AND the predicted wall-clock time is already in the past. See PR1 sketch:
// once a chase fires successfully, ClientChaseState updates and the next
// prediction shifts forward, so a stale "Today HH:MM" past its time is
// exactly the signal that nothing fired — paused or otherwise.
function isMissedSlot(predictedFireDate: Date, now: Date = new Date()): boolean {
  if (predictedFireDate >= now) return false;
  const startOfNow = new Date(now);
  startOfNow.setUTCHours(0, 0, 0, 0);
  const startOfTarget = new Date(predictedFireDate);
  startOfTarget.setUTCHours(0, 0, 0, 0);
  return startOfTarget.getTime() === startOfNow.getTime();
}

// Header pill for the active pause reason. Most-global wins (see preview
// service comment for the priority rationale). Returns null when no pause
// is active so the healthy default stays clean.
function PauseStatusPill({ pauseState }: { pauseState: PauseState }) {
  if (!pauseState.activePauseReason) return null;
  const label =
    pauseState.activePauseReason === "global"
      ? "Auto chases paused, system-wide"
      : pauseState.activePauseReason === "agency"
      ? `Auto chases paused, agency-wide${pauseState.agencyName ? ` (${pauseState.agencyName})` : ""}`
      : "Auto chases paused, this file";
  return (
    <div
      style={{
        margin: "10px 20px 0",
        padding: "6px 10px",
        background: "rgba(254, 215, 170, 0.30)",
        border: "0.5px solid rgba(234, 88, 12, 0.25)",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        color: "#9a3412",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        letterSpacing: "0.02em",
      }}
      role="status"
    >
      <span aria-hidden style={{ fontSize: 11 }}>⏸</span>
      {label}
    </div>
  );
}

// Tiny per-row chip — minimal because the header pill already carries
// the why. Sits next to the trailing time on Upcoming rows.
function PauseChip() {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "1px 5px",
        borderRadius: 4,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        background: "rgba(254, 215, 170, 0.35)",
        color: "#9a3412",
        flexShrink: 0,
      }}
    >
      paused
    </span>
  );
}

// Delivery-status chip on Sent Today rows. Reflects what SendGrid's
// Event Webhook told us happened AFTER we handed the message off —
// truthful, not just "sent". Hidden when status is "delivered" (the
// healthy default) to keep happy rows uncluttered; only abnormal
// states show a chip.
function DeliveryChip({ status, deferredCount, reason }: {
  status: DeliveryStatus;
  deferredCount: number;
  reason: string | null;
}) {
  if (status === "delivered") return null; // happy path stays clean
  if (status === "unknown") return null;   // pre-webhook rows / events not yet in
  let label: string;
  let style: { bg: string; fg: string };
  if (status === "deferred") {
    label = deferredCount > 1 ? `deferred (${deferredCount}x)` : "deferred";
    style = { bg: "rgba(254, 215, 170, 0.35)", fg: "#9a3412" };
  } else if (status === "bounced") {
    label = "bounced";
    style = { bg: "rgba(254, 202, 202, 0.40)", fg: "#991b1b" };
  } else {
    label = "blocked";
    style = { bg: "rgba(254, 202, 202, 0.40)", fg: "#991b1b" };
  }
  return (
    <span
      title={reason ?? undefined}
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "1px 5px",
        borderRadius: 4,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        background: style.bg,
        color: style.fg,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

// Sent-row trailing label — replaces "Sent HH:MM" with a state-aware
// variant when delivery info is in. Delivered shows ✓; deferred shows
// the latest deferral time; bounced/blocked show the bounce time.
function sentTrailingLabel(s: SentEmail): string {
  const sentTime = s.sentAt.toLocaleTimeString("en-GB", {
    timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  if (s.deliveryStatus === "delivered" && s.deliveredAt) {
    const deliveredTime = s.deliveredAt.toLocaleTimeString("en-GB", {
      timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    return `Delivered ${deliveredTime}`;
  }
  return `Sent ${sentTime}`;
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
  trailingChip,
  trailingMuted,
  previewLabel,
  onPreview,
}: {
  category: "chase" | "notification";
  primary: string;
  secondary: ReactNode;
  trailing: string;
  // Optional inline chip rendered immediately before the trailing text
  // (e.g. the "paused" pill on Upcoming chases when the file/agency/env
  // is off). Kept minimal — header pill carries the explanation.
  trailingChip?: ReactNode;
  // When true the trailing label uses a more-muted colour, signalling a
  // missed/non-fired prediction. Distinguishes "earlier today (didn't fire)"
  // from "Today 09:30" upcoming items at a glance.
  trailingMuted?: boolean;
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {previewLabel && onPreview && (
            <button type="button" onClick={onPreview} className="agent-link" style={{ fontSize: 11, fontWeight: 600 }}>
              {previewLabel}
            </button>
          )}
          {trailingChip}
          <p style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 500,
            color: trailingMuted
              ? "var(--agent-text-muted, rgba(15,23,42,0.40))"
              : "var(--agent-text-muted, rgba(15,23,42,0.50))",
            fontStyle: trailingMuted ? "italic" : undefined,
          }}>
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

export function AutomatedEmailsCard({ data, transactionId, optimisticallySnoozedCodes, fileOnHold }: Props) {
  // Local filter: drop any Upcoming chase whose milestoneCode the parent
  // has just optimistically snoozed. Pending + Sent today are unaffected
  // (those are real queue rows that have already been written to DB).
  const visibleUpcoming = optimisticallySnoozedCodes && optimisticallySnoozedCodes.size > 0
    ? data.upcoming.filter((u) => !optimisticallySnoozedCodes.has(u.milestoneCode))
    : data.upcoming;
  const [pendingRef] = useAutoAnimate<HTMLDivElement>();
  const [sentRef] = useAutoAnimate<HTMLDivElement>();
  const [upcomingRef] = useAutoAnimate<HTMLDivElement>();
  const [open, setOpen] = useState(false);
  const [previewEmailId, setPreviewEmailId] = useState<string | null>(null);
  const text = fileOnHold ? "Automation paused, file on hold" : summaryText(data);
  const hasAny = !fileOnHold && (data.pending.length > 0 || data.sentToday.length > 0 || data.upcoming.length > 0);

  return (
    <Card glassId="reminders-automated-emails" glassLabel="Reminders · Automated emails" glassDefault="v22" padding="none" className="mb-3">
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
          {fileOnHold ? (
            <div style={{ padding: "20px 20px 24px", display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                <span aria-hidden style={{ fontSize: 14 }}>⏸</span>
                Automation paused
              </span>
              <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
                This file is on hold: no client chases, no escalations, no scheduled emails will fire until it&apos;s reactivated. Pending sends are held until the file resumes.
              </p>
            </div>
          ) : (
            <>
          {/* Pause-state pill — only renders when a pause is actually
              active (env off / agency off / file paused). Most-global
              wins so the user sees the operative blocker. */}
          <PauseStatusPill pauseState={data.pauseState} />

          {/* Pending now */}
          <SectionHeader label="Pending now" count={data.pending.length} accent="rgba(254, 215, 170, 0.20)" />
          <div ref={pendingRef}>
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
          </div>

          {/* Sent today */}
          <SectionHeader label="Sent today" count={data.sentToday.length} accent="rgba(187, 247, 208, 0.20)" />
          <div ref={sentRef}>
            {data.sentToday.length === 0 ? (
              <EmptyLine text="Nothing sent today yet." />
            ) : (
              data.sentToday.map((s: SentEmail) => {
                const reason = s.bouncedReason ?? s.blockedReason ?? s.deferredReason;
                return (
                  <Row
                    key={s.id}
                    category={s.category}
                    primary={s.subject}
                    secondary={<ToWithRole name={getShortName({ name: s.recipientName })} role={s.recipientRole} />}
                    trailing={sentTrailingLabel(s)}
                    trailingChip={
                      <DeliveryChip
                        status={s.deliveryStatus}
                        deferredCount={s.deferredCount}
                        reason={reason}
                      />
                    }
                    previewLabel="View"
                    onPreview={() => setPreviewEmailId(s.id)}
                  />
                );
              })
            )}
          </div>

          {/* Upcoming */}
          <SectionHeader label="Upcoming (predicted)" count={visibleUpcoming.length} accent="rgba(15, 23, 42, 0.04)" />
          <div ref={upcomingRef}>
            {visibleUpcoming.length === 0 ? (
              <EmptyLine text="Nothing predicted in the next 14 days." />
            ) : (
              visibleUpcoming.map((u: UpcomingChase, i: number) => {
                const missed = isMissedSlot(u.predictedFireDate);
                const paused = data.pauseState.activePauseReason !== null;
                return (
                  <Row
                    key={`${u.contactId}-${u.milestoneCode}-${i}`}
                    category="chase"
                    primary={`${u.milestoneLabel} chase`}
                    secondary={<><ToWithRole name={getShortName({ name: u.contactName })} role={u.contactRole} /><span>· chase {u.chaseNumber} of 2</span></>}
                    trailing={formatDayAndTime(u.predictedFireDate, new Date(), missed)}
                    trailingChip={paused ? <PauseChip /> : undefined}
                    trailingMuted={missed}
                  />
                );
              })
            )}
          </div>

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
            </>
          )}
        </div>
      </div>

      {previewEmailId && (
        <EmailPreviewModal
          emailId={previewEmailId}
          onClose={() => setPreviewEmailId(null)}
        />
      )}
    </Card>
  );
}
