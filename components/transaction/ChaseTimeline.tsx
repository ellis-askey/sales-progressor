"use client";

// Chase Timeline — the read-only "live map" of everything the file is trying to
// get from other people. Left: scannable thread list. Right: progressive-
// disclosure detail (history + escalation path) for the selected thread.
// Client, manual, solicitor, enquiry + exchange tracks. See
// docs/active/chase-consolidation/00-spec.md.

import { useMemo, useState } from "react";
import {
  CalendarBlank, PaperPlaneTilt, Robot, User, WarningCircle, CheckCircle,
  PauseCircle, XCircle, ArrowBendDownRight, Clock, ArrowRight,
} from "@phosphor-icons/react";
import type {
  ChaseThread, ChaseThreadState, ChaseTimelineStats, ChaseThreadEvent, ChaseEventKind, ChaseDelivery, ChasePauseState, NextSend,
} from "@/lib/services/chase-timeline";
import { NextChaseControl } from "@/components/transaction/NextChaseControl";
import { Pill } from "@/components/ui/Pill";

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

const EVENT_META: Record<ChaseEventKind, { color: string; Icon: typeof PaperPlaneTilt }> = {
  scheduled:    { color: "var(--agent-text-muted)", Icon: CalendarBlank },
  auto_chase:   { color: "var(--agent-info)",       Icon: Robot },
  manual_chase: { color: "var(--agent-primary)",    Icon: PaperPlaneTilt },
  handed:       { color: "var(--agent-warning)",    Icon: ArrowBendDownRight },
  escalated:    { color: "var(--agent-danger)",     Icon: WarningCircle },
  snoozed:      { color: "var(--agent-text-muted)", Icon: PauseCircle },
  resolved:     { color: "var(--agent-success)",    Icon: CheckCircle },
  cancelled:    { color: "var(--agent-text-muted)", Icon: XCircle },
};

const DELIVERY_META: Record<Exclude<ChaseDelivery, null>, { label: string; color: string }> = {
  sent:      { label: "Sent",      color: "var(--agent-text-muted)" },
  delivered: { label: "Delivered", color: "var(--agent-info)" },
  opened:    { label: "Opened",    color: "var(--agent-success)" },
  bounced:   { label: "Bounced",   color: "var(--agent-danger)" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

// ── chips ──────────────────────────────────────────────────────────────────
function StateChip({ state }: { state: ChaseThreadState }) {
  return <Pill glass dot size="sm" tone={STATE_TONE[state]}>{STATE_META[state].label}</Pill>;
}

function ChaseCountBadge({ auto, you }: { auto: number; you: number }) {
  if (auto <= 0 && you <= 0) return null;
  const label = auto > 0 && you > 0 ? `Auto ${auto}× · you ${you}×` : auto > 0 ? `Auto ${auto}×` : `You ${you}×`;
  return <span style={{ fontSize: 11, color: "var(--agent-text-muted)", fontWeight: 500 }}>{label}</span>;
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
  return (
    <div style={{
      flex: "1 1 120px", minWidth: 120, padding: "12px 16px", borderRadius: 14,
      background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-subtle)",
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
  return (
    <button
      onClick={onSelect}
      className="w-full text-left transition-colors"
      style={{
        padding: "10px 12px", borderRadius: 12, display: "block",
        background: selected ? `rgba(${m.rgb}, 0.08)` : "transparent",
        borderLeft: `3px solid ${selected ? m.color : "transparent"}`,
        outline: selected ? "0.5px solid var(--agent-border-default)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: sideColor, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {thread.title}
        </span>
        <StateChip state={thread.state} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 14 }}>
        <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{thread.trackLabel}</span>
        <ChaseCountBadge auto={thread.autoChases} you={thread.manualChases} />
        <span style={{ marginLeft: "auto", fontSize: 11, color: m.color, fontWeight: 600 }}>{nextLabel(thread)}</span>
      </div>
    </button>
  );
}

function nextLabel(t: ChaseThread): string {
  if (t.state === "completed") return "Done";
  if (t.state === "cancelled") return "Stopped";
  if (t.state === "escalated") return "Urgent";
  if (t.snoozedUntil) return `Paused to ${fmtDate(t.snoozedUntil)}`;
  if (t.nextDueAt) return `${t.nextIsAutomated ? "Auto" : "Chase"} ${fmtDate(t.nextDueAt)}`;
  return "";
}

// ── detail: one event row ────────────────────────────────────────────────────
function EventRow({ ev, last }: { ev: ChaseThreadEvent; last: boolean }) {
  const m = EVENT_META[ev.kind];
  const dm = ev.delivery ? DELIVERY_META[ev.delivery] : null;
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--agent-surface-elevated)", border: `1.5px solid ${m.color}` }}>
          <m.Icon size={15} weight="bold" color={m.color} />
        </div>
        {!last && <div style={{ width: 2, flex: 1, minHeight: 18, background: "var(--agent-border-subtle)", marginTop: 2 }} />}
      </div>
      <div style={{ flex: 1, paddingBottom: last ? 0 : 18, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>{ev.title}</span>
          <span style={{ fontSize: 11, color: "var(--agent-text-muted)", marginLeft: "auto", whiteSpace: "nowrap" }}>{fmtDateTime(ev.at)}</span>
        </div>
        {ev.detail && <p style={{ fontSize: 12, color: "var(--agent-text-secondary)", margin: "2px 0 0", lineHeight: 1.4 }}>{ev.detail}</p>}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
          {ev.actor && <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{ev.actor}</span>}
          {dm && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: dm.color }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: dm.color }} />{dm.label}
            </span>
          )}
        </div>
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
    sub: thread.track === "enquiry" ? "on a cadence" : "up to 2 emails",
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
    sub: thread.escalated ? "notified" : "if it stalls",
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)", marginBottom: 8 }}>{children}</div>;
}

// ── detail: one "Up next" send card (glossy, per recipient lane) ─────────────
function UpNextCard({ send, transactionId }: { send: NextSend; transactionId: string }) {
  const isSol = send.lane === "solicitor";
  const accent = isSol ? "#0E8C86" : "var(--agent-info)";
  const whenLabel = send.dueAt ? fmtDate(send.dueAt) : send.handedToTeam ? "With your team" : "Scheduled";
  const kicker = send.handedToTeam
    ? "Auto-chase done"
    : send.isAutomated ? `Auto · chase ${send.chaseNumber} of ${send.capOf}` : `Reminder · chase ${send.chaseNumber} of ${send.capOf}`;
  return (
    <div className="chase-upnext-card" style={{
      position: "relative", overflow: "hidden", borderRadius: 14, padding: "13px 14px",
      background: "var(--agent-surface-nested, var(--agent-surface-elevated))", border: "0.5px solid var(--agent-border-subtle)",
    }}>
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent }} aria-hidden />
      <Pill glass dot size="sm" tone={isSol ? "brand" : "info"}>{send.recipientLabel}</Pill>
      <div style={{ fontSize: 22, fontWeight: 780, letterSpacing: "-0.02em", margin: "9px 0 1px", color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{whenLabel}</div>
      <div style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>{kicker}</div>
      {send.overrideTarget && !send.handedToTeam && (
        <NextChaseControl transactionId={transactionId} target={send.overrideTarget} edited={send.edited} skipped={send.skipped} />
      )}
    </div>
  );
}

// ── detail: a future (predicted) node for the unified timeline ────────────────
function FutureRow({ send }: { send: NextSend }) {
  const isSol = send.lane === "solicitor";
  const accent = isSol ? "#0E8C86" : "var(--agent-info)";
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--agent-surface-elevated)", border: `1.5px dashed ${accent}` }}>
          <PaperPlaneTilt size={14} weight="bold" color={accent} />
        </div>
        <div style={{ width: 2, flex: 1, minHeight: 18, background: "var(--agent-border-subtle)", marginTop: 2 }} />
      </div>
      <div style={{ flex: 1, paddingBottom: 18, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-secondary)" }}>
            {send.handedToTeam ? `${send.recipientLabel} — with your team` : `Next: chase ${send.recipientLabel}`}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: accent, padding: "1px 6px", borderRadius: 6, background: isSol ? "rgba(14,140,134,0.12)" : "rgba(var(--agent-info-rgb),0.12)" }}>Upcoming</span>
          {send.dueAt && <span style={{ fontSize: 11, color: "var(--agent-text-muted)", marginLeft: "auto", whiteSpace: "nowrap" }}>{fmtDate(send.dueAt)}</span>}
        </div>
        <p style={{ fontSize: 12, color: "var(--agent-text-muted)", margin: "2px 0 0", lineHeight: 1.4 }}>
          {send.isAutomated ? "Autopilot will send this automatically." : "A reminder for your team to send."}
        </p>
      </div>
    </div>
  );
}

// ── detail pane ──────────────────────────────────────────────────────────────
function ThreadDetail({ thread, transactionId }: { thread: ChaseThread; transactionId: string }) {
  const isExchange = thread.track === "exchange";
  // Future nodes lead the timeline (soonest first), then the past events.
  const futureSends = [...thread.nextSends].sort((a, b) => {
    const at = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const bt = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    return at - bt;
  });
  const subtitle = isExchange
    ? `${thread.autoChases} email${thread.autoChases === 1 ? "" : "s"} today · started ${fmtDate(thread.startedAt)}`
    : `Waiting on ${thread.waitingOn} · ${thread.autoChases} chase${thread.autoChases === 1 ? "" : "s"} sent${thread.manualChases ? ` (${thread.manualChases} by you)` : ""} · since ${fmtDate(thread.startedAt)}`;

  return (
    <div>
      <style>{`.chase-upnext-card{transition:transform .16s cubic-bezier(0.22,1,0.36,1),box-shadow .16s ease}
        .chase-upnext-card:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(15,23,42,0.06)}
        @media (prefers-reduced-motion:reduce){.chase-upnext-card{transition:none}}`}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)", margin: 0 }}>{thread.title}</h3>
        <StateChip state={thread.state} />
      </div>
      <p style={{ fontSize: 12.5, color: "var(--agent-text-secondary)", margin: "0 0 18px" }}>{subtitle}</p>

      {/* Up next — one card per recipient lane (buyer + solicitor) */}
      {futureSends.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionLabel>Up next</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: futureSends.length > 1 ? "1fr 1fr" : "1fr", gap: 12 }}>
            {futureSends.map((s, i) => <UpNextCard key={i} send={s} transactionId={transactionId} />)}
          </div>
        </div>
      )}

      {/* Timeline — upcoming (dashed) flowing into what's happened */}
      <div style={{ marginBottom: isExchange ? 0 : 22 }}>
        <SectionLabel>Timeline</SectionLabel>
        <div>
          {futureSends.map((s, i) => <FutureRow key={`f${i}`} send={s} />)}
          {thread.events.map((ev, i) => (
            <EventRow key={i} ev={ev} last={i === thread.events.length - 1} />
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
  const selected = useMemo(() => threads.find((t) => t.id === selectedId) ?? threads[0], [threads, selectedId]);

  return (
    <div data-tour="chase-threads" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {pause && <PauseBanner pause={pause} />}

      {/* Overview stats */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatCard n={stats.active} label="Active chases" color="var(--agent-text-primary)" />
        <StatCard n={stats.dueToday} label="Due today" color="var(--agent-warning)" />
        <StatCard n={stats.escalating} label="Escalating" color="var(--agent-danger)" />
        <StatCard n={stats.completed} label="Completed" color="var(--agent-success)" />
      </div>

      {/* List + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr]" style={{ gap: 16, alignItems: "start" }}>
        {/* Left: thread list */}
        <div style={{ borderRadius: 16, background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-subtle)", padding: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)", padding: "6px 8px 8px" }}>
            Chase threads
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {active.map((t) => (
              <ThreadCard key={t.id} thread={t} selected={t.id === selected?.id} onSelect={() => setSelectedId(t.id)} />
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
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {done.map((t) => (
                    <ThreadCard key={t.id} thread={t} selected={t.id === selected?.id} onSelect={() => setSelectedId(t.id)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: detail */}
        <div style={{ borderRadius: 16, background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-subtle)", padding: "18px 20px", minHeight: 200 }}>
          {selected ? <ThreadDetail thread={selected} transactionId={transactionId} /> : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, gap: 8, color: "var(--agent-text-muted)" }}>
              <Clock size={16} /> <span style={{ fontSize: 13 }}>Select a thread to see its history.</span>
            </div>
          )}
        </div>
      </div>

      <p style={{ fontSize: 11, color: "var(--agent-text-muted)", textAlign: "center" }}>
        All times UK. Delivery signals are best-effort. Client auto-chases show delivery, not opens.
      </p>
    </div>
  );
}
