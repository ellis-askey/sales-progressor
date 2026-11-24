"use client";
// /dev/todo-next — founder-only redesign of /agent/to-do.
//
// A two-pane triage workspace built ENTIRELY on /dev/library foundations (no new
// glass engine). READ data is real (fetched server-side, see page.tsx). Every
// MUTATION is PREVIEW-ONLY: handlers update local state and toast "what would
// happen" — NO server action is imported or called anywhere in this route, so
// live execution is absent, not merely toggled off. (Live wiring intentionally
// not present — see the commented seam in the preview context.)

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  House, CheckCircle, Circle, CalendarBlank, PaperPlaneTilt, Note, Plus,
  ListChecks, UsersThree, CalendarCheck, ArrowSquareOut, Trash, X, Lock, MagnifyingGlass,
} from "@phosphor-icons/react";
import { ThemeCtx, Atmosphere, cn, type Theme } from "../library/lib";
import { Surface, TravellingSelection } from "../library/foundation";
import { Button, Input, Textarea, Field, DatePicker, Select, Checkbox } from "../library/controls";
import { Drawer, ConfirmDialog, ToastProvider, useToast } from "../library/overlays";
import { EmptyState } from "../library/data";
import { CONTROLS_CSS } from "../library/page";
import { FOUNDATION_CSS } from "../library/foundation";
import { OVERLAY_CSS } from "../library/overlays";
import { DATA_CSS } from "../library/data";
import { TODONEXT_CSS } from "./styles";
import {
  splitAddress, fmtDate, taskDue, reviewDue, ORIGIN_META, sortTasks, groupByTransaction,
  partition, overdueUpcoming, reviewKind, reviewDate, reviewKey, type Group,
} from "./logic";
import type { Task, ReviewItem, TodoNextData, BucketKey, DueTone } from "./types";

/* ── preview action bridge (NO server imports — preview only) ─────────────────
   This is the single place actions flow through. There is intentionally no path
   to real execution: enabling live writes would require importing the server
   actions here and is deliberately NOT done pending explicit approval. */
type Preview = {
  completeTask: (id: string) => void;
  reopenTask: (id: string) => void;
  rescheduleTask: (id: string, dateISO: string, note?: string | null) => void;
  addTask: (input: AddInput) => void;
  completeReview: (key: string) => void;
  reopenReview: (key: string) => void;
  editReview: (key: string, title: string, notes: string | null) => void;
  rescheduleReview: (key: string, dateISO: string) => void;
  removeReview: (key: string) => void;
  takeOffHold: (key: string) => void;
  extendHold: (key: string, dateISO: string | null) => void;
  previewOnly: (msg: string, tone?: "ok" | "info" | "warn") => void;
};
const PreviewCtx = createContext<Preview | null>(null);
const usePreview = () => useContext(PreviewCtx)!;

type AddInput = { title: string; notes?: string; dueDate?: string; transactionId?: string; transactionAddress?: string; isAgentRequest?: boolean; isInternalSelfAssigned?: boolean };

export function TodoNext({ data }: { data: TodoNextData }) {
  const [theme, setTheme] = useState<Theme>("dark");
  return (
    <ThemeCtx.Provider value={theme}>
      <ToastProvider>
        <div className="lg-ds tn-root" data-theme={theme}>
          <style dangerouslySetInnerHTML={{ __html: CONTROLS_CSS + FOUNDATION_CSS + OVERLAY_CSS + DATA_CSS + TODONEXT_CSS }} />
          <Atmosphere />
          <Workspace data={data} theme={theme} setTheme={setTheme} />
        </div>
      </ToastProvider>
    </ThemeCtx.Provider>
  );
}

function Workspace({ data, theme, setTheme }: { data: TodoNextData; theme: Theme; setTheme: (t: Theme) => void }) {
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[]>(data.tasks);
  const [items, setItems] = useState<ReviewItem[]>(data.reviews.items);
  const [done, setDone] = useState<ReviewItem[]>(data.reviews.done);
  const [bucket, setBucket] = useState<BucketKey>(data.isInternal ? "internal" : "mine");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [showDone, setShowDone] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const previewOnly = (msg: string, tone: "ok" | "info" | "warn" = "info") => toast({ text: `Preview · ${msg}`, tone });

  const preview: Preview = {
    previewOnly,
    completeTask: (id) => { setTasks((p) => p.map((t) => (t.id === id ? { ...t, status: "done", completedAt: new Date() } : t))); previewOnly("marked done — not saved", "ok"); },
    reopenTask: (id) => { setTasks((p) => p.map((t) => (t.id === id ? { ...t, status: "open", completedAt: null } : t))); previewOnly("reopened — not saved"); },
    rescheduleTask: (id, dateISO, note) => { setTasks((p) => p.map((t) => (t.id === id ? { ...t, dueDate: new Date(dateISO), ...(note !== undefined ? { progressorNote: note, progressorNoteAt: new Date() } : {}) } : t))); previewOnly("rescheduled — not saved", "ok"); },
    addTask: (input) => { setTasks((p) => [previewTask(input, data.viewerName), ...p]); previewOnly("to-do added to this view — not saved", "ok"); },
    completeReview: (key) => { setItems((p) => { const r = p.find((x) => reviewKey(x) === key); if (r) setDone((d) => [{ ...(r as object) } as ReviewItem, ...d]); return p.filter((x) => reviewKey(x) !== key); }); previewOnly("review completed — not saved", "ok"); },
    reopenReview: (key) => { setDone((p) => { const r = p.find((x) => reviewKey(x) === key); if (r) setItems((i) => sortReviews([{ ...(r as object) } as ReviewItem, ...i])); return p.filter((x) => reviewKey(x) !== key); }); previewOnly("review reopened — not saved"); },
    editReview: (key, title, notes) => { setItems((p) => p.map((x) => (reviewKey(x) === key ? ({ ...(x as object), title, notes } as ReviewItem) : x))); previewOnly("review edited — not saved", "ok"); },
    rescheduleReview: (key, dateISO) => { setItems((p) => sortReviews(p.map((x) => (reviewKey(x) === key ? ({ ...(x as object), reviewDate: new Date(dateISO) } as ReviewItem) : x)))); previewOnly("review date changed — not saved", "ok"); },
    removeReview: (key) => { setItems((p) => p.filter((x) => reviewKey(x) !== key)); setDone((p) => p.filter((x) => reviewKey(x) !== key)); setSelected(null); previewOnly("review removed — not saved", "warn"); },
    takeOffHold: (key) => { setItems((p) => p.filter((x) => reviewKey(x) !== key)); setSelected(null); previewOnly("would take the file off hold and let its automation resume — NOT executed", "warn"); },
    extendHold: (key, dateISO) => { if (dateISO === null) { setItems((p) => p.filter((x) => reviewKey(x) !== key)); setSelected(null); previewOnly("return date removed — not saved", "warn"); } else { setItems((p) => sortReviews(p.map((x) => (reviewKey(x) === key ? ({ ...(x as object), reviewDate: new Date(dateISO) } as ReviewItem) : x)))); previewOnly("hold date extended — not saved", "ok"); } },
  };

  // Buckets (role-aware — mirrors AgentTodoList tabs exactly)
  const part = useMemo(() => partition(tasks), [tasks]);
  const openCount = (list: Task[]) => list.filter((t) => t.status === "open").length;
  const buckets: { key: BucketKey; label: string; count: number }[] = data.isInternal
    ? [
        { key: "internal", label: "Internal", count: openCount(part.internal) },
        { key: "prog", label: "From agents", count: openCount(part.prog) },
        { key: "reviews", label: "Reviews", count: data.reviewsDueCount },
      ]
    : [
        { key: "mine", label: "To-Do", count: openCount(part.own) },
        { key: "reviews", label: "Reviews", count: data.reviewsDueCount },
        ...(data.canUseProgressor ? [{ key: "prog" as BucketKey, label: "Outbound", count: openCount(part.prog) }] : []),
      ];
  const activeBucket = buckets.some((b) => b.key === bucket) ? bucket : buckets[0].key;

  // Keyboard: flat list of visible row keys for ↑/↓; "e" completes; "/" search.
  const flatKeys = useMemo(() => computeFlatKeys(activeBucket, part, items, done, showDone, query), [activeBucket, part, items, done, showDone, query]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") { if (e.key === "Escape") (e.target as HTMLElement).blur(); return; }
      if (e.key === "/") { e.preventDefault(); searchRef.current?.querySelector("input")?.focus(); return; }
      if (e.key === "Escape") { setSelected(null); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); if (!flatKeys.length) return;
        const i = selected ? flatKeys.indexOf(selected) : -1;
        const next = e.key === "ArrowDown" ? Math.min(flatKeys.length - 1, i + 1) : Math.max(0, i - 1);
        setSelected(flatKeys[next < 0 ? 0 : next]);
      }
      if ((e.key === "e" || e.key === "E") && selected?.startsWith("t:")) { const id = selected.slice(2); const t = tasks.find((x) => x.id === id); if (t) (t.status === "open" ? preview.completeTask(id) : preview.reopenTask(id)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flatKeys, selected, tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedTask = selected?.startsWith("t:") ? tasks.find((t) => t.id === selected.slice(2)) ?? null : null;
  const selectedReview = selected?.startsWith("r:") ? [...items, ...done].find((r) => `r:${reviewKey(r)}` === selected) ?? null : null;

  const headerTitle = ({ mine: "My to-dos", internal: "Internal to-dos", prog: data.isProgressor ? "From agents" : "With your progressor", reviews: "Reviews" } as Record<string, string>)[activeBucket];

  return (
    <PreviewCtx.Provider value={preview}>
      {/* Preview banner — persistent, unmissable */}
      <div className="tn-banner" role="status">
        <Lock size={13} weight="fill" />
        <span><b>Preview workspace.</b> Real data, real workflows — but nothing is saved, no email is sent, and no file is reactivated. Every action shows what would happen.</span>
      </div>

      <header className="tn-top">
        <div className="tn-top-id">
          <h1>To-Do</h1>
          <p>{data.subtitle}</p>
        </div>
        <div className="tn-top-actions">
          <Button variant="secondary" size="sm" onClick={() => setNoteOpen(true)}><Note weight="regular" /> Add note</Button>
          <Button variant="secondary" size="sm" onClick={() => setComposeOpen(true)}><PaperPlaneTilt weight="regular" /> Compose</Button>
          <button className={cn("tn-theme", theme === "light" && "on")} aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><span className="tn-theme-knob" /></button>
        </div>
      </header>

      <div className="tn-filterbar">
        <TravellingSelection variant="segmented" ariaLabel="Lists" value={activeBucket} onChange={(k) => { setBucket(k as BucketKey); setSelected(null); }} items={buckets.map((b) => ({ value: b.key, label: b.count > 0 ? `${b.label} · ${b.count}` : b.label }))} />
        <div className="tn-search" ref={searchRef}>
          <Input leading={<MagnifyingGlass weight="regular" />} value={query} onChange={(e) => setQuery(e.target.value)} clearable onClear={() => setQuery("")} placeholder="Filter this list   ( / )" />
        </div>
        {activeBucket !== "prog" && (
          <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
            {activeBucket === "reviews" ? <CalendarCheck weight="bold" /> : <Plus weight="bold" />}
            {activeBucket === "reviews" ? "Add review" : "Add to-do"}
          </Button>
        )}
      </div>

      <div className="tn-body">
        {/* ── LEFT: the queue (solid, dense) ── */}
        <div className="tn-list" role="list">
          {activeBucket === "reviews"
            ? <ReviewLists items={items} done={done} query={query} selected={selected} onSelect={setSelected} showDone={!!showDone.reviews} onToggleDone={() => setShowDone((s) => ({ ...s, reviews: !s.reviews }))} picked={picked} setPicked={setPicked} photoByTx={data.photoByTx} />
            : <TaskLists list={activeBucket === "mine" ? part.own : activeBucket === "internal" ? part.internal : part.prog} bucket={activeBucket} query={query} selected={selected} onSelect={setSelected} showDone={!!showDone[activeBucket]} onToggleDone={() => setShowDone((s) => ({ ...s, [activeBucket]: !s[activeBucket] }))} picked={picked} setPicked={setPicked} photoByTx={data.photoByTx} progressorName={data.progressorName} isProgressorView={data.isProgressor} headerTitle={headerTitle} />}
        </div>

        {/* ── RIGHT: triage detail ── */}
        <div className="tn-detail">
          {selectedTask ? <TaskDetail task={selectedTask} photoByTx={data.photoByTx} progressorName={data.progressorName} isProgressorView={data.isProgressor} />
            : selectedReview ? <ReviewDetail review={selectedReview} photoByTx={data.photoByTx} />
            : <div className="tn-detail-empty"><EmptyState title="Nothing selected" body="Pick a task or review on the left to triage it here. Use ↑ ↓ to move, E to complete, / to filter." /></div>}
        </div>
      </div>

      {/* Multi-select → floating LENS action bar (visual demo; bulk ops NOT wired) */}
      {picked.size > 0 && (
        <div className="tn-selbar-wrap">
          <Surface material="lens" radius={16} lensThickness={1.4} className="tn-selbar">
            <span className="tn-selbar-n">{picked.size} selected</span>
            <span className="tn-selbar-sep" />
            <button className="tn-selbar-btn" onClick={() => preview.previewOnly("bulk actions are a visual demo — not wired", "warn")}><CheckCircle weight="regular" /> Complete</button>
            <button className="tn-selbar-btn" onClick={() => preview.previewOnly("bulk actions are a visual demo — not wired", "warn")}><CalendarBlank weight="regular" /> Reschedule</button>
            <span className="tn-selbar-demo">visual demo · not wired</span>
            <button className="tn-selbar-x" aria-label="Clear selection" onClick={() => setPicked(new Set())}><X weight="bold" /></button>
          </Surface>
        </div>
      )}

      <AddComposer open={addOpen} onClose={() => setAddOpen(false)} mode={activeBucket === "reviews" ? "review" : activeBucket === "internal" ? "internal" : "task"} data={data} />
      <ComposePreviewDrawer open={composeOpen} onClose={() => setComposeOpen(false)} />
      <NotePreviewDrawer open={noteOpen} onClose={() => setNoteOpen(false)} data={data} />
    </PreviewCtx.Provider>
  );
}

/* ── small shared bits ───────────────────────────────────────────────────────── */
function previewTask(input: AddInput, viewer: string): Task {
  return {
    id: `preview-${Math.random().toString(36).slice(2, 8)}`, title: input.title, notes: input.notes ?? null,
    progressorNote: null, progressorNoteAt: null, status: "open", completedAt: null,
    dueDate: input.dueDate ? new Date(input.dueDate) : null, createdAt: new Date(),
    isAgentRequest: !!input.isAgentRequest, isInternalSelfAssigned: !!input.isInternalSelfAssigned, isReview: false, isPossible: false,
    transactionId: input.transactionId ?? null,
    transaction: input.transactionAddress ? { propertyAddress: input.transactionAddress, photoStoragePath: null } : null,
    assignedTo: null, createdBy: { id: "me", name: viewer },
  };
}
function sortReviews(list: ReviewItem[]): ReviewItem[] {
  return [...list].sort((a, b) => (reviewDate(a)?.getTime() ?? Infinity) - (reviewDate(b)?.getTime() ?? Infinity));
}
function Thumb({ url, size = 42 }: { url?: string | null; size?: number }) {
  return url
    // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL; next/image remote config is out of scope for this dev preview
    ? <img src={url} alt="" width={size} height={size} className="tn-thumb" style={{ width: size, height: size }} />
    : <span className="tn-thumb tn-thumb--ph" style={{ width: size, height: size }}><House size={size * 0.4} weight="regular" /></span>;
}
function DueBadge({ label, tone }: { label: string; tone: DueTone }) {
  return <span className={cn("tn-due", `tn-tone-${tone}`)}><CalendarBlank size={11} weight="bold" />{label}</span>;
}
function OriginPill({ origin }: { origin: string }) {
  const m = ORIGIN_META[origin] ?? ORIGIN_META.hold;
  return <span className={cn("tn-pill", `tn-pill-${m.tone}`)}>{m.label}</span>;
}
function CompleteCircle({ done, onClick, tone = "info" }: { done: boolean; onClick: () => void; tone?: "info" | "warn" }) {
  return (
    <button className={cn("tn-circle", done && "on", `tn-circle-${tone}`)} aria-label={done ? "Reopen (preview)" : "Mark done (preview)"} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {done ? <CheckCircle size={18} weight="fill" /> : <Circle size={18} weight="regular" />}
    </button>
  );
}

/* ── TASK lists (grouped by property, Overdue / Upcoming / Completed) ─────────── */
function TaskLists({ list, bucket, query, selected, onSelect, showDone, onToggleDone, picked, setPicked, photoByTx, progressorName, isProgressorView, headerTitle }: {
  list: Task[]; bucket: string; query: string; selected: string | null; onSelect: (k: string) => void; showDone: boolean; onToggleDone: () => void;
  picked: Set<string>; setPicked: (s: Set<string>) => void; photoByTx: Record<string, string | null>; progressorName: string | null; isProgressorView: boolean; headerTitle: string;
}) {
  const q = query.trim().toLowerCase();
  const match = (t: Task) => !q || t.title.toLowerCase().includes(q) || (t.notes ?? "").toLowerCase().includes(q) || (t.transaction?.propertyAddress ?? "").toLowerCase().includes(q);
  const open = sortTasks(list.filter((t) => t.status === "open" && match(t)));
  const doneList = sortTasks(list.filter((t) => t.status === "done" && match(t)));
  const { overdue, upcoming } = overdueUpcoming(open);
  const icon = bucket === "internal" ? <ListChecks size={18} weight="regular" /> : bucket === "prog" ? <UsersThree size={18} weight="regular" /> : <ListChecks size={18} weight="regular" />;
  const hasAny = overdue.length + upcoming.length > 0;

  return (
    <>
      <div className="tn-listhead">{icon}<span>{headerTitle}</span></div>
      {!hasAny && doneList.length === 0 ? (
        <div className="tn-empty"><p>{q ? "Nothing matches your filter." : bucket === "prog" ? (isProgressorView ? "No pending requests from agents." : "Nothing sent to your progressor yet.") : "All clear."}</p></div>
      ) : (
        <>
          {overdue.length > 0 && <TaskSection label="Overdue" tone="danger" groups={groupByTransaction(overdue)} {...{ selected, onSelect, picked, setPicked, photoByTx, progressorName, isProgressorView }} />}
          {upcoming.length > 0 && <TaskSection label="Upcoming" groups={groupByTransaction(upcoming)} {...{ selected, onSelect, picked, setPicked, photoByTx, progressorName, isProgressorView }} />}
          {doneList.length > 0 && (
            <div className="tn-doneblock">
              <button className="tn-disclosure" aria-expanded={showDone} onClick={onToggleDone}><span className={cn("tn-caret", showDone && "open")}>›</span> Completed · {doneList.length}</button>
              {showDone && <TaskSection groups={groupByTransaction(doneList)} dimmed {...{ selected, onSelect, picked, setPicked, photoByTx, progressorName, isProgressorView }} />}
            </div>
          )}
        </>
      )}
    </>
  );
}
function TaskSection({ label, tone, groups, dimmed, selected, onSelect, picked, setPicked, photoByTx, progressorName, isProgressorView }: {
  label?: string; tone?: DueTone; groups: Group[]; dimmed?: boolean; selected: string | null; onSelect: (k: string) => void;
  picked: Set<string>; setPicked: (s: Set<string>) => void; photoByTx: Record<string, string | null>; progressorName: string | null; isProgressorView: boolean;
}) {
  return (
    <div className="tn-section">
      {label && <div className={cn("tn-sec-label", tone && `tn-tone-${tone}`)}>{label}</div>}
      {groups.map((g) => (
        <div key={g.transactionId ?? "_general"} className={cn("tn-group", dimmed && "dimmed")}>
          <div className="tn-group-head">
            {g.transactionId ? (
              <Link href={`/agent/transactions/${g.transactionId}`} className="tn-group-id">
                <Thumb url={photoByTx[g.transactionId]} size={32} />
                <span className="tn-group-addr">{g.address ? splitAddress(g.address).line : "Unknown"}{g.address && splitAddress(g.address).location ? <em>{splitAddress(g.address).location}</em> : null}</span>
              </Link>
            ) : <span className="tn-group-quick">Quick note</span>}
          </div>
          {g.tasks.map((t) => <TaskRow key={t.id} task={t} selected={selected === `t:${t.id}`} onSelect={() => onSelect(`t:${t.id}`)} picked={picked.has(t.id)} onPick={() => togglePick(picked, setPicked, t.id)} progressorName={progressorName} isProgressorView={isProgressorView} />)}
        </div>
      ))}
    </div>
  );
}
function TaskRow({ task, selected, onSelect, picked, onPick, progressorName, isProgressorView }: {
  task: Task; selected: boolean; onSelect: () => void; picked: boolean; onPick: () => void; progressorName: string | null; isProgressorView: boolean;
}) {
  const p = usePreview();
  const isDone = task.status === "done";
  const due = task.dueDate && !isDone ? taskDue(task.dueDate) : null;
  const isAgentReq = task.isAgentRequest;
  return (
    <div className={cn("tn-row", selected && "sel", isDone && "done")} role="listitem" onClick={onSelect}>
      <CompleteCircle done={isDone} tone={isAgentReq ? "warn" : "info"} onClick={() => (isDone ? p.reopenTask(task.id) : p.completeTask(task.id))} />
      <div className="tn-row-main">
        <p className="tn-row-title">{task.title}</p>
        {task.notes && <p className="tn-row-sub">{task.notes}</p>}
        {task.progressorNote && <p className="tn-row-note"><b>{isAgentReq && !isProgressorView ? (progressorName ?? "Your progressor") : "Latest update"}</b> {task.progressorNote}</p>}
      </div>
      <div className="tn-row-right">
        {due ? <DueBadge label={due.label} tone={due.tone} /> : <span className="tn-row-created">{fmtDate(task.createdAt)}</span>}
        <button className={cn("tn-pick", picked && "on")} aria-label="Select" onClick={(e) => { e.stopPropagation(); onPick(); }}><span /></button>
      </div>
    </div>
  );
}

/* ── REVIEW lists (Due now / Upcoming / Completed; hold + manual preserved) ───── */
function ReviewLists({ items, done, query, selected, onSelect, showDone, onToggleDone, picked, setPicked, photoByTx }: {
  items: ReviewItem[]; done: ReviewItem[]; query: string; selected: string | null; onSelect: (k: string) => void; showDone: boolean; onToggleDone: () => void;
  picked: Set<string>; setPicked: (s: Set<string>) => void; photoByTx: Record<string, string | null>;
}) {
  const q = query.trim().toLowerCase();
  const match = (r: ReviewItem) => { const o = r as Record<string, unknown>; return !q || String(o.title ?? "").toLowerCase().includes(q) || String(o.address ?? "").toLowerCase().includes(q) || String(o.reason ?? "").toLowerCase().includes(q); };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isDue = (r: ReviewItem) => { const d = reviewDate(r); return d ? d.setHours(0, 0, 0, 0) <= today.getTime() : false; };
  const dueItems = items.filter((r) => match(r) && isDue(r));
  const upItems = items.filter((r) => match(r) && !isDue(r));
  const doneItems = done.filter(match);
  const any = dueItems.length + upItems.length + doneItems.length;

  return (
    <>
      <div className="tn-listhead"><CalendarCheck size={18} weight="regular" /><span>Reviews</span></div>
      {any === 0 ? (
        <div className="tn-empty"><p>{q ? "Nothing matches your filter." : "No reviews yet. Add one to bring a file back on a date."}</p></div>
      ) : (
        <>
          {dueItems.length > 0 && <div className="tn-section"><div className="tn-sec-label tn-tone-warn">Due now</div>{dueItems.map((r) => <ReviewRow key={reviewKey(r)} r={r} selected={selected === `r:${reviewKey(r)}`} onSelect={() => onSelect(`r:${reviewKey(r)}`)} picked={picked.has(reviewKey(r))} onPick={() => togglePick(picked, setPicked, reviewKey(r))} photoByTx={photoByTx} />)}</div>}
          {upItems.length > 0 && <div className="tn-section"><div className="tn-sec-label">Upcoming</div>{upItems.map((r) => <ReviewRow key={reviewKey(r)} r={r} selected={selected === `r:${reviewKey(r)}`} onSelect={() => onSelect(`r:${reviewKey(r)}`)} picked={picked.has(reviewKey(r))} onPick={() => togglePick(picked, setPicked, reviewKey(r))} photoByTx={photoByTx} />)}</div>}
          {doneItems.length > 0 && (
            <div className="tn-doneblock">
              <button className="tn-disclosure" aria-expanded={showDone} onClick={onToggleDone}><span className={cn("tn-caret", showDone && "open")}>›</span> Completed · {doneItems.length}</button>
              {showDone && <div className="tn-section">{doneItems.map((r) => <ReviewRow key={reviewKey(r)} r={r} dimmed selected={selected === `r:${reviewKey(r)}`} onSelect={() => onSelect(`r:${reviewKey(r)}`)} picked={picked.has(reviewKey(r))} onPick={() => togglePick(picked, setPicked, reviewKey(r))} photoByTx={photoByTx} />)}</div>}
            </div>
          )}
        </>
      )}
    </>
  );
}
function ReviewRow({ r, selected, onSelect, picked, onPick, dimmed, photoByTx }: { r: ReviewItem; selected: boolean; onSelect: () => void; picked: boolean; onPick: () => void; dimmed?: boolean; photoByTx: Record<string, string | null> }) {
  const p = usePreview();
  const o = r as Record<string, unknown>;
  const kind = reviewKind(r);
  const due = reviewDue(reviewDate(r));
  const addr = (o.address as string | null) ?? null;
  const txId = (o.transactionId as string | null) ?? null;
  const isDone = kind === "manual" && o.status === "done";
  return (
    <div className={cn("tn-row tn-row--rev", selected && "sel", dimmed && "done")} role="listitem" onClick={onSelect}>
      {kind === "manual"
        ? <CompleteCircle done={isDone} tone="warn" onClick={() => (isDone ? p.reopenReview(reviewKey(r)) : p.completeReview(reviewKey(r)))} />
        : <span className="tn-row-holdicon"><CalendarCheck size={18} weight="regular" /></span>}
      <div className="tn-row-main">
        <div className="tn-row-titlerow">
          {kind === "hold" ? <OriginPill origin={String(o.origin)} /> : <span className="tn-pill tn-pill-review">Review</span>}
          <p className="tn-row-title">{kind === "manual" ? String(o.title) : (addr ? splitAddress(addr).line : "File")}</p>
        </div>
        {kind === "manual" && o.notes ? <p className="tn-row-sub">{String(o.notes)}</p> : null}
        {kind === "hold" && o.reason ? <p className="tn-row-sub">{String(o.reason)}</p> : null}
        {addr && <p className="tn-row-addr">{splitAddress(addr).line}{splitAddress(addr).location ? ` · ${splitAddress(addr).location}` : ""}</p>}
      </div>
      <div className="tn-row-right">
        <DueBadge label={due.label} tone={due.tone} />
        <button className={cn("tn-pick", picked && "on")} aria-label="Select" onClick={(e) => { e.stopPropagation(); onPick(); }}><span /></button>
      </div>
      <Thumb url={txId ? photoByTx[txId] : null} size={36} />
    </div>
  );
}

function togglePick(picked: Set<string>, setPicked: (s: Set<string>) => void, id: string) {
  const next = new Set(picked); next.has(id) ? next.delete(id) : next.add(id); setPicked(next);
}
function computeFlatKeys(bucket: string, part: ReturnType<typeof partition>, items: ReviewItem[], done: ReviewItem[], showDone: Record<string, boolean>, query: string): string[] {
  const q = query.trim().toLowerCase();
  if (bucket === "reviews") {
    const match = (r: ReviewItem) => { const o = r as Record<string, unknown>; return !q || String(o.title ?? "").toLowerCase().includes(q) || String(o.address ?? "").toLowerCase().includes(q) || String(o.reason ?? "").toLowerCase().includes(q); };
    const keys = sortReviews(items.filter(match)).map((r) => `r:${reviewKey(r)}`);
    if (showDone.reviews) keys.push(...done.filter(match).map((r) => `r:${reviewKey(r)}`));
    return keys;
  }
  const list = bucket === "mine" ? part.own : bucket === "internal" ? part.internal : part.prog;
  const match = (t: Task) => !q || t.title.toLowerCase().includes(q) || (t.notes ?? "").toLowerCase().includes(q) || (t.transaction?.propertyAddress ?? "").toLowerCase().includes(q);
  const open = sortTasks(list.filter((t) => t.status === "open" && match(t)));
  const { overdue, upcoming } = overdueUpcoming(open);
  const keys = [...groupByTransaction(overdue), ...groupByTransaction(upcoming)].flatMap((g) => g.tasks.map((t) => `t:${t.id}`));
  if (showDone[bucket]) keys.push(...sortTasks(list.filter((t) => t.status === "done" && match(t))).map((t) => `t:${t.id}`));
  return keys;
}

/* ── detail panes ────────────────────────────────────────────────────────────── */
function TaskDetail({ task, photoByTx, progressorName, isProgressorView }: { task: Task; photoByTx: Record<string, string | null>; progressorName: string | null; isProgressorView: boolean }) {
  const p = usePreview();
  const isDone = task.status === "done";
  const [date, setDate] = useState<Date | null>(task.dueDate ? new Date(task.dueDate) : null);
  const [note, setNote] = useState(task.progressorNote ?? "");
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setDate(task.dueDate ? new Date(task.dueDate) : null); setNote(task.progressorNote ?? ""); }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const due = task.dueDate && !isDone ? taskDue(task.dueDate) : null;
  return (
    <div className="tn-dp">
      <div className="tn-dp-top">
        {task.transactionId ? (
          <Link href={`/agent/transactions/${task.transactionId}`} className="tn-dp-file"><Thumb url={photoByTx[task.transactionId]} size={44} /><span>{task.transaction?.propertyAddress ? splitAddress(task.transaction.propertyAddress).line : "File"}<em>Open file <ArrowSquareOut size={11} weight="bold" /></em></span></Link>
        ) : <span className="tn-dp-quick">Quick note</span>}
        {due && <DueBadge label={due.label} tone={due.tone} />}
      </div>
      <h2 className={cn("tn-dp-title", isDone && "done")}>{task.title}</h2>
      {task.notes && <p className="tn-dp-notes">{task.notes}</p>}
      {task.progressorNote && <div className="tn-dp-update"><span>{task.isAgentRequest && !isProgressorView ? (progressorName ?? "Your progressor") : "Latest update"}{task.progressorNoteAt ? ` · ${fmtDate(task.progressorNoteAt)}` : ""}</span><p>{task.progressorNote}</p></div>}

      <div className="tn-dp-actions">
        <Button variant={isDone ? "secondary" : "primary"} onClick={() => (isDone ? p.reopenTask(task.id) : p.completeTask(task.id))}>{isDone ? <><Circle weight="regular" /> Reopen</> : <><CheckCircle weight="fill" /> Mark done</>}</Button>
      </div>

      {!isDone && (
        <div className="tn-dp-sec">
          <h3>Reschedule &amp; add an update</h3>
          <Field label="New date"><DatePicker value={date} onChange={setDate} /></Field>
          <Field label="Update (optional)"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's happened?" /></Field>
          <div className="tn-dp-row">
            <Button variant="primary" size="sm" disabled={!date} onClick={() => { if (date) p.rescheduleTask(task.id, isoFromDate(date), note.trim() !== (task.progressorNote ?? "") ? (note.trim() || null) : undefined); }}>Save (preview)</Button>
          </div>
        </div>
      )}

      <div className="tn-dp-foot">
        <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}><Trash weight="regular" /> Remove</Button>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => { p.previewOnly("to-do removed from this view — not saved", "warn"); }} danger title="Remove this to-do?" body="In the live app this permanently removes the to-do. Here it only clears it from the preview." confirmLabel="Remove (preview)" />
    </div>
  );
}

function ReviewDetail({ review, photoByTx }: { review: ReviewItem; photoByTx: Record<string, string | null> }) {
  const p = usePreview();
  const o = review as Record<string, unknown>;
  const kind = reviewKind(review);
  const key = reviewKey(review);
  const txId = (o.transactionId as string | null) ?? null;
  const addr = (o.address as string | null) ?? null;
  const due = reviewDue(reviewDate(review));
  const [date, setDate] = useState<Date | null>(reviewDate(review));
  const [title, setTitle] = useState(String(o.title ?? ""));
  const [notes, setNotes] = useState(String(o.notes ?? ""));
  const [confirm, setConfirm] = useState(false);
  const [offHold, setOffHold] = useState(false);
  useEffect(() => { setDate(reviewDate(review)); setTitle(String(o.title ?? "")); setNotes(String(o.notes ?? "")); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const isDone = kind === "manual" && o.status === "done";

  return (
    <div className="tn-dp">
      <div className="tn-dp-top">
        {txId ? <Link href={`/agent/transactions/${txId}`} className="tn-dp-file"><Thumb url={photoByTx[txId]} size={44} /><span>{addr ? splitAddress(addr).line : "File"}<em>Open file <ArrowSquareOut size={11} weight="bold" /></em></span></Link> : <span className="tn-dp-quick">No specific file</span>}
        <div className="tn-dp-toppills">{kind === "hold" ? <OriginPill origin={String(o.origin)} /> : <span className="tn-pill tn-pill-review">Review</span>}<DueBadge label={due.label} tone={due.tone} /></div>
      </div>

      {kind === "hold" ? (
        <>
          <h2 className="tn-dp-title">{addr ? splitAddress(addr).line : "On hold"}</h2>
          {o.reason ? <p className="tn-dp-notes">{String(o.reason)}</p> : <p className="tn-dp-notes tn-muted">No reason recorded.</p>}
          {o.placedByName ? <p className="tn-dp-meta">Placed by {String(o.placedByName)}{o.startedAt ? ` · ${fmtDate(o.startedAt as string)}` : ""}</p> : null}
          <div className="tn-dp-sec">
            <h3>Take the file off hold</h3>
            <p className="tn-dp-hint">Resumes the file and lets its automation (chases) run again on its existing settings. <b>High-consequence — preview only here.</b></p>
            <Button variant="primary" onClick={() => setOffHold(true)}>Take off hold</Button>
          </div>
          <div className="tn-dp-sec">
            <h3>Return date</h3>
            <Field label="Extend to"><DatePicker value={date} onChange={setDate} /></Field>
            <div className="tn-dp-row">
              <Button variant="primary" size="sm" disabled={!date} onClick={() => { if (date) p.extendHold(key, isoFromDate(date)); }}>Extend (preview)</Button>
              <Button variant="ghost" size="sm" onClick={() => p.extendHold(key, null)}>Remove return date</Button>
            </div>
          </div>
          <ConfirmDialog open={offHold} onClose={() => setOffHold(false)} onConfirm={() => p.takeOffHold(key)} danger title="Take this file off hold?" body="Live, this reactivates the file and resumes its chase automation. Here it is preview-only: nothing is reactivated and no chase is sent." confirmLabel="Take off hold (preview)" />
        </>
      ) : (
        <>
          <div className="tn-dp-sec">
            <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Notes"><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <div className="tn-dp-row"><Button variant="primary" size="sm" disabled={!title.trim()} onClick={() => p.editReview(key, title.trim(), notes.trim() || null)}>Save edits (preview)</Button></div>
          </div>
          <div className="tn-dp-sec">
            <h3>Reschedule</h3>
            <Field label="New date"><DatePicker value={date} onChange={setDate} /></Field>
            <div className="tn-dp-row"><Button variant="primary" size="sm" disabled={!date} onClick={() => { if (date) p.rescheduleReview(key, isoFromDate(date)); }}>Save date (preview)</Button></div>
          </div>
          <div className="tn-dp-actions">
            <Button variant={isDone ? "secondary" : "primary"} onClick={() => (isDone ? p.reopenReview(key) : p.completeReview(key))}>{isDone ? "Reopen" : "Mark done"}</Button>
            <Button variant="ghost" onClick={() => setConfirm(true)}><Trash weight="regular" /> Remove</Button>
          </div>
          <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => p.removeReview(key)} danger title="Remove this review?" body="Live, this permanently removes the review. Here it only clears it from the preview." confirmLabel="Remove (preview)" />
        </>
      )}
    </div>
  );
}

/* ── composers (preview — no writes / no sends) ──────────────────────────────── */
function AddComposer({ open, onClose, mode, data }: { open: boolean; onClose: () => void; mode: "task" | "internal" | "review"; data: TodoNextData }) {
  const p = usePreview();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState<Date | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [owner, setOwner] = useState<"mine" | "progressor">("mine");
  const [asReview, setAsReview] = useState(mode === "review");
  const reset = () => { setTitle(""); setNotes(""); setDate(null); setFile(null); setOwner("mine"); setAsReview(mode === "review"); };
  const fileOpts = data.attachableFiles.map((f) => ({ value: f.id, label: f.propertyAddress }));
  const submit = () => {
    if (!title.trim()) return;
    if ((mode === "review" || asReview) && !date) return;
    p.addTask({ title: title.trim(), notes: notes.trim() || undefined, dueDate: date ? isoFromDate(date) : undefined, transactionId: file ?? undefined, transactionAddress: fileOpts.find((o) => o.value === file)?.label, isAgentRequest: data.canUseProgressor && owner === "progressor", isInternalSelfAssigned: mode === "internal" });
    reset(); onClose();
  };
  return (
    <Drawer open={open} onClose={() => { reset(); onClose(); }} eyebrow={mode === "review" ? "New review" : "New to-do"} title={mode === "review" ? "Add a review" : mode === "internal" ? "Add an internal to-do" : "Add a to-do"}
      footer={<><Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button><Button variant="primary" disabled={!title.trim() || ((mode === "review" || asReview) && !date)} onClick={submit}>{mode === "review" ? "Add review (preview)" : "Add (preview)"}</Button></>}>
      <Field label="What needs doing?"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" /></Field>
      <Field label="Notes (optional)"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any detail" /></Field>
      {data.attachableFiles.length > 0 && <Field label="Attach to a file (optional)"><Select value={file} onChange={setFile} options={fileOpts} placeholder="No specific file" /></Field>}
      {data.canUseProgressor && mode === "task" && (
        <Field label="Who's it for?"><TravellingSelection variant="segmented" size="sm" ariaLabel="Owner" value={owner} onChange={(v) => setOwner(v as "mine" | "progressor")} items={[{ value: "mine", label: "Mine" }, { value: "progressor", label: "Your progressor" }]} /></Field>
      )}
      {mode !== "review" && file && <div className="tn-cb"><Checkbox checked={asReview} onChange={setAsReview}>Mark as a review — bring this file back on the date below</Checkbox></div>}
      <Field label={mode === "review" || asReview ? "Review date" : "Due date (optional)"}><DatePicker value={date} onChange={setDate} /></Field>
      <p className="tn-cb-hint"><Lock size={11} weight="fill" /> Preview — this adds to the list on screen only. Nothing is saved.</p>
    </Drawer>
  );
}
function ComposePreviewDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = usePreview();
  const [to, setTo] = useState(""); const [subject, setSubject] = useState(""); const [body, setBody] = useState("");
  const reset = () => { setTo(""); setSubject(""); setBody(""); };
  return (
    <Drawer open={open} onClose={() => { reset(); onClose(); }} eyebrow="Compose" title="Compose an email"
      footer={<><Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button><Button variant="primary" disabled={!to.trim() || !subject.trim()} onClick={() => { p.previewOnly("email NOT sent — compose is preview-only", "warn"); reset(); onClose(); }}>Send (preview)</Button></>}>
      <div className="tn-warnrow"><Lock size={12} weight="fill" /> In the live app this sends real email. Here it is <b>preview-only — nothing leaves the building.</b></div>
      <Field label="To"><Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com" /></Field>
      <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" /></Field>
      <Field label="Message"><Textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" /></Field>
    </Drawer>
  );
}
function NotePreviewDrawer({ open, onClose, data }: { open: boolean; onClose: () => void; data: TodoNextData }) {
  const p = usePreview();
  const [file, setFile] = useState<string | null>(null); const [note, setNote] = useState("");
  const fileOpts = data.attachableFiles.map((f) => ({ value: f.id, label: f.propertyAddress }));
  const reset = () => { setFile(null); setNote(""); };
  return (
    <Drawer open={open} onClose={() => { reset(); onClose(); }} eyebrow="Log an update" title="Add a note"
      footer={<><Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button><Button variant="primary" disabled={!file || !note.trim()} onClick={() => { p.previewOnly("note NOT saved — add-note is preview-only", "warn"); reset(); onClose(); }}>Add note (preview)</Button></>}>
      <div className="tn-warnrow"><Lock size={12} weight="fill" /> Live, this writes an activity record on the file. Here it is <b>preview-only.</b></div>
      <Field label="Which sale?"><Select value={file} onChange={setFile} options={fileOpts} placeholder="Pick a file" /></Field>
      <Field label="Note"><Textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's happened?" /></Field>
    </Drawer>
  );
}

function isoFromDate(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
