"use client";
/* Polish reference for /agent/to-do — Stage 2.
 * Visual target for Stage 4 production swap.
 *
 * AddManualTaskForm: agent-reveal-in on open.
 * Ownership toggle in form: agent-segment-pill pair (not the inline bg-white/40 pattern).
 * Done sections: agent-acc / agent-acc-in (200ms open / 150ms close from canonical class).
 * Done toggle: agent-link-muted + CaretDown spin.
 * Ghost: abstract agent-skeleton bars only, opacity 0.35 — no fake addresses or task text.
 * Loading: section-shape skeletons + single collapsed pill for form.
 *
 * Voice pre-corrections (Stage 3 approves, Stage 4 applies to AgentTodoList.tsx):
 *   "Sales Progressor" → "Your progressor"           (ownership toggle, Rule 2)
 *   "Use the button above…" → "Add a task or…"       (own empty state, Rule 1)
 *   "Show N resolved" / "Hide resolved"
 *     → "Show N completed" / "Hide completed"        (done toggle, Rule 2 adjacent)
 *   aria-label="Mark as open" → "Reopen"             (task circle, Rule 2)
 *
 * Token corrections (Stage 4 applies to AgentTodoList.tsx production code):
 *   rgba(37,99,235,0.08/0.20) → var(--agent-info-bg/--agent-info-border)   own-tasks count badge
 *   #2563eb                   → var(--agent-info)                           own-tasks count badge text
 *   rgba(37,99,235,0.40)      → var(--agent-info-border)                   own-tasks circle border
 *   rgba(255,255,255,0.35)    → var(--agent-border-subtle)                 TaskGroup header border
 *   rgba(255,255,255,0.25)    → var(--agent-border-subtle)                 TaskRow internal border
 *   rgba(180,87,9,0.06)       → var(--agent-warning-bg)                    progressor note bg
 *   rgba(180,87,9,0.28)       → var(--agent-warning-border)                progressor note left border
 *   #b45309                   → var(--agent-warning)                        progressor note body text
 *   rgba(180,87,9,0.65)       → rgba(var(--agent-warning-rgb), 0.65)       progressor note label
 *   #dc2626                   → var(--agent-danger)                         overdue > 4 days label
 */

import { useState, useEffect } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";
import { toUKDateStr } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type MockTask = {
  id: string;
  transactionId: string | null;
  address: string | null;
  title: string;
  notes: string | null;
  dueDate: Date | null;
  progressorNote: string | null;
  progressorNoteAt: Date | null;
  isDone: boolean;
  isProgressor: boolean;
};

type Group = { transactionId: string | null; address: string | null; tasks: MockTask[] };

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getDueStatus(dueDate: Date): { label: string; color: string; reassure: boolean } {
  const todayStr = toUKDateStr(new Date());
  const dueStr = toUKDateStr(dueDate);
  const diff = Math.round((new Date(todayStr).getTime() - new Date(dueStr).getTime()) / 86400000);
  if (diff < 0) {
    if (diff === -1) return { label: "Due tomorrow",    color: "var(--agent-text-muted)", reassure: false };
    return              { label: `Due ${fmtDate(dueDate)}`, color: "var(--agent-text-muted)", reassure: false };
  }
  if (diff === 0) return { label: "Due today",          color: "var(--agent-warning)", reassure: true  };
  if (diff === 1) return { label: "Due yesterday",      color: "var(--agent-warning)", reassure: true  };
  if (diff <= 3)  return { label: "Overdue",            color: "var(--agent-warning)", reassure: true  };
  return                 { label: `Overdue · ${diff} days`, color: "var(--agent-danger)", reassure: false };
}

function groupByTx(tasks: MockTask[]): Group[] {
  const map = new Map<string | null, MockTask[]>();
  for (const t of tasks) {
    const key = t.transactionId;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  const out: Group[] = [];
  for (const [txId, txTasks] of map.entries()) {
    out.push({ transactionId: txId, address: txTasks[0].address, tasks: txTasks });
  }
  return out.sort((a, b) => {
    if (a.transactionId === null) return 1;
    if (b.transactionId === null) return -1;
    return 0;
  });
}

/* ─── Mock data ───────────────────────────────────────────────────────────── */

const OVERDUE_4D  = new Date(Date.now() - 4 * 86400000);
const OVERDUE_2D  = new Date(Date.now() - 2 * 86400000);
const TOMORROW    = new Date(Date.now() + 1 * 86400000);
const IN_3D       = new Date(Date.now() + 3 * 86400000);
const PROG_NOTE   = new Date(Date.now() - 2 * 3600000);
const CREATED_OLD = new Date(Date.now() - 8 * 86400000);

const ALL_TASKS: MockTask[] = [
  /* ── My to-dos — open ─────────────────────────────────────────────── */
  {
    id: "t1", transactionId: "tx1", isDone: false, isProgressor: false,
    address:  "14 Birchwood Lane, Guildford, Surrey",
    title:    "Request updated search results from purchaser's solicitor",
    notes:    null, dueDate: OVERDUE_4D, progressorNote: null, progressorNoteAt: null,
  },
  {
    id: "t2", transactionId: "tx1", isDone: false, isProgressor: false,
    address:  "14 Birchwood Lane, Guildford, Surrey",
    title:    "Confirm mortgage offer copy received",
    notes:    null, dueDate: OVERDUE_2D, progressorNote: null, progressorNoteAt: null,
  },
  {
    id: "t3", transactionId: "tx2", isDone: false, isProgressor: false,
    address:  "22 Clifton Park, Bristol, BS8 3HJ",
    title:    "Chase vendor solicitor on replies to enquiries",
    notes:    "Sent initial email last week — no reply.",
    dueDate:  IN_3D, progressorNote: null, progressorNoteAt: null,
  },
  {
    id: "t4", transactionId: null, isDone: false, isProgressor: false,
    address:  null,
    title:    "Update CRM with latest chain status",
    notes:    null, dueDate: TOMORROW, progressorNote: null, progressorNoteAt: null,
  },
  /* ── My to-dos — done ─────────────────────────────────────────────── */
  {
    id: "t5", transactionId: "tx1", isDone: true, isProgressor: false,
    address:  "14 Birchwood Lane, Guildford, Surrey",
    title:    "Send memorandum of sale to both solicitors",
    notes:    null, dueDate: null, progressorNote: null, progressorNoteAt: null,
  },
  /* ── With your progressor — open ──────────────────────────────────── */
  {
    id: "p1", transactionId: "tx1", isDone: false, isProgressor: true,
    address:  "14 Birchwood Lane, Guildford, Surrey",
    title:    "Can you chase the vendor's solicitor on Part 1 enquiry replies?",
    notes:    "Been waiting 10 days — client is getting anxious.",
    dueDate:  null,
    progressorNote:   "I've left a voicemail and sent a follow-up email — chasing daily.",
    progressorNoteAt: PROG_NOTE,
  },
];

type ThemeName = "sunset" | "coastal" | "heritage" | "slate" | "emerald" | "claret";
const THEME_NAMES: ThemeName[] = ["sunset", "coastal", "heritage", "slate", "emerald", "claret"];

type ViewState  = "populated" | "empty" | "loading";

/* ─── Page-level CSS ─────────────────────────────────────────────────────── */

const CSS = `
  /* ── pp-controls (test-page chrome only — not production) ─────────── */
  .pp-bar { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin: 0; }
  .pp-bar-label { font-size: 11px; color: rgba(30,45,74,.45); font-family: monospace; white-space: nowrap; }
  .pp-pill { padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(30,45,74,.15);
    font-size: 11px; font-weight: 500; cursor: pointer; background: white; color: rgba(30,45,74,.55);
    transition: all 120ms; }
  .pp-pill.on { background: #1E2D4A; color: white; border-color: #1E2D4A; }

  /* ── Reduced motion ───────────────────────────────────────────────── */
  [data-rm="1"] *, [data-rm="1"] *::before, [data-rm="1"] *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0ms !important;
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }
  [data-rm="1"] .agent-acc,
  [data-rm="1"] .agent-acc.open {
    transition: none !important;
  }
`;

/* ─── Main page ───────────────────────────────────────────────────────────── */

export default function TodoPolishPage() {
  const [viewState, setViewState]       = useState<ViewState>("populated");
  const [showProg, setShowProg]         = useState(true);
  const [openDoneMine, setOpenDoneMine] = useState(false);
  const [openDoneProg, setOpenDoneProg] = useState(false);
  const [theme, setTheme]               = useState<ThemeName>("sunset");
  const [night, setNight]               = useState(false);
  const [rm, setRm]                     = useState(false);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".agent-shell-root");
    if (!shell) return;
    if (night) shell.setAttribute("data-night", "");
    else shell.removeAttribute("data-night");
    return () => { shell.removeAttribute("data-night"); };
  }, [night]);

  const mineTasks  = ALL_TASKS.filter((t) => !t.isProgressor);
  const progTasks  = ALL_TASKS.filter((t) =>  t.isProgressor);

  const mineOpen   = mineTasks.filter((t) => !t.isDone);
  const mineDone   = mineTasks.filter((t) =>  t.isDone);
  const progOpen   = progTasks.filter((t) => !t.isDone);
  const progDone   = progTasks.filter((t) =>  t.isDone);

  const todayStr = toUKDateStr(new Date());
  const today = new Date(todayStr); // mock-data prop pass-through (UK midnight as Date)
  const overdueOpen = mineOpen.filter((t) => t.dueDate && toUKDateStr(t.dueDate) < todayStr);

  /* ── Stat pills (matches page.tsx logic) ──────────────────────────── */
  const statPills = viewState === "populated" ? [
    mineOpen.length > 0 && { key: "mine",    label: `${mineOpen.length} to-do${mineOpen.length === 1 ? "" : "s"}`, color: "var(--agent-text-muted)",   bg: "rgba(var(--agent-shadow-rgb), 0.06)", border: "var(--agent-border-default)" },
    (showProg && progOpen.length > 0) && { key: "prog", label: `${progOpen.length} with progressor`, color: "var(--agent-warning)", bg: "var(--agent-warning-bg)", border: "var(--agent-warning-border)" },
    overdueOpen.length > 0 && { key: "over", label: `${overdueOpen.length} overdue`, color: "var(--agent-danger)", bg: "var(--agent-danger-bg)", border: "var(--agent-danger-border)" },
  ].filter(Boolean) as { key: string; label: string; color: string; bg: string; border: string }[] : [];

  return (
    <>
      <style>{CSS}</style>

      {/* ── pp-controls (test chrome — outside agent-bg) ─────────────── */}
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid rgba(30,45,74,0.08)",
        background: "rgba(30,45,74,0.03)",
        display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap",
      }}>
        <span className="pp-bar-label" style={{ fontWeight: 600 }}>to-do — Stage 2</span>
        <div className="pp-bar">
          <span className="pp-bar-label">state</span>
          {(["populated", "empty", "loading"] as ViewState[]).map((s) => (
            <button key={s} type="button" className={`pp-pill${viewState === s ? " on" : ""}`} onClick={() => setViewState(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="pp-bar">
          <span className="pp-bar-label">view</span>
          <button type="button" className={`pp-pill${showProg ? " on" : ""}`} onClick={() => setShowProg(true)}>both sections</button>
          <button type="button" className={`pp-pill${!showProg ? " on" : ""}`} onClick={() => setShowProg(false)}>mine only</button>
        </div>
        <div className="pp-bar">
          <span className="pp-bar-label">theme</span>
          {THEME_NAMES.map((t) => (
            <button key={t} type="button" className={`pp-pill${theme === t ? " on" : ""}`} onClick={() => setTheme(t)}>{t}</button>
          ))}
        </div>
        <div className="pp-bar">
          <span className="pp-bar-label">opts</span>
          <button type="button" className={`pp-pill${night ? " on" : ""}`} onClick={() => setNight((v) => !v)}>night</button>
          <button type="button" className={`pp-pill${rm ? " on" : ""}`} onClick={() => setRm((v) => !v)}>rm</button>
        </div>
      </div>

      {/* ── Production content — theme-scoped ─────────────────────────── */}
      <div className="agent-bg" data-theme={theme} data-rm={rm ? "1" : undefined}>

        <PageHeader title="To-Do" subtitle="Your notes, plus anything you've flagged to your progressor.">
          {statPills.map((p) => (
            <span
              key={p.key}
              style={{
                display: "inline-flex", alignItems: "center",
                padding: "3px 10px", borderRadius: 20,
                fontSize: 11, fontWeight: 600,
                color: p.color,
                background: p.bg,
                border: `1px solid ${p.border}`,
              }}
            >
              {p.label}
            </span>
          ))}
        </PageHeader>

        <div className="px-4 md:px-8 py-2 md:py-4" style={{ maxWidth: 680 }}>

          {/* ── Loading ────────────────────────────────────────────────── */}
          {viewState === "loading" && <TodoSkeleton />}

          {/* ── Empty ──────────────────────────────────────────────────── */}
          {viewState === "empty" && (
            <div className="space-y-8">
              {/* Form — collapsed (skeleton of the pill) */}
              <AddFormMock rm={rm} />

              {/* Empty state card */}
              <div className="glass-card" style={{ padding: "48px 24px", textAlign: "center" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--agent-text-muted)" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 16px", display: "block", opacity: 0.45 }}>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                  Nothing here yet.
                </p>
                <p style={{ margin: "0 auto", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 340, lineHeight: 1.5 }}>
                  Add a task or send your progressor a request.
                </p>
              </div>

              {/* Abstract ghost — skeleton bars only, no fake content */}
              <TodoGhost />
            </div>
          )}

          {/* ── Populated ──────────────────────────────────────────────── */}
          {viewState === "populated" && (
            <div className="space-y-8">
              <AddFormMock rm={rm} />

              {/* My to-dos */}
              <TodoSection
                id="section-mine"
                title="My to-dos"
                openGroups={groupByTx(mineOpen)}
                doneGroups={groupByTx(mineDone)}
                doneCount={mineDone.length}
                showDone={openDoneMine}
                onToggleDone={() => setOpenDoneMine((v) => !v)}
                today={today}
                rm={rm}
              />

              {/* With your progressor */}
              {showProg && progTasks.length > 0 && (
                <TodoSection
                  id="section-progressor"
                  title="With your progressor"
                  openGroups={groupByTx(progOpen)}
                  doneGroups={groupByTx(progDone)}
                  doneCount={progDone.length}
                  showDone={openDoneProg}
                  onToggleDone={() => setOpenDoneProg((v) => !v)}
                  today={today}
                  progressor
                  rm={rm}
                />
              )}
            </div>
          )}

        </div>

        {/* ── Mobile 375px frame ─────────────────────────────────────── */}
        <div style={{
          borderTop: "1px solid rgba(30,45,74,0.08)",
          marginTop: 8,
          padding: "20px 16px 32px",
        }}>
          <p className="pp-bar-label" style={{ fontWeight: 600, marginBottom: 12 }}>Mobile — 375px</p>
          <div style={{
            width: 375, maxWidth: "100%",
            border: "1px solid rgba(30,45,74,0.12)",
            borderRadius: 12, overflow: "hidden",
          }}>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 24 }}>
              {viewState === "loading" && <TodoSkeleton />}
              {viewState === "empty" && (
                <>
                  <AddFormMock rm={rm} />
                  <TodoGhost />
                </>
              )}
              {viewState === "populated" && (
                <>
                  <AddFormMock rm={rm} />
                  <TodoSection
                    id="m-section-mine"
                    title="My to-dos"
                    openGroups={groupByTx(mineOpen)}
                    doneGroups={groupByTx(mineDone)}
                    doneCount={mineDone.length}
                    showDone={openDoneMine}
                    onToggleDone={() => setOpenDoneMine((v) => !v)}
                    today={today}
                    rm={rm}
                  />
                  {showProg && progTasks.length > 0 && (
                    <TodoSection
                      id="m-section-progressor"
                      title="With your progressor"
                      openGroups={groupByTx(progOpen)}
                      doneGroups={groupByTx(progDone)}
                      doneCount={progDone.length}
                      showDone={openDoneProg}
                      onToggleDone={() => setOpenDoneProg((v) => !v)}
                      today={today}
                      progressor
                      rm={rm}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>

      </div>{/* /agent-bg */}
    </>
  );
}

/* ─── AddFormMock ─────────────────────────────────────────────────────────── */
/* Mirrors AddManualTaskForm.tsx structure with:
 *   - agent-reveal-in animation on form open
 *   - agent-segment-pill for ownership toggle (Stage 4: replace inline bg-white/40 pattern)
 *   - "Your progressor" label (Stage 3 voice fix: "Sales Progressor" → "Your progressor") */

function AddFormMock({ rm }: { rm: boolean }) {
  const [open, setOpen]     = useState(false);
  const [owner, setOwner]   = useState<"mine" | "progressor">("mine");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add to-do
      </button>
    );
  }

  return (
    <div className={`glass-card p-4 space-y-3${rm ? "" : " agent-reveal-in"}`}>
      <input
        autoFocus
        type="text"
        placeholder="What needs to be done?"
        className="w-full text-base text-slate-900/80 placeholder:text-slate-900/30 border-0 outline-none bg-transparent font-medium"
      />
      <textarea
        placeholder="Notes (optional)"
        rows={2}
        className="w-full text-base text-slate-900/50 placeholder:text-slate-900/30 border-0 outline-none bg-transparent resize-none"
      />
      {/* Ownership toggle — agent-segment-pill (production fix: replace inline bg-white/40) */}
      <div>
        <p style={{ fontSize: 11, color: "var(--agent-text-muted)", marginBottom: 8 }}>Who&apos;s responsible?</p>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className={`agent-segment-pill agent-segment-pill-sm${owner === "mine" ? " on" : ""}`}
            onClick={() => setOwner("mine")}
          >
            Mine
          </button>
          <button
            type="button"
            className={`agent-segment-pill agent-segment-pill-sm${owner === "progressor" ? " on" : ""}`}
            onClick={() => setOwner("progressor")}
          >
            Your progressor
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1 border-t border-white/20">
        <input
          type="date"
          className="text-base text-slate-900/50 border-0 outline-none bg-transparent"
        />
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="agent-link agent-link-muted"
          style={{ fontSize: 11 }}
        >
          Cancel
        </button>
        <button type="button" className="agent-btn agent-btn-sm agent-btn-primary">
          Add
        </button>
      </div>
    </div>
  );
}

/* ─── TodoSection ─────────────────────────────────────────────────────────── */

function TodoSection({
  id, title, openGroups, doneGroups, doneCount, showDone, onToggleDone,
  today, progressor = false, rm,
}: {
  id: string;
  title: string;
  openGroups: Group[];
  doneGroups: Group[];
  doneCount: number;
  showDone: boolean;
  onToggleDone: () => void;
  today: Date;
  progressor?: boolean;
  rm: boolean;
}) {
  const openCount = openGroups.reduce((n, g) => n + g.tasks.length, 0);
  const hasOpen   = openGroups.length > 0;

  /* For overdue sub-group (mine only) — groups split at task level then regrouped */
  const overdueGroups  = !progressor ? openGroups.filter((g) => g.tasks.some((t) => t.dueDate && new Date(t.dueDate) < today)) : [];
  const upcomingGroups = !progressor
    ? openGroups.filter((g) => g.tasks.some((t) => !t.dueDate || new Date(t.dueDate) >= today))
    : openGroups;

  return (
    <div id={id} className="space-y-3">
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px" }}>
        {progressor && (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--agent-warning)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )}
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>
          {title}
        </h2>
        {openCount > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 20,
            /* Token fix: rgba(37,99,235,0.08) → var(--agent-info-bg); #2563eb → var(--agent-info); rgba(37,99,235,0.20) → var(--agent-info-border) */
            background: progressor ? "var(--agent-warning-bg)"  : "var(--agent-info-bg)",
            color:      progressor ? "var(--agent-warning)"      : "var(--agent-info)",
            border:     `1px solid ${progressor ? "var(--agent-warning-border)" : "var(--agent-info-border)"}`,
          }}>
            {openCount}
          </span>
        )}
      </div>

      {/* Overdue sub-group (mine only) — left-border accent, no floating label */}
      {overdueGroups.length > 0 && (
        <div style={{ marginBottom: upcomingGroups.length > 0 ? 8 : 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {overdueGroups.map((g) => (
            <TaskGroupCard key={g.transactionId ?? "_general"} group={g} today={today} progressor={false} overdue />
          ))}
        </div>
      )}

      {/* Open / upcoming groups */}
      {!hasOpen ? (
        <div className="glass-card" style={{ padding: "28px 20px", textAlign: "center" }}>
          {progressor ? (
            <>
              {/* Voice fix: "No pending requests." → "All caught up." (Stage 3) */}
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-muted)" }}>All caught up.</p>
              {/* Stage 3: body omitted — done toggle below carries orientation. Null-fallback omission per comms A4 / completions A5. */}
              {/* Stage 4 structural change: remove conditional render of body <p> entirely from AgentTodoList.tsx */}
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-muted)" }}>All clear.</p>
              {/* Stage 3: body omitted — form button + heading + done toggle carry orientation. Null-fallback omission per comms A4 / completions A5. */}
              {/* Stage 4 structural change: remove conditional render of body <p> entirely from AgentTodoList.tsx */}
            </>
          )}
        </div>
      ) : upcomingGroups.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {upcomingGroups.map((g) => (
            <TaskGroupCard key={g.transactionId ?? "_general"} group={g} today={today} progressor={progressor} />
          ))}
        </div>
      ) : null}

      {/* Done toggle + accordion */}
      {doneCount > 0 && (
        <div style={{ marginTop: 16 }}>
          {/* Voice fix: "Show N resolved" / "Hide resolved" → "Show N completed" / "Hide completed" */}
          <button
            type="button"
            onClick={onToggleDone}
            className="agent-link agent-link-muted"
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}
          >
            {showDone ? "Hide completed" : `Show ${doneCount} completed`}
            <CaretDown style={{
              width: 12, height: 12, flexShrink: 0,
              transition: "transform 200ms",
              transform: showDone ? "rotate(180deg)" : "rotate(0deg)",
            }} />
          </button>

          <div
            className={`agent-acc${showDone ? " open" : ""}`}
            style={rm ? { transition: "none" } : undefined}
          >
            <div className="agent-acc-in">
              <div style={{ paddingTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                {doneGroups.map((g) => (
                  <TaskGroupCard key={g.transactionId ?? "_general"} group={g} today={today} progressor={progressor} dimmed />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── TaskGroupCard ───────────────────────────────────────────────────────── */

function TaskGroupCard({ group, today, progressor, dimmed = false, overdue = false }: {
  group: Group;
  today: Date;
  progressor: boolean;
  dimmed?: boolean;
  overdue?: boolean;
}) {
  return (
    <div
      className="glass-card"
      style={{
        overflow: "hidden",
        opacity: dimmed ? 0.7 : 1,
        /* Overdue accent: inset shadow avoids layout shift and preserves border-radius */
        boxShadow: overdue ? "inset 3px 0 0 var(--agent-danger)" : undefined,
      }}
    >
      {/* Address header */}
      <div style={{
        padding: "10px 16px",
        /* Token fix: rgba(255,255,255,0.35) → var(--agent-border-subtle) */
        borderBottom: "0.5px solid var(--agent-border-subtle)",
      }}>
        {group.transactionId ? (
          <a
            href={`/agent/transactions/${group.transactionId}`}
            style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", textDecoration: "none" }}
            className="hover:underline"
          >
            {group.address ?? "Unknown address"}
          </a>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-muted)" }}>Quick note</span>
        )}
      </div>
      <div>
        {group.tasks.map((task, i) => (
          <TaskRow
            key={task.id}
            task={task}
            hasBorder={i < group.tasks.length - 1}
            today={today}
            progressor={progressor}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── TaskRow ─────────────────────────────────────────────────────────────── */

function TaskRow({ task, hasBorder, today, progressor }: {
  task: MockTask;
  hasBorder: boolean;
  today: Date;
  progressor: boolean;
}) {
  const dueStatus = task.dueDate && !task.isDone ? getDueStatus(task.dueDate) : null;

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "12px 16px",
      /* Token fix: rgba(255,255,255,0.25) → var(--agent-border-subtle) */
      borderBottom: hasBorder ? "0.5px solid var(--agent-border-subtle)" : "none",
    }}>
      {/* Completion circle */}
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <div
          style={{
            width: 18, height: 18, borderRadius: "50%",
            /* Token fix: rgba(37,99,235,0.40) → var(--agent-info-border) for own tasks */
            border: task.isDone ? "none" : `1.5px solid ${progressor ? "var(--agent-warning)" : "var(--agent-info-border)"}`,
            background: task.isDone ? "var(--agent-success)" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {task.isDone && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 13, lineHeight: "1.4",
          fontWeight: task.isDone ? 400 : 500,
          color: task.isDone ? "var(--agent-text-muted)" : "var(--agent-text-primary)",
          textDecoration: task.isDone ? "line-through" : "none",
        }}>
          {task.title}
        </p>
        {task.notes && (
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--agent-text-muted)", lineHeight: "1.4" }}>
            {task.notes}
          </p>
        )}
        {/* Progressor note */}
        {task.progressorNote && (
          <div style={{
            marginTop: 6, padding: "6px 10px", borderRadius: 6,
            /* Token fix: rgba(180,87,9,0.06) → var(--agent-warning-bg); rgba(180,87,9,0.28) → var(--agent-warning-border) */
            background: "var(--agent-warning-bg)",
            borderLeft: "2px solid var(--agent-warning-border)",
          }}>
            <p style={{
              margin: "0 0 2px", fontSize: 10, fontWeight: 700,
              letterSpacing: "0.04em", textTransform: "uppercase",
              /* Token fix: rgba(180,87,9,0.65) → rgba(var(--agent-warning-rgb), 0.65) */
              color: "rgba(var(--agent-warning-rgb), 0.65)",
            }}>
              Your progressor{task.progressorNoteAt ? ` · ${fmtDate(task.progressorNoteAt)}` : ""}
            </p>
            {/* Token fix: #b45309 → var(--agent-warning) */}
            <p style={{ margin: 0, fontSize: 12, color: "var(--agent-warning)", lineHeight: "1.4" }}>
              {task.progressorNote}
            </p>
          </div>
        )}
      </div>

      {/* Due / created date */}
      <div style={{ flexShrink: 0, textAlign: "right", marginTop: 2 }}>
        {dueStatus ? (
          <>
            <span style={{ fontSize: 11, fontWeight: 600, color: dueStatus.color }}>
              {dueStatus.label}
            </span>
            {progressor && dueStatus.reassure && (
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--agent-text-muted)", lineHeight: 1.3 }}>
                Our team is on it
              </p>
            )}
          </>
        ) : (
          <span style={{ fontSize: 11, color: "var(--agent-text-disabled)" }}>
            {fmtDate(task.isDone ? CREATED_OLD : (task.dueDate ?? CREATED_OLD))}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Loading skeleton ────────────────────────────────────────────────────── */
/* Stage 4 transplants to app/agent/to-do/loading.tsx. */

function TodoSkeleton() {
  return (
    <div className="space-y-8">
      {/* Form pill skeleton */}
      <div className="agent-skeleton" style={{ width: 96, height: 30, borderRadius: 20 }} />

      {/* Section 1 skeleton */}
      <div className="space-y-3">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="agent-skeleton" style={{ width: 80, height: 13, borderRadius: 4 }} />
          <div className="agent-skeleton" style={{ width: 22, height: 18, borderRadius: 10 }} />
        </div>
        {/* Task group card */}
        <div className="glass-card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
            <div className="agent-skeleton" style={{ width: 180, height: 12, borderRadius: 4 }} />
          </div>
          {[200, 240, 160].map((w, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
              borderBottom: i < 2 ? "0.5px solid var(--agent-border-subtle)" : "none",
            }}>
              <div className="agent-skeleton" style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0 }} />
              <div className="agent-skeleton" style={{ flex: 1, height: 13, borderRadius: 4, maxWidth: w }} />
              <div className="agent-skeleton" style={{ width: 44, height: 11, borderRadius: 4, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Section 2 skeleton */}
      <div className="space-y-3">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="agent-skeleton" style={{ width: 16, height: 14, borderRadius: 3 }} />
          <div className="agent-skeleton" style={{ width: 140, height: 13, borderRadius: 4 }} />
          <div className="agent-skeleton" style={{ width: 22, height: 18, borderRadius: 10 }} />
        </div>
        <div className="glass-card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
            <div className="agent-skeleton" style={{ width: 160, height: 12, borderRadius: 4 }} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px" }}>
            <div className="agent-skeleton" style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="agent-skeleton" style={{ height: 13, borderRadius: 4, maxWidth: 220, marginBottom: 8 }} />
              <div className="agent-skeleton" style={{ height: 11, borderRadius: 4, maxWidth: 160 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Empty state ghost — abstract skeleton bars, no fake content ─────────── */

function TodoGhost() {
  return (
    <div style={{ opacity: 0.35, pointerEvents: "none" }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px", marginBottom: 12 }}>
        <div className="agent-skeleton" style={{ width: 72, height: 13, borderRadius: 4 }} />
        <div className="agent-skeleton" style={{ width: 22, height: 18, borderRadius: 10 }} />
      </div>
      {/* Task group card */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
          <div className="agent-skeleton" style={{ width: 148, height: 12, borderRadius: 4 }} />
        </div>
        {[180, 130].map((w, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
            borderBottom: i === 0 ? "0.5px solid var(--agent-border-subtle)" : "none",
          }}>
            <div className="agent-skeleton" style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0 }} />
            <div className="agent-skeleton" style={{ flex: 1, height: 12, borderRadius: 4, maxWidth: w }} />
            <div className="agent-skeleton" style={{ width: 36, height: 10, borderRadius: 4, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
