"use client";

// Chase Timeline — the read-only "live map" of everything the file is trying to
// get from other people. Left: scannable thread list. Right: progressive-
// disclosure detail (history + escalation path) for the selected thread.
// Client, manual, solicitor, enquiry + exchange tracks. See
// docs/active/chase-consolidation/00-spec.md.

import { useMemo, useState, type ReactNode } from "react";
import { Clock, ArrowRight, CaretLeft, CaretRight, PauseCircle } from "@phosphor-icons/react";
import type {
  ChaseThread, ChaseThreadState, ChaseTimelineStats, ChaseThreadEvent, ChaseEventCategory, ChaseActor, ChaseDelivery, ChasePauseState, NextSend,
} from "@/lib/services/chase-timeline";
import { NextChaseControl } from "@/components/transaction/NextChaseControl";
import { RescheduleChaseControl } from "@/components/transaction/RescheduleChaseControl";
import { Pill } from "@/components/ui/Pill";
import { ContactAvatar, UserAvatar } from "@/components/ui/Avatar";
import { SentEmailModal, type OpenEmail } from "@/components/transaction/SentEmailModal";
import { useGlassTag } from "@/lib/glass/use-glass-tag";

// State → glossy Pill tone (the app's canonical pill, not a flat chip).
const STATE_TONE: Record<ChaseThreadState, "info" | "brand" | "warning" | "success" | "danger" | "muted"> = {
  escalated: "danger", manual_chasing: "brand", handed_to_team: "warning",
  auto_chasing: "info", scheduled: "muted", snoozed: "muted", completed: "success", cancelled: "muted",
};

// ── meta maps ──────────────────────────────────────────────────────────────
const STATE_META: Record<ChaseThreadState, { label: string; color: string; rgb: string }> = {
  escalated:       { label: "Escalated",       color: "var(--agent-danger)",  rgb: "var(--agent-danger-rgb)"  },
  manual_chasing:  { label: "You're chasing",   color: "var(--agent-primary)", rgb: "var(--agent-primary-rgb)" },
  handed_to_team:  { label: "Handed to you",    color: "var(--agent-warning)", rgb: "var(--agent-warning-rgb)" },
  auto_chasing:    { label: "Auto-chasing",     color: "var(--agent-info)",    rgb: "var(--agent-info-rgb)"    },
  scheduled:       { label: "Scheduled",        color: "var(--agent-text-muted)", rgb: "148,163,184" },
  snoozed:         { label: "Paused",           color: "var(--agent-text-muted)", rgb: "148,163,184" },
  completed:       { label: "Completed",        color: "var(--agent-success)", rgb: "var(--agent-success-rgb)" },
  cancelled:       { label: "Stopped",          color: "var(--agent-text-muted)", rgb: "148,163,184" },
};

// Category → inline icon + accent colour. "auto" is the future-send paper-plane
// (same blue as an email). Icons mirror the approved /dev mock.
type Cat = ChaseEventCategory | "auto";
const CAT_ICON: Record<Cat, ReactNode> = {
  email: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>,
  auto: <path d="m3 10 18-7-7 18-3-8-8-3zm8 3L21 3" />,
  team: <path d="M5 5v5a4 4 0 0 0 4 4h10m-5-5 5 5-5 5" />,
  danger: <><circle cx="12" cy="12" r="8" /><path d="M12 8v5m0 3h.01" /></>,
  success: <path d="m6 12 4 4 8-8" />,
  milestone: <path d="m6 12 4 4 8-8" />,
  movement: <path d="M4 8h15m-4-4 4 4-4 4m5 4H5m4-4-4 4 4 4" />,
  calendar: <><rect x="4" y="6" width="16" height="14" rx="3" /><path d="M8 4v4m8-4v4M4 10h16" /></>,
  hold: <path d="M9 7v10m6-10v10" />,
};
const CAT_COLOR: Record<Cat, string> = {
  email: "var(--agent-info)", auto: "var(--agent-info)", team: "var(--agent-warning)",
  danger: "var(--agent-danger)", success: "var(--agent-success)", milestone: "var(--agent-success)",
  movement: "#0E8C86", calendar: "var(--agent-text-muted)", hold: "var(--agent-text-muted)",
};

const DELIVERY_META: Record<Exclude<ChaseDelivery, null>, { label: string; color: string }> = {
  sent:      { label: "Sent",      color: "var(--agent-text-muted)" },
  delivered: { label: "Delivered", color: "var(--agent-info)" },
  opened:    { label: "Opened",    color: "var(--agent-success)" },
  bounced:   { label: "Bounced",   color: "var(--agent-danger)" },
};

// Actor identity — avatar (photo or colour-coded SVG fallback) + full name + role.
function ActorIdentity({ actor }: { actor: ChaseActor }) {
  if (actor.kind === "system") {
    return (
      <div className="ct-actor">
        <span className="ct-sysav" aria-hidden><svg viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" /></svg></span>
        <div className="ct-who"><span className="ct-who-name">Autopilot</span></div>
      </div>
    );
  }
  return (
    <div className="ct-actor">
      {actor.side === "agent"
        ? <UserAvatar user={{ name: actor.name }} size={30} />
        : <ContactAvatar contact={{ name: actor.name, roleType: actor.side }} size={30} art />}
      <div className="ct-who">
        <span className="ct-who-name">{actor.name}</span>
        <span className="ct-who-role">{actor.role}</span>
      </div>
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  // Show the year when it isn't the current one, so a far-future date can never
  // read as "this week" (e.g. a parked chase showing "28 Sep" that's really 2027).
  const yearSuffix = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${yearSuffix}`;
}
// A chase parked far into the future — the enquiries "satisfied" gate holds it
// until the ball returns to the buyer's side. Surface it as "On hold" rather than
// a date that looks imminent. Only the gate's ~1-year park ever lands out here.
function isHeldFarOut(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() - Date.now() > 300 * 86_400_000;
}
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

// ── chips ──────────────────────────────────────────────────────────────────
function StateChip({ state, held }: { state: ChaseThreadState; held?: boolean }) {
  // A chase parked by the enquiries "satisfied" gate isn't scheduled — it's held
  // until the ball comes back to the buyer's side. Label it honestly.
  if (held) return <Pill glass dot size="sm" tone="muted">On hold</Pill>;
  return <Pill glass dot size="sm" tone={STATE_TONE[state]}>{STATE_META[state].label}</Pill>;
}

// ── pause pill (re-homed from the Reminders auto-emails card, D4) ─────────────
function PauseBanner({ pause }: { pause: NonNullable<ChasePauseState> }) {
  const msg =
    pause.reason === "global"
      ? "Chasing is switched off across the platform right now. Nothing will send until it's back on."
      : pause.reason === "agency"
        ? `Chasing is switched off for ${pause.agencyName ?? "this agency"}. Nothing will send on this file until it's back on.`
        : "Chasing is paused for this file. Nothing will send until you resume it.";
  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", borderRadius: 12,
        background: "rgba(var(--agent-warning-rgb), 0.10)", border: "0.5px solid rgba(var(--agent-warning-rgb), 0.35)",
      }}
    >
      <PauseCircle size={17} weight="fill" color="var(--agent-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--agent-warning)" }}>
          {pause.reason === "file" ? "Chasing paused for this file" : "Chasing is off"}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--agent-text-secondary)", margin: "2px 0 0", lineHeight: 1.45 }}>{msg}</p>
      </div>
    </div>
  );
}

// ── overview stats ───────────────────────────────────────────────────────────
function StatCard({ n, label, color }: { n: number; label: string; color: string }) {
  const tag = useGlassTag("chase-stat", "Chase · stat card", { light: "cs-b7c9ec28", dark: "cs-053799eb" });
  return (
    <div {...tag.props} className={tag.className} style={{
      flex: "1 1 120px", minWidth: 120, padding: "12px 16px", borderRadius: 14,
      ...(tag.picked ? {} : {
        background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-subtle)",
      }),
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color }}>{n}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    </div>
  );
}

// ── thread list card ─────────────────────────────────────────────────────────
function ThreadCard({ thread, selected, onSelect }: { thread: ChaseThread; selected: boolean; onSelect: () => void }) {
  const m = STATE_META[thread.state];
  const isVendor = thread.side === "vendor";
  const sideColor = thread.track === "exchange"
    ? "var(--agent-primary)"
    : isVendor ? "var(--agent-warning)" : "var(--agent-info)";
  const tag = useGlassTag("chase-thread-row", "Chase · thread row", { light: "v03", dark: "v04" });
  return (
    <button
      {...tag.props}
      onClick={onSelect}
      className={`w-full text-left chase-thread-card ${tag.className}`}
      style={{
        padding: "10px 12px", borderRadius: 12, display: "block",
        ...(tag.picked ? {} : {
          background: selected ? `rgba(${m.rgb}, 0.08)` : "transparent",
          borderLeft: `3px solid ${selected ? m.color : "transparent"}`,
          outline: selected ? "0.5px solid var(--agent-border-default)" : "none",
        }),
      }}
    >
      {/* Title takes the full row width now the pill has moved down — it
          truncates with an ellipsis when long. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: sideColor, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {thread.title}
        </span>
      </div>
      {/* Pill sits on the meta row, right of the side label. The "Auto N×" badge
          is gone (the pill already says "Auto-chasing"), and the next-chase date
          drops its "Auto/Chase" prefix for the same reason. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 14 }}>
        <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{thread.trackLabel}</span>
        <StateChip state={thread.state} held={isHeldFarOut(thread.nextDueAt)} />
        <span style={{ marginLeft: "auto", fontSize: 11, color: m.color, fontWeight: 600 }}>{nextLabel(thread)}</span>
      </div>
    </button>
  );
}

function nextLabel(t: ChaseThread): string {
  if (t.state === "completed") return "Done";
  if (t.state === "cancelled") return "Stopped";
  if (t.state === "escalated") return "Urgent";
  if (isHeldFarOut(t.nextDueAt)) return "On hold";
  // A hold (reschedule / date given) is already folded into nextDueAt — the row
  // shows the day the chase actually resumes, not a separate "Paused" concept.
  if (t.nextDueAt) return fmtDate(t.nextDueAt);
  if (t.snoozedUntil) return `Quiet to ${fmtDate(t.snoozedUntil)}`;
  return "";
}

// ── detail: one event row ────────────────────────────────────────────────────
export function EventRow({ ev, last, label, onOpenEmail }: { ev: ChaseThreadEvent; last: boolean; label: string; onOpenEmail: (id: string, label: string) => void }) {
  const dm = ev.delivery ? DELIVERY_META[ev.delivery] : null;
  const openable = !!ev.sentEmailId;
  return (
    <div className="ct-row" style={{ "--kind": CAT_COLOR[ev.category] } as React.CSSProperties}>
      <div className="ct-lead">
        <span className="ct-ic"><svg viewBox="0 0 24 24" aria-hidden="true">{CAT_ICON[ev.category]}</svg></span>
        {!last && <span className="ct-rail" />}
      </div>
      <div className="ct-body">
        <div className="ct-head"><h4 className="ct-title">{ev.title}</h4></div>
        {ev.subject && <p className="ct-sub">{ev.subject}</p>}
        {ev.detail && <p className="ct-p">{ev.detail}</p>}
        {ev.note && <p className="ct-note"><strong>{ev.note.label}</strong>{ev.note.text}</p>}
        {ev.actor && <ActorIdentity actor={ev.actor} />}
      </div>
      <div className="ct-right">
        <span className="ct-date">{fmtDateTime(ev.at)}</span>
        {dm && <span className="ct-status" style={{ color: dm.color }}>{dm.label}</span>}
        {openable && (
          <button type="button" className="ct-view" onClick={() => onOpenEmail(ev.sentEmailId as string, label)}>
            View email <span aria-hidden="true"> →</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── detail: escalation path (v1 — no director rung) ──────────────────────────
function EscalationPath({ thread }: { thread: ChaseThread }) {
  const rungs: { label: string; sub: string; status: "done" | "current" | "pending" }[] = [];
  const autoDone = thread.autoChases >= 2 || ["handed_to_team", "manual_chasing", "escalated"].includes(thread.state);
  const autoLabel = thread.track === "solicitor" ? "Solicitor auto-chase" : thread.track === "enquiry" ? "Automated nudges" : "Client auto-chase";

  rungs.push({
    label: autoLabel,
    // Enquiry threads: state the real schedule, not a vague "on a cadence".
    // Reply-loop repeats every 5 working days; the get-raised chase every 6.
    sub: thread.track === "enquiry"
      ? (thread.id === "enquiry-raise" ? "every 6 working days" : "every 5 working days")
      : "up to 2 emails",
    status: thread.state === "auto_chasing" ? "current" : autoDone ? "done" : "pending",
  });
  // Enquiries escalate straight to the file owner if they stall — no separate
  // manual-chase rung.
  if (thread.track !== "enquiry") {
    rungs.push({
      label: "Your team chases",
      sub: `${thread.manualChases}/${thread.escalatesAfter}`,
      status: thread.state === "escalated" ? "done" : thread.state === "manual_chasing" || thread.state === "handed_to_team" ? "current" : "pending",
    });
  }
  rungs.push({
    label: "Escalate to file owner",
    sub: thread.escalated ? "notified" : thread.track === "enquiry" ? "after 13 working days quiet" : "if it stalls",
    status: thread.escalated ? "current" : "pending",
  });

  return (
    <div>
      <SectionLabel>Escalation path</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rungs.map((r, i) => {
          const color = r.status === "done" ? "var(--agent-success)" : r.status === "current" ? "var(--agent-primary)" : "var(--agent-text-muted)";
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
              <span style={{ width: 18, height: 18, borderRadius: 999, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: r.status === "pending" ? "var(--agent-text-muted)" : "#fff", background: r.status === "pending" ? "transparent" : color, border: r.status === "pending" ? "1.5px solid var(--agent-border-default)" : "none" }}>
                {r.status === "done" ? "✓" : i + 1}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", flex: 1 }}>{r.label}</span>
              <span style={{ fontSize: 11, color, fontWeight: 600 }}>{r.status === "done" ? "Done" : r.status === "current" ? r.sub : r.sub}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SectionLabel({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)", marginBottom: noMargin ? 0 : 8 }}>{children}</div>;
}

// A small prev/next pager button for the "Up next" header. Full hover / focus /
// active / disabled states per the Definition of Done.
function PagerButton({ children, label, disabled, onClick }: { children: React.ReactNode; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button" aria-label={label} disabled={disabled} onClick={onClick} className="chase-pager-btn"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24,
        borderRadius: 7, padding: 0, background: "var(--agent-surface-elevated)",
        border: "0.5px solid var(--agent-border-subtle)", color: "var(--agent-text-secondary)",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

// ── detail: the "Up next" section — one card per recipient lane, paged when
// there's more than one so each full email preview keeps its width ────────────
function UpNextSection({ sends, transactionId }: { sends: NextSend[]; transactionId: string }) {
  const [idx, setIdx] = useState(0);
  const count = sends.length;
  const safeIdx = Math.min(idx, count - 1);
  const multi = count > 1;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <SectionLabel noMargin>Up next</SectionLabel>
        {multi && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <PagerButton label="Previous send" disabled={safeIdx === 0} onClick={() => setIdx(safeIdx - 1)}>
              <CaretLeft size={13} weight="bold" />
            </PagerButton>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", fontVariantNumeric: "tabular-nums", minWidth: 36, textAlign: "center" }}>
              {safeIdx + 1} of {count}
            </span>
            <PagerButton label="Next send" disabled={safeIdx === count - 1} onClick={() => setIdx(safeIdx + 1)}>
              <CaretRight size={13} weight="bold" />
            </PagerButton>
          </div>
        )}
      </div>
      <UpNextCard key={safeIdx} send={sends[safeIdx]} transactionId={transactionId} />
    </div>
  );
}

// ── detail: one "Up next" send card (glossy, per recipient lane) ─────────────
function UpNextCard({ send, transactionId }: { send: NextSend; transactionId: string }) {
  const isSol = send.lane === "solicitor";
  const accent = isSol ? "#0E8C86" : "var(--agent-info)";
  // A parked chase (satisfied-gate holding it until the ball returns to the buyer)
  // reads as "On hold", never a date that looks like it's about to send.
  const held = isHeldFarOut(send.dueAt);
  const whenLabel = held ? "On hold" : send.dueAt ? fmtDate(send.dueAt) : send.handedToTeam ? "With your team" : "Scheduled";
  // The email preview below carries the recipient (its To line); cards without
  // one (handed to the team) name the recipient in the kicker instead — the
  // recipient pill was removed as duplication.
  const showsPreview = !!send.overrideTarget && !send.handedToTeam;
  // Enquiry chases repeat until escalation (no numeric cap) — show "Next chase" +
  // an escalation deadline instead of the milestone "chase N of cap" line.
  const kickerBase = held
    ? "Waiting on replies to enquiries"
    : send.untilEscalation
      ? send.handedToTeam ? "Escalated to you" : "Next chase"
      : send.handedToTeam
        ? "Auto-chase done"
        : send.isAutomated ? `Auto-chasing · ${send.chaseNumber} of ${send.capOf} nudges` : `Reminder · ${send.chaseNumber} of ${send.capOf} nudges`;
  const kicker = showsPreview ? kickerBase : `${kickerBase} · ${send.recipientLabel}`;
  // The date itself is the reschedule control — on every lane, whenever an
  // automated send is genuinely scheduled (each lane has its own hold field the
  // sender respects; the raise chaser's is PM14's expected date).
  const canMove = !held && !send.handedToTeam && send.isAutomated && !!send.dueAt && !!send.overrideTarget;
  const tag = useGlassTag("chase-upnext", "Chase · up-next card", { light: "cs-b7c9ec28", dark: "v02" });
  return (
    <div {...tag.props} className={`chase-upnext-card ${tag.className}`} style={{
      position: "relative", overflow: "hidden", borderRadius: 14, padding: "13px 14px",
      ...(tag.picked ? {} : {
        background: "var(--agent-surface-nested, var(--agent-surface-elevated))", border: "0.5px solid var(--agent-border-subtle)",
      }),
    }}>
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent }} aria-hidden />
      {canMove && send.dueAt && send.overrideTarget ? (
        <div style={{ margin: "0 0 1px" }}>
          <RescheduleChaseControl transactionId={transactionId} target={send.overrideTarget} dueAtISO={send.dueAt} />
        </div>
      ) : (
        <div style={{ fontSize: 22, fontWeight: 780, letterSpacing: "-0.02em", margin: "0 0 1px", color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{whenLabel}</div>
      )}
      <div style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>{kicker}</div>
      {send.untilEscalation && send.escalatesAt && !send.handedToTeam && !held && (
        <div style={{ fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2 }}>
          Escalates to you if no reply by {fmtDate(send.escalatesAt)}
        </div>
      )}
      {send.overrideTarget && !send.handedToTeam && (
        <NextChaseControl transactionId={transactionId} target={send.overrideTarget} edited={send.edited} skipped={send.skipped} />
      )}
    </div>
  );
}

// ── detail: a future (predicted) node for the unified timeline ────────────────
export function FutureRow({ send }: { send: NextSend }) {
  const held = isHeldFarOut(send.dueAt);
  // recipientLabel is "Role · Name" for a client, or just "Buyer's solicitor".
  const parts = send.recipientLabel.split(" · ");
  const name = parts.length === 2 ? parts[1] : `the ${send.recipientLabel.toLowerCase()}`;
  const roleSub = parts.length === 2 ? parts[0] : null;
  const cat: Cat = held ? "hold" : send.handedToTeam ? "team" : send.isAutomated ? "auto" : "team";
  const pill = held ? "On hold" : send.handedToTeam || !send.isAutomated ? "For your team" : "Automatic";
  const pillTone: "muted" | "info" | "warning" = held ? "muted" : send.isAutomated && !send.handedToTeam ? "info" : "warning";
  const body = held
    ? "Waiting for replies to enquiries."
    : send.handedToTeam ? (roleSub ? `${roleSub} · In your work queue` : "In your work queue") : roleSub;
  const dateLabel = held || send.handedToTeam || !send.dueAt
    ? null
    : send.isAutomated ? `Due ${fmtDate(send.dueAt)}` : `Reminder on ${fmtDate(send.dueAt)}`;
  return (
    <div className="ct-row" style={{ "--kind": CAT_COLOR[cat] } as React.CSSProperties}>
      <div className="ct-lead">
        <span className="ct-ic dashed"><svg viewBox="0 0 24 24" aria-hidden="true">{CAT_ICON[cat]}</svg></span>
        <span className="ct-rail" />
      </div>
      <div className="ct-body">
        <div className="ct-head">
          <h4 className="ct-title">Follow up with {name}</h4>
          <Pill glass dot size="sm" tone={pillTone}>{pill}</Pill>
        </div>
        {body && <p className="ct-p">{body}</p>}
      </div>
      {dateLabel && <div className="ct-right"><span className="ct-date">{dateLabel}</span></div>}
    </div>
  );
}

// Hover/motion CSS for the timeline rows + up-next cards. Exported so the
// /dev/chase-timeline-rows harness renders the rows with identical affordances.
export const TIMELINE_CSS = `.chase-upnext-card{transition:transform .16s cubic-bezier(0.22,1,0.36,1),box-shadow .16s ease}
        .chase-upnext-card:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(15,23,42,0.06)}
        .chase-thread-card{transition:transform .16s cubic-bezier(0.22,1,0.36,1),box-shadow .16s ease,background .14s ease}
        .chase-thread-card:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(15,23,42,0.05)}
        .chase-pager-btn{transition:background .14s ease,border-color .14s ease,color .14s ease}
        .chase-pager-btn:not(:disabled):hover{background:var(--agent-surface-nested,var(--agent-surface-elevated));border-color:var(--agent-border-default);color:var(--agent-text-primary)}
        .chase-pager-btn:not(:disabled):active{transform:translateY(0.5px)}
        .chase-pager-btn:focus-visible{outline:2px solid var(--agent-primary);outline-offset:1px}
        /* Open-email hint on a sent row: text darkens on hover; the arrow fades in
           but its space is reserved, so "Open email" never shifts. */
        .chase-ev-hint-text{color:var(--agent-coral-deep);opacity:.68;transition:opacity .15s ease}
        .chase-ev-hint-arrow{color:var(--agent-coral-deep);opacity:0;transition:opacity .15s ease}
        .chase-ev-open:hover .chase-ev-hint-text{opacity:1}
        .chase-ev-open:hover .chase-ev-hint-arrow{opacity:1}
        .chase-ev-open:focus-visible{outline:2px solid var(--agent-primary);outline-offset:2px;border-radius:6px}
        @media (prefers-reduced-motion:reduce){.chase-upnext-card,.chase-pager-btn{transition:none}}
        /* Unified timeline rows (new design) */
        .ct-stack{container-type:inline-size}
        .ct-row{display:grid;grid-template-columns:28px minmax(0,1fr);column-gap:12px;--kind:var(--agent-text-muted)}
        .ct-row.ct-up{background:color-mix(in srgb,var(--kind) 8%,transparent);border-radius:12px;padding:8px 10px;margin:2px 0}
        .ct-lead{display:flex;flex-direction:column;align-items:center}
        .ct-ic{width:28px;height:28px;flex:none;margin-top:-1px;border-radius:50%;display:grid;place-items:center;background:var(--agent-surface-elevated);border:1.5px solid var(--kind);color:var(--kind)}
        .ct-ic.dashed{border-style:dashed}
        .ct-ic svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
        .ct-rail{width:2px;flex:1;min-height:16px;margin-top:3px;background:var(--agent-border-subtle)}
        .ct-body{min-width:0;padding-bottom:18px}
        .ct-row.ct-up .ct-body{padding-bottom:0}
        .ct-head{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px}
        .ct-title{font-size:14px;font-weight:600;letter-spacing:-.012em;line-height:1.35;color:var(--agent-text-primary);margin:0}
        .ct-p{font-size:12.5px;color:var(--agent-text-secondary);margin:3px 0 0;line-height:1.42}
        .ct-sub{font-size:12.5px;color:var(--agent-text-muted);margin:3px 0 0;line-height:1.42;font-style:italic;overflow-wrap:anywhere}
        .ct-note{margin:6px 0 0;border-left:2px solid var(--agent-border-strong);background:color-mix(in srgb,var(--agent-text-primary) 4%,transparent);border-radius:0 6px 6px 0;padding:5px 9px;font-size:12.5px;color:var(--agent-text-secondary)}
        .ct-note strong{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--agent-text-muted);margin-bottom:1px;font-weight:700}
        .ct-actor{display:flex;align-items:center;gap:9px;margin-top:9px}
        .ct-who{display:flex;flex-direction:column;min-width:0;line-height:1.25}
        .ct-who-name{font-size:12.5px;font-weight:600;color:var(--agent-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ct-who-role{font-size:11px;color:var(--agent-text-muted)}
        .ct-sysav{width:30px;height:30px;flex:none;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--agent-text-primary) 7%,transparent);color:var(--agent-text-muted)}
        .ct-sysav svg{width:14px;height:14px;fill:currentColor;stroke:none}
        .ct-right{grid-column:2;display:flex;flex-wrap:wrap;gap:3px 12px;margin-top:6px;font-size:11.5px;color:var(--agent-text-muted);font-variant-numeric:tabular-nums}
        .ct-status{display:inline-flex;align-items:center;gap:5px;font-weight:650}
        .ct-status:before{content:"";width:5px;height:5px;border-radius:999px;background:currentColor}
        .ct-view{display:inline-flex;align-items:center;background:none;border:none;padding:0;margin:0;font:inherit;cursor:pointer;color:var(--agent-coral-deep);font-weight:700;white-space:nowrap}
        .ct-view:hover{text-decoration:underline}
        .ct-view:focus-visible{outline:2px solid var(--agent-primary);outline-offset:2px;border-radius:5px}
        .ct-row.ct-up .ct-date{font-weight:650;color:var(--agent-text-secondary)}
        @container (min-width:460px){
          .ct-row:has(.ct-right){grid-template-columns:28px minmax(0,1fr) 150px}
          .ct-right{grid-column:3;grid-row:1;flex-direction:column;align-items:flex-end;gap:7px;margin-top:1px;text-align:right;white-space:nowrap}
        }`;

// ── detail pane ──────────────────────────────────────────────────────────────
function ThreadDetail({ thread, transactionId, onOpenEmail }: { thread: ChaseThread; transactionId: string; onOpenEmail: (id: string, label: string) => void }) {
  const isExchange = thread.track === "exchange";
  // Future nodes lead the timeline (soonest first), then the past events.
  const futureSends = [...thread.nextSends].sort((a, b) => {
    const at = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const bt = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    return at - bt;
  });
  const subtitle = isExchange
    ? `${thread.autoChases} email${thread.autoChases === 1 ? "" : "s"} today · started ${fmtDate(thread.startedAt)}`
    : `Waiting on ${thread.waitingOn} · ${thread.autoChases} chase${thread.autoChases === 1 ? "" : "s"} sent${thread.manualChases ? ` (${thread.manualChases} by you)` : ""} since ${fmtDate(thread.startedAt)}`;

  return (
    <div>
      <style>{TIMELINE_CSS}</style>

      {/* State pill removed here — the "Up next" card above the email now carries
          the state as its "Auto-chasing · N of M nudges" line, so a header pill
          would duplicate it. The thread list keeps one pill for scanning. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)", margin: 0 }}>{thread.title}</h3>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--agent-text-secondary)", margin: "0 0 18px" }}>{subtitle}</p>

      {/* Up next — one card per recipient lane (buyer + solicitor), paged so each
          full email preview keeps its width when there's more than one. */}
      {futureSends.length > 0 && (
        <UpNextSection sends={futureSends} transactionId={transactionId} />
      )}

      {/* Timeline — upcoming (dashed) flowing into what's happened */}
      <div style={{ marginBottom: isExchange ? 0 : 22 }}>
        <SectionLabel>Timeline</SectionLabel>
        <div className="ct-stack">
          {futureSends.map((s, i) => <FutureRow key={`f${i}`} send={s} />)}
          {thread.events.map((ev, i) => (
            <EventRow key={i} ev={ev} last={i === thread.events.length - 1} label={thread.trackLabel} onOpenEmail={onOpenEmail} />
          ))}
        </div>
      </div>

      {/* If it stalls */}
      {!isExchange && <EscalationPath thread={thread} />}
    </div>
  );
}

// ── root ─────────────────────────────────────────────────────────────────────
export function ChaseTimeline({ stats, threads, transactionId, pause }: { stats: ChaseTimelineStats; threads: ChaseThread[]; transactionId: string; pause: ChasePauseState }) {
  const activeStates: ChaseThreadState[] = ["escalated", "manual_chasing", "handed_to_team", "auto_chasing", "scheduled", "snoozed"];
  const active = threads.filter((t) => activeStates.includes(t.state));
  const done = threads.filter((t) => t.state === "completed" || t.state === "cancelled");

  const [selectedId, setSelectedId] = useState<string>(threads[0]?.id ?? "");
  const [showDone, setShowDone] = useState(false);
  const [openEmail, setOpenEmail] = useState<OpenEmail | null>(null);
  const selected = useMemo(() => threads.find((t) => t.id === selectedId) ?? threads[0], [threads, selectedId]);
  const listTag = useGlassTag("chase-list-panel", "Chase · thread list panel", { light: "v06", dark: "v02" });
  const detailTag = useGlassTag("chase-detail-panel", "Chase · thread detail panel", { light: "cs-b7c9ec28", dark: "cs-053799eb" });

  return (
    <div data-tour="chase-threads" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {pause && <PauseBanner pause={pause} />}

      {/* Overview stats */}
      <div data-bloom style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatCard n={stats.active} label="Active chases" color="var(--agent-text-primary)" />
        <StatCard n={stats.dueToday} label="Due today" color="var(--agent-warning)" />
        <StatCard n={stats.escalating} label="Escalating" color="var(--agent-danger)" />
        <StatCard n={stats.completed} label="Completed" color="var(--agent-success)" />
      </div>

      {/* List + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr]" style={{ gap: 16, alignItems: "start" }}>
        {/* Left: thread list */}
        <div data-bloom {...listTag.props} className={listTag.className} style={{ borderRadius: 16, padding: 8, ...(listTag.picked ? {} : { background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-subtle)" }) }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)", padding: "6px 8px 8px" }}>
            Chase threads
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {active.map((t) => (
              <div data-bloom key={t.id}>
                <ThreadCard thread={t} selected={t.id === selected?.id} onSelect={() => setSelectedId(t.id)} />
              </div>
            ))}
            {active.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--agent-text-muted)", padding: "8px 12px" }}>Nothing active. Everything is resolved or paused.</p>
            )}
          </div>

          {done.length > 0 && (
            <div style={{ marginTop: 8, borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 6 }}>
              <button
                onClick={() => setShowDone((v) => !v)}
                className="w-full text-left"
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)" }}
              >
                <ArrowRight size={12} weight="bold" style={{ transform: showDone ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
                Resolved &amp; stopped ({done.length})
              </button>
              {showDone && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {done.map((t) => (
                    <ThreadCard key={t.id} thread={t} selected={t.id === selected?.id} onSelect={() => setSelectedId(t.id)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: detail */}
        <div data-bloom {...detailTag.props} className={detailTag.className} style={{ borderRadius: 16, padding: "18px 20px", minHeight: 200, ...(detailTag.picked ? {} : { background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-subtle)" }) }}>
          {selected ? <ThreadDetail thread={selected} transactionId={transactionId} onOpenEmail={(id, label) => setOpenEmail({ id, label })} /> : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, gap: 8, color: "var(--agent-text-muted)" }}>
              <Clock size={16} /> <span style={{ fontSize: 13 }}>Select a thread to see its history.</span>
            </div>
          )}
        </div>
      </div>

      <p style={{ fontSize: 11, color: "var(--agent-text-muted)", textAlign: "center" }}>
        All times UK. Delivery signals are best-effort. Client auto-chases show delivery, not opens.
      </p>

      <SentEmailModal email={openEmail} onClose={() => setOpenEmail(null)} />
    </div>
  );
}
