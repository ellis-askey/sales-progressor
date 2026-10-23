"use client";

import { useState, useRef, type ReactNode } from "react";
import Link from "next/link";
import { withFrom } from "@/lib/agent/back-nav";
import { createPortal } from "react-dom";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { calculateRiskScore, type RiskLevel } from "@/lib/services/risk";
import { ExchangeTargetCell } from "@/components/transactions/ExchangeTargetCell";
import { RiskBadgeWithPopover } from "@/components/transactions/RiskBadgeWithPopover";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { UserAvatar } from "@/components/ui/Avatar";
import { EnvelopeSimple, WhatsappLogo, ChatText, Phone, NotePencil, Check, SealCheck, PaperPlaneTilt, ArrowBendUpLeft, ChatCircleDots, ClockCounterClockwise, TrendUp, TrendDown, Minus, PauseCircle, CheckCircle, Prohibit } from "@phosphor-icons/react";
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
// Per-tab column model (files-table redesign, 2026-10-18). The tab already tells
// you the status, so no column repeats it; each tab only carries columns that
// mean something for those files. Agency now lives under the address (property
// cell), so it's no longer a column.
export type FilesColumn =
  | "stage" | "activity" | "exchange" | "keydate"
  | "review" | "paused"
  | "soldfor" | "exchanged" | "completed"
  | "reached" | "withdrawnDate" | "reason"
  | "handled";

export function filesColumns(tab: FilesTab, showAssigned: boolean, _showAgency?: boolean): FilesColumn[] {
  let cols: FilesColumn[];
  switch (tab) {
    case "active":    cols = ["stage", "activity", "exchange"]; break;
    case "on_hold":   cols = ["stage", "review", "paused"]; break;
    case "completed": cols = ["soldfor", "exchanged", "completed"]; break;
    case "withdrawn": cols = ["reached", "withdrawnDate", "reason"]; break;
    default:          cols = ["stage", "activity", "keydate"]; break; // all + draft
  }
  if (showAssigned) cols.push("handled");
  return cols;
}

// Grid track per column — activity / paused / reason flex, the rest fixed.
const COL_TRACK: Record<FilesColumn, string> = {
  stage: "190px", activity: "minmax(220px,1.35fr)", exchange: "190px", keydate: "190px",
  review: "140px", paused: "minmax(200px,1.2fr)",
  soldfor: "120px", exchanged: "150px", completed: "150px",
  reached: "190px", withdrawnDate: "150px", reason: "minmax(240px,1.6fr)",
  handled: "160px",
};
// Min px each track can shrink to — drives the card↔grid switch bucket.
const COL_MIN: Record<FilesColumn, number> = {
  stage: 190, activity: 220, exchange: 190, keydate: 190,
  review: 140, paused: 200, soldfor: 120, exchanged: 150, completed: 150,
  reached: 190, withdrawnDate: 150, reason: 240, handled: 160,
};
// Card mini-labels (and the desktop header labels, via TransactionTable).
export const COL_LABEL: Record<FilesColumn, string> = {
  stage: "Stage / Progress", activity: "Latest activity / Next step", exchange: "Exchange forecast",
  keydate: "Key date", review: "Due back", paused: "Paused",
  soldfor: "Sold for", exchanged: "Exchanged", completed: "Completed",
  reached: "Reached", withdrawnDate: "Withdrawn", reason: "Reason", handled: "Handled by",
};

// Grid = flexible property column + one track per visible column.
export function filesGridTemplate(cols: FilesColumn[]): string {
  return `minmax(240px,1.5fr) ${cols.map((c) => COL_TRACK[c]).join(" ")}`;
}

// Minimum list width before the grid beats the mobile card. Below this the card
// layout stays (container-query driven; see .files-switch-N in agent-system.css).
export const FILES_PROPERTY_MIN = 240;
export function filesGridMinWidth(cols: FilesColumn[]): number {
  return cols.reduce((s, c) => s + COL_MIN[c], 0) + FILES_PROPERTY_MIN;
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
  // Critique #15: parked on the deposit-transfer step (PM24) — the risk score
  // drops the deposit signals and shows a plain status instead. inChain only
  // changes the status wording.
  awaitingDeposit?: boolean;
  inChain?: boolean;
  // Contracts exchanged — the risk pill shows a calm "Exchanged" instead of a
  // pace score (critique 2026-10-02).
  exchanged?: boolean;
  // ── Files-table redesign (2026-10-18) ──
  // 4-level pace vs the 12-week target (null = nothing to score / outcome known).
  pace?: "ahead" | "on_track" | "slightly_behind" | "behind" | null;
  // Party-aware activity verb ("Chased the seller") — falls back to the generic.
  activityVerb?: string | null;
  // The single next-step line (ladder: attention → next chase → chain → calm).
  nextStep?: { text: string; tone: "danger" | "accent" | "chain" | "muted" } | null;
  // Active hold detail for the On-hold tab.
  holdInfo?: { days: number; review: Date | null; reviewOverdue: boolean; reason: string | null } | null;
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
    awaitingDeposit: t.health.awaitingDeposit,
    inChain: t.health.inChain,
    exchanged: t.health.exchanged,
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
  overridePredictedDate?: Date | null;
  completionDate?: Date | null;
  // Completed-tab detail: the agreed price (priceAtExchange snapshot wins) and
  // when it exchanged. All scalars flow through listTransactions' `include`.
  purchasePrice?: number | null;
  priceAtExchange?: number | null;
  exchangedAt?: Date | null;
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
  // Which company progresses an outsourced file. A non-TSP business names itself
  // on the row ("Handled by {business}") so an agency using several external
  // progressors can tell its sales apart. Null / isTsp = unchanged (generic
  // "Progressor" for TSP-managed, nothing for self-managed).
  progressionBusiness?: { id: string; shortName: string | null; name: string; isTsp: boolean } | null;
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

// "17 Oct · 2:14pm" — fixed to Europe/London so SSR and client agree (no drift).
function dateTime(d: Date): string {
  const date = d.toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s/g, "").toLowerCase();
  return `${date} · ${time}`;
}

const NEXT_TONE: Record<"danger" | "accent" | "chain" | "muted", string> = {
  danger: "var(--agent-danger)", accent: "var(--agent-coral-deep)", chain: "#5b6b8c", muted: "var(--agent-text-muted)",
};

/* Recent / Next step — the single most-recent activity: a party-aware verb (e.g.
 * "Chased the seller"), the date + time, and the one next-step line beneath. */
function ActivityVerbChip({ tx, mobile = false }: { tx: TransactionRow; mobile?: boolean }) {
  const h = tx.health;
  const lastAt = h?.lastActivityAt ? new Date(h.lastActivityAt) : null;
  const verb = h?.activityVerb ?? h?.lastActivityLabel ?? null;
  if (!lastAt && !verb) return <span className="recent-none">Just added</span>;
  const Icon = (h?.lastActivityType && ACTIVITY_ICON[h.lastActivityType]) || ClockCounterClockwise;
  const next = h?.nextStep ?? null;
  const sz = mobile ? 16 : 17;
  return (
    <span style={{ display: "flex", gap: 9, minWidth: 0, alignItems: "flex-start" }}>
      <Icon size={sz} weight="regular" style={{ flexShrink: 0, marginTop: 2, color: "var(--agent-text-secondary)" }} />
      <span style={{ minWidth: 0 }}>
        {verb && <span style={{ display: "block", fontSize: 13, fontWeight: 650, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{verb}</span>}
        {lastAt && <span style={{ display: "block", fontSize: 11.5, color: "var(--agent-text-muted)", marginTop: 1, fontVariantNumeric: "tabular-nums" }}>{dateTime(lastAt)}</span>}
        {next && <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: NEXT_TONE[next.tone], marginTop: 2 }}>{next.text}</span>}
      </span>
    </span>
  );
}

// Pace vs the 12-week target — a quiet icon + text (no pill), under the exchange date.
function PaceLine({ pace }: { pace: NonNullable<NonNullable<TransactionRow["health"]>["pace"]> }) {
  if (!pace) return null;
  const cfg = {
    ahead: { label: "Ahead of target", color: "var(--agent-success)", Icon: TrendUp },
    on_track: { label: "On track", color: "#2563a8", Icon: TrendUp },
    slightly_behind: { label: "Slightly behind", color: "var(--agent-warning)", Icon: Minus },
    behind: { label: "Behind", color: "var(--agent-danger)", Icon: TrendDown },
  }[pace];
  const PI = cfg.Icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 650, color: cfg.color, marginTop: 4 }}>
      <PI size={14} weight="bold" /> {cfg.label}
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
function JourneyHover({ stage, children, block = false }: { stage: DisplayStageKey; children: ReactNode; block?: boolean }) {
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
    <div ref={ref} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} tabIndex={0} style={{ outline: "none", display: block ? "block" : "inline-block", width: block ? "100%" : undefined, maxWidth: "100%", verticalAlign: "top" }}>
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
    // External company names itself; a TSP-managed file keeps the generic role.
    const biz = tx.progressionBusiness && !tx.progressionBusiness.isTsp ? tx.progressionBusiness : null;
    const bizName = biz ? (biz.shortName || biz.name) : null;
    return (
      <div className="handled">
        {tx.agentUser && <Person user={tx.agentUser} role="Agency" />}
        {tx.assignedUser
          ? <Person user={tx.assignedUser} role={bizName ?? "Progressor"} />
          : <span className="handled-awaiting">{bizName ? `${bizName} · awaiting assignment` : "Awaiting assignment"}</span>}
      </div>
    );
  }
  const handler = tx.assignedUser ?? tx.agentUser;
  return handler
    ? <Person user={handler} />
    : <span className="handled-none">Unassigned</span>;
}

// ── Per-tab cells (files-table redesign) ─────────────────────────────────────

// "5th November 2026" — ordinal long form for the post-exchange completion date,
// London-zoned so SSR and the client agree.
function longDateOrdinal(input: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" }).formatToParts(new Date(input));
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "0");
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const k = day % 100, j = day % 10;
  const suffix = k >= 11 && k <= 13 ? "th" : j === 1 ? "st" : j === 2 ? "nd" : j === 3 ? "rd" : "th";
  return `${day}${suffix} ${month} ${year}`;
}

// Exchange forecast — the date cell + the 4-level pace (active rows). Once the file
// has exchanged, the predicted-exchange date and pace are history: the only forward
// date is completion, so show that instead. No pace line (the risk pill already
// reads a calm "Exchanged", so a "Behind" here would contradict it).
function ExchangeCell({ tx }: { tx: TransactionRow }) {
  if (tx.exchangedAt) {
    return (
      <div>
        <p style={{ margin: "0 0 2px", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--agent-text-muted)" }}>Completion scheduled</p>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>
          {tx.completionDate ? longDateOrdinal(new Date(tx.completionDate)) : "To be confirmed"}
        </span>
      </div>
    );
  }
  return (
    <div>
      <ExchangeTargetCell transactionId={tx.id} expectedExchangeDate={tx.expectedExchangeDate} overridePredictedDate={tx.overridePredictedDate ?? null} createdAt={tx.createdAt} />
      {tx.health?.pace && <PaceLine pace={tx.health.pace} />}
    </div>
  );
}

// On-hold — when it comes back (or overdue / not set). `label` adds a caption
// above the date on the All tab (generic "Key date" header, so the row needs the
// context); the On-hold tab omits it because its "Due back" column header already
// says what the date is.
function ReviewCell({ tx, label }: { tx: TransactionRow; label?: string }) {
  const h = tx.health?.holdInfo;
  const caption = label && h ? (
    <p style={{ margin: "0 0 2px", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--agent-text-muted)" }}>{label}</p>
  ) : null;
  if (!h || !h.review) return <div>{caption}<span style={{ fontSize: 13, color: "var(--agent-text-muted)" }}>{h ? "Not set" : "—"}</span></div>;
  if (h.reviewOverdue) return (
    <div>
      {caption}
      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--agent-danger)" }}>Overdue</p>
      <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--agent-danger)" }}>was {formatDate(new Date(h.review))}</p>
    </div>
  );
  return <div>{caption}<span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>{formatDate(new Date(h.review))}</span></div>;
}

// On-hold — how long + the typed reason (or "No reason given").
function PausedCell({ tx }: { tx: TransactionRow }) {
  const h = tx.health?.holdInfo;
  if (!h) return <span style={{ fontSize: 13, color: "var(--agent-text-muted)" }}>—</span>;
  return (
    <div>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 650, color: "var(--agent-text-primary)" }}>{h.days} days</p>
      {h.reason
        ? <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--agent-text-secondary)", fontStyle: "italic" }}>&ldquo;{h.reason}&rdquo;</p>
        : <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)" }}>No reason given</p>}
    </div>
  );
}

// Completed — agreed sale price (priceAtExchange in pence; the row anchor).
function SoldForCell({ tx }: { tx: TransactionRow }) {
  const pence = tx.priceAtExchange ?? tx.purchasePrice ?? null;
  const txt = pence != null ? `£${Math.round(pence / 100).toLocaleString("en-GB")}` : "—";
  return <span style={{ fontSize: 15, fontWeight: 750, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{txt}</span>;
}

function DateCell({ d }: { d?: Date | null }) {
  return <span style={{ fontSize: 13, fontWeight: 650, color: "var(--agent-text-primary)" }}>{d ? formatDate(new Date(d)) : "—"}</span>;
}

const WITHDRAWAL_CAT_COLOR: Record<string, string> = {
  BUYER_WITHDREW: "var(--agent-danger)", SELLER_WITHDREW: "var(--agent-warning)",
  CHAIN_COLLAPSE_ABOVE: "#5b6b8c", OTHER: "#64748b",
};
// Withdrawn — the structured category (coloured) + the free-text reason.
function ReasonCell({ tx }: { tx: TransactionRow }) {
  const cat = tx.withdrawalReason ?? null;
  const catLabel = cat ? WITHDRAWAL_REASON_LABEL[cat] ?? null : null;
  const catColor = cat ? WITHDRAWAL_CAT_COLOR[cat] ?? "#64748b" : "#64748b";
  const text = tx.fallThroughReason?.trim() || null;
  if (!catLabel && !text) return <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>No reason recorded</span>;
  return (
    <div>
      {catLabel && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: catColor }}><span style={{ width: 6, height: 6, borderRadius: 999, background: catColor, flexShrink: 0 }} />{catLabel}</span>}
      {text && <p style={{ margin: catLabel ? "3px 0 0" : 0, fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.4 }}>{text}</p>}
    </div>
  );
}

// All-tab adaptive key date (status marker on the property cell disambiguates).
function KeyDateCell({ tx }: { tx: TransactionRow }) {
  if (tx.status === "active") return <ExchangeCell tx={tx} />;
  if (tx.status === "on_hold") return <ReviewCell tx={tx} label="Review due" />;
  if (tx.status === "completed") return <DateCell d={tx.completionDate} />;
  if (tx.status === "withdrawn") return <DateCell d={tx.updatedAt} />;
  return <span style={{ fontSize: 13, color: "var(--agent-text-muted)" }}>—</span>;
}

function StageCell({ tx }: { tx: TransactionRow }) {
  if (!tx.boardStage) return <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>—</span>;
  // block=true + .files-stagecell CSS makes the bar fill its column (desktop) and
  // the full card width (mobile), instead of its fixed 210px (which overflowed).
  return <div className="files-stagecell"><JourneyHover stage={tx.boardStage} block><JourneyBar stage={tx.boardStage} /></JourneyHover></div>;
}

// Withdrawn files: how far the sale got before it fell through. Same six-stage
// shape as the live journey bar, but dimmed red — "it reached here, then
// stopped". boardStage is resolved for withdrawn files too (page-level), from
// the milestone completions that survive the withdrawal, so this is real
// furthest-stage data, not an estimate.
const REACHED_FILL = "rgba(199,62,62,0.32)";
function ReachedCell({ tx }: { tx: TransactionRow }) {
  if (!tx.boardStage) return <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>Not recorded</span>;
  const idx = DISPLAY_STAGES.findIndex((s) => s.key === tx.boardStage);
  if (idx < 0) return <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>Not recorded</span>;
  const name = DISPLAY_STAGES[idx].name;
  const total = DISPLAY_STAGES.length;
  return (
    <span style={{ display: "block", width: "100%" }}>
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 650, color: "var(--agent-text-secondary)" }}>{name}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", fontVariantNumeric: "tabular-nums" }}>{idx + 1} of {total}</span>
      </span>
      <span style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= idx ? REACHED_FILL : "var(--agent-border-subtle)" }} />
        ))}
      </span>
    </span>
  );
}

// One status/risk marker beside the address. On the single-status tabs the
// status is the tab, so only the risk cue (active) is shown; on All it's the
// status for non-active rows, else the risk cue.
function RowMarker({ tx, activeTab }: { tx: TransactionRow; activeTab?: FilesTab }) {
  const mark = (color: string, Icon: typeof PauseCircle, label: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color }}><Icon size={13} weight="fill" /> {label}</span>
  );
  if (activeTab === "all") {
    if (tx.status === "on_hold") return mark("var(--agent-warning)", PauseCircle, "On hold");
    if (tx.status === "completed") return mark("#2563a8", CheckCircle, "Completed");
    if (tx.status === "withdrawn") return mark("#64748b", Prohibit, "Withdrawn");
    return tx.health ? <RiskBadgeWithPopover raw={tx.health} /> : null;
  }
  if (activeTab === "active" || activeTab === undefined) return tx.health ? <RiskBadgeWithPopover raw={tx.health} /> : null;
  return null;
}

function renderCell(col: FilesColumn, tx: TransactionRow): ReactNode {
  switch (col) {
    case "stage": return <StageCell tx={tx} />;
    case "activity": return <ActivityVerbChip tx={tx} />;
    case "exchange": return <ExchangeCell tx={tx} />;
    case "keydate": return <KeyDateCell tx={tx} />;
    case "review": return <ReviewCell tx={tx} />;
    case "paused": return <PausedCell tx={tx} />;
    case "soldfor": return <SoldForCell tx={tx} />;
    case "exchanged": return <DateCell d={tx.exchangedAt} />;
    case "completed": return <DateCell d={tx.completionDate} />;
    case "reached": return <ReachedCell tx={tx} />;
    case "withdrawnDate": return <DateCell d={tx.updatedAt} />;
    case "reason": return <ReasonCell tx={tx} />;
    case "handled": return <HandledBy tx={tx} />;
  }
}

// Property identity — thumb + address + one marker, with town/postcode and
// agency (internal/multi-agency only) stacked beneath.
function PropertyCell({ tx, activeTab, showAgency, compact }: { tx: TransactionRow; activeTab?: FilesTab; showAgency?: boolean; compact?: boolean }) {
  const { line, location } = splitAddress(tx.propertyAddress);
  const marker = <RowMarker tx={tx} activeTab={activeTab} />;
  return (
    <div className="files-id flex items-start gap-3 min-w-0">
      <PropertyThumb photoUrl={tx.photoUrl} size={46} />
      <div className="min-w-0 flex-1">
        <div className="files-line1" style={compact ? { whiteSpace: "normal" } : undefined}>
          <span className="files-addr">{line}</span>
          {marker && <span className="files-pill">{marker}</span>}
        </div>
        {location && <span className="files-town">{location}</span>}
        {showAgency && tx.agency?.name && <span className="files-agency">{tx.agency.name}</span>}
      </div>
    </div>
  );
}

export function TransactionRowView({
  tx,
  basePath = "/agent/transactions",
  isLast = false,
  cols: colsProp,
  showAgencyColumn = false,
  showAssignedToColumn = true,
  activeTab,
}: {
  tx: TransactionRow;
  basePath?: string;
  isLast?: boolean;
  cols?: FilesColumn[];
  showAgencyColumn?: boolean;
  showAssignedToColumn?: boolean;
  // The tab the list is showing. On the single-status tabs the row's own
  // status pill is a tautology (everything on the On-hold tab is on hold), so
  // it's suppressed (critique, 2026-09-22).
  activeTab?: FilesTab;
}) {
  // Column set is decided by the active tab (see filesColumns) so the row grid
  // matches the header exactly. Cell CONTENT keys off this row's own status, so
  // a completed row on the "All" tab still shows a completion date and no risk.
  // Falls back to the full "all" column set for standalone consumers.
  const cols = colsProp ?? filesColumns("all", showAssignedToColumn, showAgencyColumn);
  const gridCols = filesGridTemplate(cols);
  const divider = !isLast ? "0.5px solid var(--agent-border-subtle)" : undefined;

  return (
    <div data-bloom>
      {/* Card row — stacked layout, shown until the list is wide enough for the
          grid (container-driven via .files-table / .files-switch-N). */}
      <Link
        href={withFrom(`${basePath}/${tx.id}`, basePath)}
        unstable_dynamicOnHover
        className="files-row-card agent-hover-row"
        style={{ textDecoration: "none", borderBottom: divider }}
      >
        <div className="flex-1 px-4 py-4 min-w-0 space-y-3">
          <PropertyCell tx={tx} activeTab={activeTab} showAgency={showAgencyColumn} compact />
          {cols.map((col) => (
            <div key={col}>
              <p style={{ margin: "0 0 5px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>{COL_LABEL[col]}</p>
              {renderCell(col, tx)}
            </div>
          ))}
        </div>
      </Link>

      {/* Desktop grid — entire row navigates. Per-tab columns (see filesColumns);
          header + rows share the same model so they stay in lockstep. */}
      <Link
        href={withFrom(`${basePath}/${tx.id}`, basePath)}
        unstable_dynamicOnHover
        className="files-row-grid items-center agent-hover-row group"
        style={{ gridTemplateColumns: gridCols, textDecoration: "none", borderBottom: divider }}
      >
        <div className="px-4 py-3.5 min-w-0"><PropertyCell tx={tx} activeTab={activeTab} showAgency={showAgencyColumn} /></div>
        {cols.map((col) => (
          <div key={col} className="px-4 py-3.5 min-w-0">{renderCell(col, tx)}</div>
        ))}
      </Link>
    </div>
  );
}
