"use client";

import { useState, useRef, type ReactNode, type FormEvent, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { withFrom } from "@/lib/agent/back-nav";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tooltip, Popover } from "@/components/ui/Popover";
import { calculateRiskScore, type RiskLevel } from "@/lib/services/risk";
import { ExchangeTargetCell } from "@/components/transactions/ExchangeTargetCell";
import { RiskBadgeWithPopover } from "@/components/transactions/RiskBadgeWithPopover";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { useGlassTag } from "@/lib/glass/use-glass-tag";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { UserAvatar, UserAvatarStack } from "@/components/ui/Avatar";
import { EnvelopeSimple, WhatsappLogo, ChatText, Phone, NotePencil, Check, SealCheck, PaperPlaneTilt, ArrowBendUpLeft, ChatCircleDots, ClockCounterClockwise, TrendUp, TrendDown, Minus, PauseCircle, CheckCircle, Prohibit, WarningCircle, CalendarBlank } from "@phosphor-icons/react";
import { JourneyBar } from "./JourneyBar";
import { jobTitleLabel } from "@/lib/contacts/job-title-label";
import { formatDate } from "@/lib/utils";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { updateHoldReasonAction, extendHoldAction } from "@/app/actions/automation";
import { useIsFounder } from "@/components/layout/FounderGate";
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
  | "handled" | "people";

// Column set per tab. Founder preview (2026-11-15): drop the "Next action" column
// and instead end every tab with a "Handled by" people column — the 1–2 people on
// the file (owner + progressor), avatar + name + role. The classic table keeps its
// Next action column and its own "handled" column exactly as before.
export function filesColumns(tab: FilesTab, showAssigned: boolean, _showAgency?: boolean, preview?: boolean): FilesColumn[] {
  let cols: FilesColumn[];
  switch (tab) {
    case "active":    cols = preview ? ["stage", "exchange"] : ["stage", "activity", "exchange"]; break;
    case "on_hold":   cols = ["stage", "review", "paused"]; break;
    case "completed": cols = ["soldfor", "exchanged", "completed"]; break;
    case "withdrawn": cols = ["reached", "withdrawnDate", "reason"]; break;
    default:          cols = preview ? ["stage", "keydate"] : ["stage", "activity", "keydate"]; break; // all + draft
  }
  if (showAssigned && !preview) cols.push("handled");
  // The preview "Handled by" column shows BOTH people on the file (owner +
  // progressor), so unlike the classic single-assignee column it's useful for
  // everyone — including TSP progressors, for whom showAssigned is off. Not
  // gated on showAssigned.
  if (preview) cols.push("people");
  return cols;
}

// Grid track per column — activity / paused / reason flex, the rest fixed.
const COL_TRACK: Record<FilesColumn, string> = {
  stage: "190px", activity: "minmax(220px,1.35fr)", exchange: "190px", keydate: "190px",
  review: "140px", paused: "minmax(200px,1.2fr)",
  soldfor: "120px", exchanged: "150px", completed: "150px",
  reached: "190px", withdrawnDate: "150px", reason: "minmax(240px,1.6fr)",
  handled: "160px", people: "minmax(180px,1fr)",
};
// Min px each track can shrink to — drives the card↔grid switch bucket.
const COL_MIN: Record<FilesColumn, number> = {
  stage: 190, activity: 220, exchange: 190, keydate: 190,
  review: 140, paused: 200, soldfor: 120, exchanged: 150, completed: 150,
  reached: 190, withdrawnDate: 150, reason: 240, handled: 160, people: 180,
};
// Card mini-labels (and the desktop header labels, via TransactionTable).
export const COL_LABEL: Record<FilesColumn, string> = {
  stage: "Stage / Progress", activity: "Latest activity / Next step", exchange: "Exchange forecast",
  keydate: "Key date", review: "Due back", paused: "Paused",
  soldfor: "Sold for", exchanged: "Exchanged", completed: "Completed",
  reached: "Reached", withdrawnDate: "Withdrawn", reason: "Reason", handled: "Handled by", people: "Handled by",
};
// The founder preview tightens three of the labels; everyone else sees the
// strings above unchanged. Use colLabel() wherever a header / card label renders.
const COL_LABEL_PREVIEW: Partial<Record<FilesColumn, string>> = {
  stage: "Progress", exchange: "Predicted exchange",
};
export function colLabel(col: FilesColumn, preview?: boolean): string {
  return (preview && COL_LABEL_PREVIEW[col]) || COL_LABEL[col];
}

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
  // The single next-step line (ladder: needs you → ready to exchange → system chasing → parked → chain → calm).
  nextStep?: { text: string; tone: "danger" | "warn" | "accent" | "chain" | "ready" | "auto" | "muted" } | null;
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
  assignedUser: { id: string; name: string; image?: string | null; jobTitle?: string | null } | null;
  health?: HealthRaw;
  serviceType?: "self_managed" | "outsourced" | null;
  agentUser?: { id: string; name: string; role?: UserRole; image?: string | null; jobTitle?: string | null } | null;
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

const NEXT_TONE: Record<"danger" | "warn" | "accent" | "chain" | "ready" | "auto" | "muted", string> = {
  danger: "var(--agent-danger)", warn: "var(--agent-warning)", accent: "var(--agent-coral-deep)",
  chain: "#5b6b8c", ready: "var(--agent-success)", auto: "var(--agent-info)", muted: "var(--agent-text-muted)",
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

// Pace vs the 12-week target — a quiet icon + text (no pill), under the exchange
// date. Shown in the classic (non-founder) exchange cell.
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
        {idx + 1} of {DISPLAY_STAGES.length} steps
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
  return (
    <Tooltip content={<JourneyStages stage={stage} />} placement="bottom-start" block={block}>
      <span style={{ display: block ? "block" : "inline-block", width: block ? "100%" : undefined, maxWidth: "100%", verticalAlign: "top" }}>
        {children}
      </span>
    </Tooltip>
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
  return (
    <div>
      <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>{when ? formatDate(when) : "—"}</p>
      {reason ? (
        <Tooltip
          placement="bottom-start"
          content={
            <>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--agent-text-muted)" }}>Why it was withdrawn</p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--agent-text-primary)", lineHeight: 1.4 }}>{reason}</p>
            </>
          }
        >
          <span
            style={{ fontSize: 11, color: "var(--agent-text-muted)", cursor: "default", borderBottom: "1px dotted rgba(15,23,42,0.30)", display: "inline-block", marginTop: 2 }}
          >
            Reason
          </span>
        </Tooltip>
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
  // Self-managed: whoever added it, plus the current handler when that's someone
  // else (a reassignment, or Boardwalk's client-manager -> progressor hand-off).
  // Each is labelled by their JOB TITLE — so "Client manager" / "Progressor" are
  // just job titles now, not bespoke code. A blank title, or a bare "Director" /
  // "Negotiator", shows no label (just name + face), which keeps a normal agency's
  // reassignment clean. Same person on both slots shows once.
  const adder = tx.agentUser ?? null;
  const handler = tx.assignedUser ?? null;
  if (adder && handler && adder.id !== handler.id) {
    return (
      <div className="handled">
        <Person user={adder} role={jobTitleLabel(adder.jobTitle)} />
        <Person user={handler} role={jobTitleLabel(handler.jobTitle)} />
      </div>
    );
  }
  const who = handler ?? adder;
  return who
    ? <Person user={who} role={jobTitleLabel(who.jobTitle)} />
    : <span className="handled-none">Unassigned</span>;
}

// A person's "Handled by" role line is their job title, but only when it carries
// meaning: a blank title, or a bare "Director" / "Negotiator" (the generic agency
// roles), shows nothing rather than a redundant label. Real titles — "Client
// manager", "Progressor", "Sales Progressor", "Service Director" — show as set.
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
function ExchangeCell({ tx, preview }: { tx: TransactionRow; preview?: boolean }) {
  if (tx.exchangedAt) {
    return (
      <div>
        <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--agent-text-muted)" }}>Completion scheduled</p>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)" }}>
          {tx.completionDate ? longDateOrdinal(new Date(tx.completionDate)) : "To be confirmed"}
        </span>
      </div>
    );
  }
  // Founder preview drops the pace line (the predicted date carries it); the
  // classic cell keeps the pace line exactly as before.
  if (preview) {
    return (
      <ExchangeTargetCell transactionId={tx.id} expectedExchangeDate={tx.expectedExchangeDate} overridePredictedDate={tx.overridePredictedDate ?? null} createdAt={tx.createdAt} />
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
// The on-hold "Due back" cell. The value is clickable — it opens a date popover
// (the same popup style as the Completions date/fee menus) that sets the return
// date via extendHoldAction. "Not set" reads like the "Set fee" affordance.
function ReviewCell({ tx, label }: { tx: TransactionRow; label?: string }) {
  const h = tx.health?.holdInfo;
  const router = useRouter();
  const { toast } = useAgentToast();
  const caption = label && h ? (
    <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--agent-text-muted)" }}>{label}</p>
  ) : null;

  if (!h) return <div>{caption}<span style={{ fontSize: 13, color: "var(--agent-text-muted)" }}>—</span></div>;

  const current = h.review ? new Date(h.review).toISOString().split("T")[0] : "";
  const value = h.review
    ? (h.reviewOverdue
        ? (<><span style={{ fontSize: 14, fontWeight: 700, color: "var(--agent-danger)" }}>Overdue</span><span style={{ display: "block", fontSize: 11.5, color: "var(--agent-danger)" }}>was {formatDate(new Date(h.review))}</span></>)
        : <span style={{ fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)" }}>{formatDate(new Date(h.review))}</span>)
    : <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-coral-deep)" }}>Not set</span>;

  return (
    <div>
      {caption}
      <Popover
        preset="popover"
        width={220}
        placement="bottom-start"
        trigger={<button type="button" className="files-dueback-btn">{value}</button>}
      >
        {(close) => (
          <HoldDateForm txId={tx.id} current={current} onSaved={() => { close(); router.refresh(); }} onError={(m) => toast.error(m)} onCancel={close} />
        )}
      </Popover>
    </div>
  );
}

function HoldDateForm({ txId, current, onSaved, onError, onCancel }: { txId: string; current: string; onSaved: () => void; onError: (m: string) => void; onCancel?: () => void }) {
  const [val, setVal] = useState(current);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  function openPicker() { const el = inputRef.current; if (!el) return; try { el.showPicker(); } catch { el.focus(); } }
  async function save() {
    if (!val) return;
    setSaving(true);
    const res = await extendHoldAction(txId, new Date(`${val}T00:00:00.000Z`));
    setSaving(false);
    if (res.ok) onSaved(); else onError(res.error ?? "Couldn't set the date");
  }
  return (
    <>
      <p className="comp-pop-label">When should it come back?</p>
      <div className="comp-date-field" role="button" tabIndex={0} onClick={openPicker} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPicker(); } }}>
        <CalendarBlank size={15} style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
        <input ref={inputRef} type="date" value={val} min={tomorrow} onChange={(e) => setVal(e.target.value)} className="comp-date-input" />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {onCancel && (
          <button type="button" onClick={onCancel} style={{ padding: "0 14px", height: 36, borderRadius: 10, border: "1px solid var(--agent-border-default)", background: "var(--agent-surface-elevated,#fff)", color: "var(--agent-text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        )}
        <button type="button" className="comp-pop-cta" style={{ flex: 1, height: 36, padding: "0 14px", borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center" }} disabled={!val || saving} onClick={save}>{saving ? "Saving…" : "Set date"}</button>
      </div>
    </>
  );
}

// On-hold — how long + the typed reason, inline-editable (hover reveals a pencil).
function PausedCell({ tx }: { tx: TransactionRow }) {
  const h = tx.health?.holdInfo;
  if (!h) return <span style={{ fontSize: 13, color: "var(--agent-text-muted)" }}>&ndash;</span>;
  return (
    <div className="paused-cell">
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>{h.days} days</p>
      <PausedReason txId={tx.id} reason={h.reason ?? null} />
    </div>
  );
}

// Inline add/edit of the hold reason from the Files list. The pencil fades in on
// hover of the cell; the editor slides in, saves on submit, and animates closed.
// A single underline on the input, no chunky border; Save sits to its right.
function PausedReason({ txId, reason: initial }: { txId: string; reason: string | null }) {
  const [reason, setReason] = useState<string | null>(initial);
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [draft, setDraft] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useAgentToast();

  function startClose() {
    setClosing(true);
    setTimeout(() => { setEditing(false); setClosing(false); }, 150);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const res = await updateHoldReasonAction(txId, draft);
    setSaving(false);
    if (res.ok) { setReason(draft.trim() || null); startClose(); }
    else toast.error(res.error ?? "Couldn't save the reason");
  }

  if (editing) {
    return (
      <form
        className={`paused-edit${closing ? " closing" : ""}`}
        onSubmit={save}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <input
          ref={inputRef}
          className="paused-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); startClose(); } }}
          placeholder="Add a reason"
          maxLength={500}
          aria-label="Hold reason"
        />
        <button type="submit" className="paused-save" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </form>
    );
  }
  return (
    <div className="paused-reason-row">
      {reason
        ? <span style={{ fontSize: 11.5, color: "var(--agent-text-secondary)", fontStyle: "italic" }}>&ldquo;{reason}&rdquo;</span>
        : <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>No reason given</span>}
      <button
        type="button"
        className="paused-pencil"
        aria-label="Edit reason"
        title="Edit reason"
        onClick={(e) => {
          e.preventDefault(); e.stopPropagation();
          setDraft(reason ?? ""); setEditing(true);
          setTimeout(() => inputRef.current?.focus(), 20);
        }}
      >
        <NotePencil size={12} weight="bold" />
      </button>
    </div>
  );
}

// Completed — agreed sale price (priceAtExchange in pence; the row anchor).
function SoldForCell({ tx }: { tx: TransactionRow }) {
  const pence = tx.priceAtExchange ?? tx.purchasePrice ?? null;
  const txt = pence != null ? `£${Math.round(pence / 100).toLocaleString("en-GB")}` : "—";
  return <span style={{ fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{txt}</span>;
}

function DateCell({ d }: { d?: Date | null }) {
  return <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>{d ? formatDate(new Date(d)) : "—"}</span>;
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
// The "Key date" means a different thing per status, so on the mixed All tab
// each date says which one it is.
function keyDateLabel(tx: TransactionRow): string {
  switch (tx.status) {
    case "active": return tx.exchangedAt ? "Completion" : "Predicted exchange";
    case "on_hold": return "Due back";
    case "completed": return "Completion";
    case "withdrawn": return "Withdrawn";
    default: return "Key date";
  }
}
function KeyDateCell({ tx, preview, caption = true }: { tx: TransactionRow; preview?: boolean; caption?: boolean }) {
  const inner =
    tx.status === "active" ? <ExchangeCell tx={tx} preview={preview} />
    : tx.status === "on_hold" ? <ReviewCell tx={tx} />
    : tx.status === "completed" ? <DateCell d={tx.completionDate} />
    : tx.status === "withdrawn" ? <DateCell d={tx.updatedAt} />
    : <span style={{ fontSize: 13, color: "var(--agent-text-muted)" }}>—</span>;
  if (!caption) return inner;
  return (
    <div>
      <p style={{ margin: "0 0 2px", fontSize: 10.5, fontWeight: 600, color: "var(--agent-text-muted)" }}>{keyDateLabel(tx)}</p>
      {inner}
    </div>
  );
}

// The single "how's it going" marker for a row: the risk badge (active), or an
// On hold / Completed line. Rendered under the dashes in the grid, and on the
// Progress eyebrow row in the stacked card.
function rowStatusNode(tx: TransactionRow, preview?: boolean): ReactNode {
  if (tx.status === "on_hold") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--agent-warning)" }}><PauseCircle size={14} weight="fill" /> On hold</span>
  );
  if (tx.status === "completed") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#2563a8" }}><CheckCircle size={14} weight="fill" /> Completed</span>
  );
  if (tx.status === "withdrawn") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#64748b" }}><Prohibit size={14} weight="fill" /> Withdrawn</span>
  );
  if (preview && tx.status === "active" && tx.health) return <RiskBadgeWithPopover raw={tx.health} />;
  return null;
}

function StageCell({ tx, preview, showStatus = true }: { tx: TransactionRow; preview?: boolean; showStatus?: boolean }) {
  if (!tx.boardStage) return <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>—</span>;
  // block=true + .files-stagecell CSS makes the bar fill its column (desktop) and
  // the full card width (mobile), instead of its fixed 210px (which overflowed).
  // On-hold and completed rows show the same stage + dashes, faded (the whole
  // journey is dimmed via .files-stage-faded — the colours stay, just reduced
  // opacity). Completed renders the bar all-green (complete).
  // showStatus=false in the stacked card, where the status lives on the Progress
  // eyebrow row instead of under the dashes.
  const onHold = tx.status === "on_hold";
  const done = tx.status === "completed";
  const withdrawn = tx.status === "withdrawn";
  const status = showStatus ? rowStatusNode(tx, preview) : null;
  return (
    <div className={`files-stagecell${onHold || done || withdrawn ? " files-stage-faded" : ""}`}>
      <JourneyHover stage={tx.boardStage} block><JourneyBar stage={tx.boardStage} complete={done} /></JourneyHover>
      {status && <div style={{ marginTop: 6 }}>{status}</div>}
    </div>
  );
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
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-secondary)" }}>{name}</span>
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
function RowMarker({ tx, activeTab, preview }: { tx: TransactionRow; activeTab?: FilesTab; preview?: boolean }) {
  const mark = (color: string, Icon: typeof PauseCircle, label: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color }}><Icon size={13} weight="fill" /> {label}</span>
  );
  // Founder preview: every status (risk + on hold / completed / withdrawn) now
  // reads under the stage bar (rowStatusNode in StageCell), so nothing shows
  // beside the address. The classic table keeps the terminal marks here.
  const riskBadge = preview || !tx.health ? null : <RiskBadgeWithPopover raw={tx.health} />;
  if (activeTab === "all") {
    if (preview) return null;
    if (tx.status === "on_hold") return mark("var(--agent-warning)", PauseCircle, "On hold");
    if (tx.status === "completed") return mark("#2563a8", CheckCircle, "Completed");
    if (tx.status === "withdrawn") return mark("#64748b", Prohibit, "Withdrawn");
    return riskBadge;
  }
  if (activeTab === "active" || activeTab === undefined) return riskBadge;
  return null;
}

function renderCell(col: FilesColumn, tx: TransactionRow, preview?: boolean): ReactNode {
  switch (col) {
    case "stage": return <StageCell tx={tx} preview={preview} />;
    case "activity": return <ActivityVerbChip tx={tx} />;
    case "exchange": return <ExchangeCell tx={tx} preview={preview} />;
    case "keydate": return <KeyDateCell tx={tx} preview={preview} />;
    case "review": return <ReviewCell tx={tx} />;
    case "paused": return <PausedCell tx={tx} />;
    case "soldfor": return <SoldForCell tx={tx} />;
    case "exchanged": return <DateCell d={tx.exchangedAt} />;
    case "completed": return <DateCell d={tx.completionDate} />;
    case "reached": return <ReachedCell tx={tx} />;
    case "withdrawnDate": return <DateCell d={tx.updatedAt} />;
    case "reason": return <ReasonCell tx={tx} />;
    case "handled": return <HandledBy tx={tx} />;
    case "people": return <HandledBy tx={tx} />;
  }
}

// Property identity — thumb + address + one marker, with town/postcode and
// agency (internal/multi-agency only) stacked beneath. For roles that previously
// had the "Handled by" column (directors / internal / external progressors) a
// small assignee avatar sits at the end, with the handler's name + role on hover;
// the full team shows in the floating preview.
function PropertyCell({ tx, activeTab, showAgency, preview, compact }: { tx: TransactionRow; activeTab?: FilesTab; showAgency?: boolean; showAssigned?: boolean; preview?: boolean; compact?: boolean }) {
  const { line, location } = splitAddress(tx.propertyAddress);
  const marker = <RowMarker tx={tx} activeTab={activeTab} preview={preview} />;
  // The people on the file now live in the "Handled by" column (far right), not
  // as an avatar stack here.
  return (
    <div className="files-id flex items-center gap-3 min-w-0">
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
  onSelect,
  selected = false,
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
  // Files redesign (2026-11-13): a plain left-click opens the floating preview
  // instead of navigating. Modifier-click / middle-click still open the full
  // file (the row stays an <a> so ⌘-click-new-tab keeps working). When onSelect
  // is absent the row navigates as before (e.g. standalone consumers).
  onSelect?: (id: string) => void;
  selected?: boolean;
}) {
  // Column set is decided by the active tab (see filesColumns) so the row grid
  // matches the header exactly. Cell CONTENT keys off this row's own status, so
  // a completed row on the "All" tab still shows a completion date and no risk.
  // Falls back to the full "all" column set for standalone consumers.
  // Founder preview gate (files redesign): founders get the new rows + floating
  // preview; everyone else sees the classic table exactly as before. Reads the
  // same ellis@-only flag the shell provides; defaults false outside a provider.
  const preview = useIsFounder();
  const cols = colsProp ?? filesColumns("all", showAssignedToColumn, showAgencyColumn, preview);
  const gridCols = filesGridTemplate(cols);
  const divider = !isLast ? "0.5px solid var(--agent-border-subtle)" : undefined;
  const rowTag = useGlassTag("files-row", "Files · row");

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    // Plain left-click → open the preview; let modified clicks navigate so
    // ⌘/ctrl-click (new tab) and open-in-new-window still reach the full file.
    if (onSelect && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      onSelect(tx.id);
    }
  }
  const selClass = selected ? " files-row-selected" : "";

  return (
    <div data-bloom>
      {/* Card row — stacked layout, shown until the list is wide enough for the
          grid (container-driven via .files-table / .files-switch-N). */}
      <Link
        href={withFrom(`${basePath}/${tx.id}`, basePath)}
        unstable_dynamicOnHover
        onClick={handleClick}
        aria-current={selected ? "true" : undefined}
        className={`files-row-card agent-hover-row ${rowTag.className}${selClass}`}
        {...rowTag.props}
        style={{ textDecoration: "none", borderBottom: divider }}
      >
        <div className="flex-1 px-4 py-4 min-w-0 space-y-3">
          {/* The last column is a date-ish value (key date / exchange / completed
              etc.) — in the stacked card layout it sits top-right on the address
              row rather than at the bottom. Text columns (paused / reason /
              activity) stay stacked. */}
          {(() => {
            const last = cols[cols.length - 1];
            const moveLast = !["paused", "activity", "stage", "handled", "reason"].includes(last);
            const bodyCols = moveLast ? cols.slice(0, -1) : cols;

            if (preview) {
              // Founder card (drawer open): the people on the file show as
              // overlapping avatars in the top-right (no tooltip — the open drawer
              // names them). The bottom row pairs the final two columns (last
              // right-aligned) only when the second-to-last is a compact column,
              // never a progress bar (stage / reached), which always stacks.
              const people: { name: string; image: string | null; role: string | undefined }[] = [];
              if (tx.agentUser) people.push({ name: tx.agentUser.name, image: tx.agentUser.image ?? null, role: jobTitleLabel(tx.agentUser.jobTitle) ?? "Agent" });
              if (tx.assignedUser && tx.assignedUser.id !== tx.agentUser?.id) people.push({ name: tx.assignedUser.name, image: tx.assignedUser.image ?? null, role: jobTitleLabel(tx.assignedUser.jobTitle) ?? "Progressor" });
              const eyebrow = (text: string) => (
                <p style={{ margin: "0 0 2px", fontSize: 11.5, fontWeight: 600, lineHeight: 1.2, color: "var(--agent-text-muted)" }}>{text}</p>
              );
              const hasPeople = cols[cols.length - 1] === "people";
              const main = hasPeople ? cols.slice(0, -1) : cols;
              const isBar = (c: FilesColumn) => c === "stage" || c === "reached";
              const useFoot = main.length >= 2 && !isBar(main[main.length - 2]);
              const footRight = useFoot ? main[main.length - 1] : undefined;
              const footLeft = useFoot ? main[main.length - 2] : undefined;
              const stackCols = useFoot ? main.slice(0, -2) : main;
              const stacked = (col: FilesColumn) => (
                col === "stage" ? (
                  <>
                    {/* Progress eyebrow row carries the status on the right. */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "0 0 2px" }}>
                      <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, lineHeight: 1.2, color: "var(--agent-text-muted)" }}>{colLabel(col, preview)}</p>
                      {rowStatusNode(tx, preview)}
                    </div>
                    <StageCell tx={tx} preview={preview} showStatus={false} />
                  </>
                ) : col === "keydate" ? (
                  <>{eyebrow(keyDateLabel(tx))}<KeyDateCell tx={tx} preview={preview} caption={false} /></>
                ) : col === "exchange" ? (
                  <>{eyebrow("Predicted exchange")}{renderCell(col, tx, preview)}</>
                ) : (
                  <>{eyebrow(colLabel(col, preview))}{renderCell(col, tx, preview)}</>
                )
              );
              return (
                <>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0"><PropertyCell tx={tx} activeTab={activeTab} showAgency={showAgencyColumn} showAssigned={showAssignedToColumn} preview compact /></div>
                    {hasPeople && (people.length > 0
                      ? <span className="shrink-0" aria-label={`On the file: ${people.map((p) => p.name).join(", ")}`}>
                          <UserAvatarStack people={people} size={28} />
                        </span>
                      : <span className="shrink-0 handled-none" style={{ fontSize: 12, color: "var(--agent-text-muted)", whiteSpace: "nowrap" }}>Unassigned</span>
                    )}
                  </div>
                  {stackCols.map((col) => <div key={col}>{stacked(col)}</div>)}
                  {footLeft && footRight && (
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="min-w-0">
                        {eyebrow(colLabel(footLeft, preview))}
                        {renderCell(footLeft, tx, preview)}
                      </div>
                      <div className="text-right ml-auto">
                        {eyebrow(footRight === "keydate" ? keyDateLabel(tx) : footRight === "exchange" ? "Predicted exchange" : colLabel(footRight, preview))}
                        {footRight === "keydate" ? <KeyDateCell tx={tx} preview={preview} caption={false} /> : renderCell(footRight, tx, preview)}
                      </div>
                    </div>
                  )}
                </>
              );
            }

            return (
              <>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0"><PropertyCell tx={tx} activeTab={activeTab} showAgency={showAgencyColumn} showAssigned={showAssignedToColumn} preview={preview} compact /></div>
                  {moveLast && <div className="shrink-0 text-right">{renderCell(last, tx, preview)}</div>}
                </div>
                {bodyCols.map((col) => (
                  <div key={col}>
                    <p style={{ margin: "0 0 5px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>{colLabel(col, preview)}</p>
                    {renderCell(col, tx, preview)}
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      </Link>

      {/* Desktop grid — plain click opens the preview (see handleClick). Per-tab
          columns (see filesColumns); header + rows share the same model. */}
      <Link
        href={withFrom(`${basePath}/${tx.id}`, basePath)}
        unstable_dynamicOnHover
        onClick={handleClick}
        aria-current={selected ? "true" : undefined}
        className={`files-row-grid items-center agent-hover-row group ${rowTag.className}${selClass}`}
        {...rowTag.props}
        style={{ gridTemplateColumns: gridCols, textDecoration: "none", borderBottom: divider }}
      >
        <div className="px-4 py-3.5 min-w-0"><PropertyCell tx={tx} activeTab={activeTab} showAgency={showAgencyColumn} showAssigned={showAssignedToColumn} preview={preview} /></div>
        {cols.map((col) => (
          <div key={col} className="px-4 py-3.5 min-w-0">{renderCell(col, tx, preview)}</div>
        ))}
      </Link>
    </div>
  );
}
