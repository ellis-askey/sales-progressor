"use client";

import { useState, useRef, type ReactNode } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { calculateRiskScore, type RiskLevel } from "@/lib/services/risk";
import { ExchangeTargetCell } from "@/components/transactions/ExchangeTargetCell";
import { RiskBadgeWithPopover } from "@/components/transactions/RiskBadgeWithPopover";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { UserAvatar } from "@/components/ui/Avatar";
import { EnvelopeSimple, WhatsappLogo, ChatText, Phone, NotePencil, Check, SealCheck, PaperPlaneTilt, ArrowBendUpLeft, ChatCircleDots, ClockCounterClockwise } from "@phosphor-icons/react";
import { JourneyBar } from "./JourneyBar";
import { formatDate } from "@/lib/utils";
import type { TransactionStatus, UserRole } from "@prisma/client";
import { DISPLAY_STAGES, type DisplayStageKey } from "@/lib/milestones/display-stages";

// ── Tab-aware columns ────────────────────────────────────────────────────────
// The visible columns adapt to the active status tab, because several columns
// stop meaning anything once the outcome is known:
//   - Status: redundant on any single-status tab (every row says the same).
//   - Exchange target: a completed file has already exchanged (show its
//     completion date instead); a withdrawn file isn't heading anywhere.
//   - Risk: a "will it fall through?" score is moot once done or dead.
// Header + row share this one model so their grids stay in lockstep.
export type FilesTab = "all" | "active" | "on_hold" | "completed" | "withdrawn" | "draft";
export type FilesColumn = "activity" | "target" | "withdrawn" | "status" | "assigned" | "agency" | "risk";

export function filesColumns(tab: FilesTab, showAssigned: boolean, showAgency: boolean): FilesColumn[] {
  const cols: FilesColumn[] = ["activity"];
  if (tab === "withdrawn") cols.push("withdrawn");   // when it was withdrawn (+ reason on hover)
  else cols.push("target");                          // exchange target / completion date
  if (tab === "all") cols.push("status");
  if (showAssigned) cols.push("assigned");
  if (showAgency) cols.push("agency");
  // Risk is no longer its own column — the pill now sits beside the address
  // (2026-09-19 list level-up). Kept in the union for back-compat, never pushed.
  return cols;
}

const COL_WIDTH: Record<FilesColumn, string> = {
  activity: "220px", target: "160px", withdrawn: "180px", status: "110px", assigned: "160px", agency: "140px", risk: "120px",
};

// Grid = flexible property column + one track per visible column. (The old 4px
// risk stripe was dropped in the list level-up — no accent.)
export function filesGridTemplate(cols: FilesColumn[]): string {
  return `minmax(0,1fr) ${cols.map((c) => COL_WIDTH[c]).join(" ")}`;
}

// Minimum list width (px) before the grid beats the mobile card: the fixed
// tracks + the risk stripe + a floor for the flexible property column (44px
// thumb + paddings + a readable address). Below this the card layout stays —
// the old viewport-based md switch ran the fixed tracks into ~484px of content
// on tablets, collapsing the address to nothing (responsive audit finding D1).
export const FILES_PROPERTY_MIN = 240;
export function filesGridMinWidth(cols: FilesColumn[]): number {
  return cols.reduce((s, c) => s + parseInt(COL_WIDTH[c], 10), 0) + FILES_PROPERTY_MIN;
}

export type HealthRaw = {
  pendingOverdueTasks: number;
  escalatedTasks: number;
  lastActivityAt: Date | null;
  // Variant B IA (2026-05-13): derived from latest milestone / outbound message
  // server-side. lastActivityLabel is the human-readable verb; lastActivityType
  // tags the source ("milestone" / "chase" / "note" / "inbound" / "email" /
  // "sms" / "whatsapp" / "comm"). null fields fall back to a generic "Active"
  // chip client-side.
  lastActivityType?: string | null;
  lastActivityLabel?: string | null;
  nextChaseLabel?: string | null;
  nextActionLabel: string | null;
  nextMilestoneLabel: string | null;
  daysStuckOnMilestone: number | null;
  onTrack?: "on_track" | "at_risk" | "off_track" | "unknown" | "on_hold";
  // Most recent contact per channel, for the "Recent" column (list view).
  channelLast?: { email: Date | null; whatsapp: Date | null; call: Date | null };
};

// The single definition of a row's risk level — the exact mapping the List's
// Risk chip and the Pipeline board both read, so "At risk" means one thing
// across every All Files surface. No health → "low" (nothing to score yet).
export function riskLevelForRow(t: { health?: HealthRaw }): RiskLevel {
  if (!t.health) return "low";
  return calculateRiskScore({
    onTrack: t.health.onTrack ?? "unknown",
    escalatedTaskCount: t.health.escalatedTasks,
    overdueTaskCount: t.health.pendingOverdueTasks,
    daysSinceLastActivity: t.health.lastActivityAt
      ? Math.floor((Date.now() - new Date(t.health.lastActivityAt).getTime()) / 86400000)
      : null,
    daysStuckOnMilestone: t.health.daysStuckOnMilestone,
  }).level;
}

export type TransactionRow = {
  id: string;
  propertyAddress: string;
  // Signed property-photo URL (or null). Signed upstream in the page via
  // getSignedUrlMap. Shown as a thumbnail to the left of the address.
  photoUrl?: string | null;
  status: TransactionStatus;
  expectedExchangeDate: Date | null;
  completionDate?: Date | null;
  // Withdrawal detail for the Withdrawn tab. No dedicated withdrawnAt is
  // stored, so updatedAt (the file's last change — the withdrawal itself for a
  // withdrawn file) stands in as "when". fallThroughReason is the free-text
  // why; withdrawalReason is the structured fallback.
  updatedAt?: Date | null;
  fallThroughReason?: string | null;
  withdrawalReason?: string | null;
  createdAt: Date;
  assignedUser: { id: string; name: string; image?: string | null } | null;
  health?: HealthRaw;
  serviceType?: "self_managed" | "outsourced" | null;
  agentUser?: { id: string; name: string; role?: UserRole; image?: string | null } | null;
  contacts?: { id: string; name: string; roleType: string }[];
  // Agency name shown for internal staff (admin / sales_progressor). Optional —
  // only present when listTransactions is called with a scope param.
  agency?: { id: string; name: string } | null;
  // The file's current pipeline stage, decorated by FilesWorkspace from the
  // stage map. Drives the journey bar; absent on non-active rows (no bar).
  boardStage?: DisplayStageKey;
};

function splitAddress(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length <= 1) return { line: address, location: "" };
  const line = parts.slice(0, -2).join(", ") || parts[0];
  const location = parts.slice(-2).join(", ");
  return { line, location };
}

/* Activity state — drives the verb-chip colour. Moving / Stalled / Stale
 * thresholds match the Variant B preview and the Activity filter chip.
 * Used by both the row chip and the filter logic in TransactionListWithSearch. */
export type ActivityState = "moving" | "stalled" | "stale";

export function activityStateFor(date: Date | null | undefined): ActivityState | null {
  if (!date) return null;
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days < 7)  return "moving";
  if (days < 14) return "stalled";
  return "stale";
}

function relTime(date: Date): string {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7)  return `${days}d ago`;
  if (days < 14) return "1w ago";
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

// A short "14 May" for the Recent column.
function shortDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// The last activity's channel → an icon. Covers the derived lastActivityType
// values from listTransactions (email / whatsapp / sms / call / note / chase /
// inbound / milestone / comm); anything else falls back to a clock.
const ACTIVITY_ICON: Record<string, typeof EnvelopeSimple> = {
  email: EnvelopeSimple,
  whatsapp: WhatsappLogo,
  sms: ChatText,
  call: Phone,
  note: NotePencil,
  milestone: SealCheck,
  chase: PaperPlaneTilt,
  inbound: ArrowBendUpLeft,
  comm: ChatCircleDots,
};

/* Recent — the last contact on each channel (call / email / WhatsApp) as a bare
 * icon + date. Falls back to the single most-recent activity (a note, a
 * milestone confirmation…) when no channel comms are on file. */
function ActivityVerbChip({ tx, mobile = false }: { tx: TransactionRow; mobile?: boolean }) {
  const cl = tx.health?.channelLast;
  const lines: { Icon: typeof EnvelopeSimple; at: Date; label: string }[] = [];
  if (cl?.call) lines.push({ Icon: Phone, at: new Date(cl.call), label: "Last call" });
  if (cl?.email) lines.push({ Icon: EnvelopeSimple, at: new Date(cl.email), label: "Last email" });
  if (cl?.whatsapp) lines.push({ Icon: WhatsappLogo, at: new Date(cl.whatsapp), label: "Last WhatsApp" });
  const sz = mobile ? 15 : 14;

  if (lines.length > 0) {
    return (
      <span className="recent-lines">
        {lines.map((l, i) => {
          const LI = l.Icon;
          return (
            <span key={i} className="recent-line" title={`${l.label} · ${shortDate(l.at)}`}>
              <LI size={sz} weight="regular" />
              <span>{shortDate(l.at)}</span>
            </span>
          );
        })}
      </span>
    );
  }

  const lastAt = tx.health?.lastActivityAt ? new Date(tx.health.lastActivityAt) : null;
  if (!lastAt) return <span className="recent-none">Just added</span>;
  const verb = tx.health?.lastActivityLabel ?? null;
  const Icon = (tx.health?.lastActivityType && ACTIVITY_ICON[tx.health.lastActivityType]) || ClockCounterClockwise;
  return (
    <span className="recent-line" title={verb ? `${verb} · ${relTime(lastAt)}` : `Active ${relTime(lastAt)}`}>
      <Icon size={sz} weight="regular" />
      <span>{shortDate(lastAt)}</span>
    </span>
  );
}

/* JourneyStages — the six conveyancing stages inside the journey popover.
 * Done stages tick green, the current stage is coral, upcoming are muted.
 * Colours are set explicitly (stamping data-theme on a portal re-declares the
 * light tokens), so it stays legible on dark glass. */
function JourneyStages({ stage }: { stage: DisplayStageKey }) {
  const idx = DISPLAY_STAGES.findIndex((s) => s.key === stage);
  const { isNight } = usePortalTheme();
  const nameColor  = isNight ? "#f1f5f9" : "var(--agent-text-primary)";
  const mutedColor = isNight ? "rgba(226,232,240,0.55)" : "var(--agent-text-muted)";
  const upcomingDot = isNight ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)";
  return (
    <div>
      <p style={{ margin: "0 0 11px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: mutedColor }}>
        The journey · {idx + 1} of {DISPLAY_STAGES.length}
      </p>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
        {DISPLAY_STAGES.map((s, i) => {
          const done = i < idx, cur = i === idx;
          return (
            <li key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: done ? "var(--agent-success)" : cur ? "var(--agent-coral, #FF8A65)" : upcomingDot,
              }}>
                {done
                  ? <Check size={11} weight="bold" color="#fff" />
                  : <span style={{ width: 5, height: 5, borderRadius: "50%", background: cur ? "#fff" : mutedColor }} />}
              </span>
              <span style={{ fontSize: 13, fontWeight: cur ? 600 : 400, color: cur || done ? nameColor : mutedColor }}>
                {s.name}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* JourneyHover — wraps the row's journey bar. Hovering (or focusing) reveals a
 * glass popover of all six stages, current one marked. Glass + text colours
 * adapt to night mode; pointer-events:none so it never blocks the row link. */
function JourneyHover({ stage, children }: { stage: DisplayStageKey; children: ReactNode }) {
  const { theme, isNight } = usePortalTheme();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  function show() {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      const POPOVER_W = 240, EST_H = 260, SAFE = 12;
      const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
      const vh = typeof window !== "undefined" ? window.innerHeight : 768;
      let left = r.left;
      if (left + POPOVER_W + SAFE > vw) left = Math.max(SAFE, vw - POPOVER_W - SAFE);
      const above = r.bottom + EST_H > vh && r.top > EST_H;
      setPos({ top: above ? r.top - 6 : r.bottom + 6, left, above });
    }
    setClosing(false);
    setOpen(true);
  }
  function hide() { setOpen((w) => { if (w) setClosing(true); return false; }); }

  const glassBg     = isNight ? "rgba(24,28,38,0.90)" : "rgba(255,255,255,0.82)";
  const glassBorder = isNight ? "0.5px solid rgba(255,255,255,0.14)" : "0.5px solid rgba(255,255,255,0.65)";
  const glassShadow = isNight ? "0 12px 48px rgba(0,0,0,0.55)"       : "0 12px 48px rgba(0,0,0,0.16)";

  return (
    <div ref={ref} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} tabIndex={0} style={{ outline: "none", display: "inline-block", maxWidth: "100%", verticalAlign: "top" }}>
      {children}
      {(open || closing) && pos && typeof document !== "undefined" && createPortal(
        <div
          data-theme={theme}
          data-night={isNight ? "" : undefined}
          className={closing ? "agent-dropdown-out" : "agent-dropdown-in"}
          onAnimationEnd={() => { if (closing) setClosing(false); }}
          style={{
            position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
            transform: pos.above ? "translateY(-100%)" : "none",
            width: 240, maxWidth: "calc(100vw - 24px)",
            background: glassBg,
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            borderRadius: 14, border: glassBorder, boxShadow: glassShadow,
            padding: 14, pointerEvents: "none",
          }}
        >
          <JourneyStages stage={stage} />
        </div>,
        document.body
      )}
    </div>
  );
}

const WITHDRAWAL_REASON_LABEL: Record<string, string> = {
  BUYER_WITHDREW: "Buyer withdrew",
  SELLER_WITHDREW: "Seller withdrew",
  CHAIN_COLLAPSE_ABOVE: "Chain collapsed above",
  OTHER: "Other",
};

/* WithdrawnCell — when a file was withdrawn (updatedAt stands in, since we don't
 * stamp a dedicated withdrawal time) with the reason, if any, on hover. Free-text
 * reason wins; the structured classification is the fallback. */
function WithdrawnCell({ tx }: { tx: TransactionRow }) {
  const when = tx.updatedAt ?? null;
  const reason = tx.fallThroughReason?.trim()
    || (tx.withdrawalReason ? WITHDRAWAL_REASON_LABEL[tx.withdrawalReason] ?? null : null);
  const { theme } = usePortalTheme();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  function show() {
    if (ref.current) { const r = ref.current.getBoundingClientRect(); setPos({ top: r.bottom + 4, left: r.left }); }
    setClosing(false); setOpen(true);
  }
  function hide() { setOpen((w) => { if (w) setClosing(true); return false; }); }

  return (
    <div>
      <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>{when ? formatDate(when) : "—"}</p>
      {reason ? (
        <>
          <span
            ref={ref}
            onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
            tabIndex={0}
            style={{ fontSize: 11, color: "var(--agent-text-muted)", cursor: "default", borderBottom: "1px dotted rgba(15,23,42,0.30)", display: "inline-block", marginTop: 2 }}
          >
            Reason
          </span>
          {(open || closing) && pos && typeof document !== "undefined" && createPortal(
            <div
              data-theme={theme}
              className={closing ? "agent-dropdown-out" : "agent-dropdown-in"}
              onAnimationEnd={() => { if (closing) setClosing(false); }}
              style={{
                position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
                background: "rgba(255,255,255,0.97)", borderRadius: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)",
                padding: "10px 14px", minWidth: 200, maxWidth: 320, pointerEvents: "none",
              }}
            >
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--agent-text-muted)" }}>Why it was withdrawn</p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--agent-text-primary)", lineHeight: 1.4 }}>{reason}</p>
            </div>,
            document.body
          )}
        </>
      ) : (
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>No reason recorded</p>
      )}
    </div>
  );
}

/* Person — one avatar + name (+ optional role caption) inside "Handled by". */
function Person({ user, role }: { user: { name: string; image?: string | null }; role?: string }) {
  return (
    <div className="handled-person">
      <UserAvatar user={{ name: user.name, image: user.image ?? null }} size={24} />
      <span className="handled-txt">
        <span className="handled-name">{user.name}</span>
        {role && <span className="handled-role">{role}</span>}
      </span>
    </div>
  );
}

/* HandledBy — who is actually looking after the file right now.
 *  • self-managed: the current handler — whoever it's assigned to now, else the
 *    person who added it. Reassignments win (we show the new owner, not who
 *    added it).
 *  • outsourced: the agency contact who added it, plus the Sales Progressor
 *    progressor handling it (or "Awaiting assignment" until one is set). */
function HandledBy({ tx }: { tx: TransactionRow }) {
  if (tx.serviceType === "outsourced") {
    return (
      <div className="handled">
        {tx.agentUser && <Person user={tx.agentUser} role="Agency" />}
        {tx.assignedUser
          ? <Person user={tx.assignedUser} role="Progressor" />
          : <span className="handled-awaiting">Awaiting assignment</span>}
      </div>
    );
  }
  const handler = tx.assignedUser ?? tx.agentUser;
  return handler
    ? <Person user={handler} />
    : <span className="handled-none">Unassigned</span>;
}

export function TransactionRowView({
  tx,
  basePath = "/agent/transactions",
  isLast = false,
  cols: colsProp,
  showAgencyColumn = false,
  showAssignedToColumn = true,
}: {
  tx: TransactionRow;
  basePath?: string;
  isLast?: boolean;
  cols?: FilesColumn[];
  showAgencyColumn?: boolean;
  showAssignedToColumn?: boolean;
}) {
  // Column set is decided by the active tab (see filesColumns) so the row grid
  // matches the header exactly. Cell CONTENT keys off this row's own status, so
  // a completed row on the "All" tab still shows a completion date and no risk.
  // Falls back to the full "all" column set for standalone consumers.
  const cols = colsProp ?? filesColumns("all", showAssignedToColumn, showAgencyColumn);
  const gridCols = filesGridTemplate(cols);
  const isDone = tx.status === "completed";
  const isDead = tx.status === "withdrawn";
  const isPaused = tx.status === "on_hold";

  const { line, location } = splitAddress(tx.propertyAddress);
  const health = tx.health ?? null;
  // "Waiting on" line — the next chase target, with a leading "Chase:" dropped
  // so it doesn't read "Waiting on: Chase: ...".
  const waitingLabel = health?.nextActionLabel ? health.nextActionLabel.replace(/^chase:\s*/i, "") : null;

  // Per-status cell content, shared by the mobile card and the desktop grid.
  const targetContent = isDone ? (
    tx.completionDate
      ? (
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--agent-text-secondary)" }}>{formatDate(tx.completionDate)}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--agent-text-muted)" }}>Completed</p>
        </div>
      )
      : <span style={{ fontSize: 13, color: "var(--agent-text-muted)" }}>—</span>
  ) : isDead ? (
    <span style={{ fontSize: 13, color: "var(--agent-text-muted)" }}>—</span>
  ) : (
    <ExchangeTargetCell
      transactionId={tx.id}
      expectedExchangeDate={tx.expectedExchangeDate}
      createdAt={tx.createdAt}
    />
  );

  const riskContent = isPaused ? (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 99, background: "rgba(15,23,42,0.05)", color: "var(--agent-text-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(15,23,42,0.30)" }} />
      Paused
    </span>
  ) : isDone || isDead ? (
    <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>—</span>
  ) : tx.health ? (
    <RiskBadgeWithPopover raw={tx.health} />
  ) : (
    <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>—</span>
  );

  const divider = !isLast ? "0.5px solid var(--agent-border-subtle)" : undefined;

  return (
    <div>
      {/* ── Card row — shown until the list is wide enough for the grid
          (container-driven via .files-table / .files-switch-N, not viewport) */}
      <Link
        href={`${basePath}/${tx.id}`}
        unstable_dynamicOnHover
        className="files-row-card agent-hover-row"
        style={{ textDecoration: "none", borderBottom: divider }}
      >
        <div className="flex-1 px-4 py-4 min-w-0 space-y-2">
          <div className="files-id flex items-start gap-3">
            <PropertyThumb photoUrl={tx.photoUrl} size={46} />
            <div className="min-w-0 flex-1">
              <div className="files-line1">
                <span className="files-addr">{line}</span>
                {!isDone && !isDead && <span className="files-pill">{riskContent}</span>}
              </div>
              {location && <span className="files-town">{location}</span>}
              {showAgencyColumn && tx.agency?.name && <span className="files-agency">{tx.agency.name}</span>}
              {tx.boardStage && !isDone && !isDead && (
                <JourneyHover stage={tx.boardStage}><JourneyBar stage={tx.boardStage} /></JourneyHover>
              )}
              {!isDone && !isDead && waitingLabel && (
                <span className="files-waiting">Waiting on: <b>{waitingLabel}</b></span>
              )}
            </div>
          </div>

          {/* Verb chip + status on mobile */}
          <div className="flex items-center gap-2 flex-wrap">
            <ActivityVerbChip tx={tx} mobile />
            <StatusBadge status={tx.status} />
          </div>

          <div>{isDead ? <WithdrawnCell tx={tx} /> : targetContent}</div>
          <div>
            <p className="handled-card-label">Handled by</p>
            <HandledBy tx={tx} />
          </div>
        </div>
      </Link>

      {/* ── Desktop row (hidden below md) ─────────────────────────
       * Column order: [stripe] Property | Last activity | Exchange target |
       *   Status | Assigned-to | Risk
       * Row link = entire row navigates. Activity chip's popover is
       * pointer-events:none so it does not intercept the row link.
       */}
      <Link
        href={`${basePath}/${tx.id}`}
        unstable_dynamicOnHover
        className="files-row-grid items-center agent-hover-row group"
        style={{ gridTemplateColumns: gridCols, textDecoration: "none", borderBottom: divider }}
      >
        {/* Property — identity (photo + address); risk pill inline, then the
            labelled journey bar and what the file is waiting on. */}
        <div className="files-id px-4 py-3.5 min-w-0 flex items-start gap-3">
          <PropertyThumb photoUrl={tx.photoUrl} size={46} />
          <div className="min-w-0 flex-1">
            <div className="files-line1">
              <span className="files-addr">{line}</span>
              {!isDone && !isDead && <span className="files-pill">{riskContent}</span>}
            </div>
            {location && <span className="files-town">{location}</span>}
            {tx.boardStage && !isDone && !isDead && (
              <JourneyHover stage={tx.boardStage}><JourneyBar stage={tx.boardStage} /></JourneyHover>
            )}
            {!isDone && !isDead && waitingLabel && (
              <span className="files-waiting">Waiting on: <b>{waitingLabel}</b></span>
            )}
          </div>
        </div>

        {/* Recent — last contact per channel */}
        <div className="px-4 py-3.5">
          <ActivityVerbChip tx={tx} />
        </div>

        {/* Exchange target / completion date — omitted on the Withdrawn tab */}
        {cols.includes("target") && (
          <div className="px-4 py-3.5">{targetContent}</div>
        )}

        {/* Withdrawn — when, with the reason on hover */}
        {cols.includes("withdrawn") && (
          <div className="px-4 py-3.5"><WithdrawnCell tx={tx} /></div>
        )}

        {/* Status — only on the All tab (redundant on a single-status tab) */}
        {cols.includes("status") && (
          <div className="px-4 py-3.5">
            <StatusBadge status={tx.status} />
          </div>
        )}

        {/* Handled by — who's looking after the file now (see HandledBy).
            Hidden for roles that only see their own files (negotiator, sales_progressor). */}
        {cols.includes("assigned") && (
          <div className="px-4 py-3.5">
            <HandledBy tx={tx} />
          </div>
        )}

        {/* Agency — additive column for internal staff; not rendered for agents */}
        {cols.includes("agency") && (
          <div className="px-4 py-3.5">
            <span style={{ fontSize: 12, color: "var(--agent-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
              {tx.agency?.name ?? "—"}
            </span>
          </div>
        )}
      </Link>
    </div>
  );
}
