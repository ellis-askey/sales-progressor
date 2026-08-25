"use client";

// Chase Timeline — the read-only "live map" of everything the file is trying to
// get from other people. Left: scannable thread list. Right: progressive-
// disclosure detail (history + escalation path) for the selected thread.
// Client + manual tracks (v1). See docs/active/chase-timeline-SPEC.md.

import { useMemo, useState } from "react";
import {
  CalendarBlank, PaperPlaneTilt, Robot, User, WarningCircle, CheckCircle,
  PauseCircle, XCircle, ArrowBendDownRight, Clock, ArrowRight,
} from "@phosphor-icons/react";
import type {
  ChaseThread, ChaseThreadState, ChaseTimelineStats, ChaseThreadEvent, ChaseEventKind, ChaseDelivery,
} from "@/lib/services/chase-timeline";

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
  const m = STATE_META[state];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 700, letterSpacing: "0.02em",
      padding: "2px 8px", borderRadius: 999, color: m.color, background: `rgba(${m.rgb}, 0.12)`,
      whiteSpace: "nowrap",
    }}>{m.label}</span>
  );
}

function ChaseCountBadge({ auto, you }: { auto: number; you: number }) {
  if (auto <= 0 && you <= 0) return null;
  const label = auto > 0 && you > 0 ? `Auto ${auto}× · you ${you}×` : auto > 0 ? `Auto ${auto}×` : `You ${you}×`;
  return <span style={{ fontSize: 11, color: "var(--agent-text-muted)", fontWeight: 500 }}>{label}</span>;
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", borderTop: "0.5px solid var(--agent-border-subtle)" }}>
      <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ── detail pane ──────────────────────────────────────────────────────────────
function ThreadDetail({ thread }: { thread: ChaseThread }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)", margin: 0 }}>{thread.title}</h3>
        <StateChip state={thread.state} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 12, color: "var(--agent-text-secondary)", marginBottom: 18 }}>
        {thread.track === "exchange" ? (
          <>
            <span><b style={{ color: "var(--agent-text-muted)", fontWeight: 600 }}>Emails today:</b> {thread.autoChases}</span>
            <span><b style={{ color: "var(--agent-text-muted)", fontWeight: 600 }}>Started:</b> {fmtDate(thread.startedAt)}</span>
          </>
        ) : (
          <>
            <span><b style={{ color: "var(--agent-text-muted)", fontWeight: 600 }}>Waiting on:</b> {thread.waitingOn}</span>
            <span><b style={{ color: "var(--agent-text-muted)", fontWeight: 600 }}>Chased:</b> {thread.autoChases} auto{thread.manualChases ? ` · ${thread.manualChases} by you` : ""}</span>
            <span><b style={{ color: "var(--agent-text-muted)", fontWeight: 600 }}>Started:</b> {fmtDate(thread.startedAt)}</span>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_240px]" style={{ gap: 24 }}>
        {/* events */}
        <div>
          <SectionLabel>History</SectionLabel>
          <div>
            {thread.events.map((ev, i) => (
              <EventRow key={i} ev={ev} last={i === thread.events.length - 1} />
            ))}
          </div>
        </div>
        {/* details + escalation */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <SectionLabel>Details</SectionLabel>
            {thread.track === "exchange" ? (
              <>
                <DetailRow label="Who we're waiting on" value={thread.waitingOn} />
                <DetailRow label="Emails sent today" value={String(thread.autoChases)} />
                <DetailRow label="Last email" value={thread.lastChasedAt ? fmtDate(thread.lastChasedAt) : "-"} />
                <DetailRow label="Status" value={STATE_META[thread.state].label} />
              </>
            ) : (
              <>
                <DetailRow label="Who we're waiting on" value={thread.waitingOn} />
                <DetailRow label="Last chased" value={thread.lastChasedAt ? fmtDate(thread.lastChasedAt) : "-"} />
                <DetailRow label={thread.nextIsAutomated ? "Next auto-chase" : "Next (reminder)"} value={thread.nextDueAt ? fmtDate(thread.nextDueAt) : "-"} />
                <DetailRow label="Escalates after" value={thread.track === "enquiry" ? "if it stalls" : `${thread.escalatesAfter} of your chases`} />
              </>
            )}
          </div>
          {thread.track !== "exchange" && <EscalationPath thread={thread} />}
        </div>
      </div>
    </div>
  );
}

// ── root ─────────────────────────────────────────────────────────────────────
export function ChaseTimeline({ stats, threads }: { stats: ChaseTimelineStats; threads: ChaseThread[] }) {
  const activeStates: ChaseThreadState[] = ["escalated", "manual_chasing", "handed_to_team", "auto_chasing", "scheduled", "snoozed"];
  const active = threads.filter((t) => activeStates.includes(t.state));
  const done = threads.filter((t) => t.state === "completed" || t.state === "cancelled");

  const [selectedId, setSelectedId] = useState<string>(threads[0]?.id ?? "");
  const [showDone, setShowDone] = useState(false);
  const selected = useMemo(() => threads.find((t) => t.id === selectedId) ?? threads[0], [threads, selectedId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          {selected ? <ThreadDetail thread={selected} /> : (
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
