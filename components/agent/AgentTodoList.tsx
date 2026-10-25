"use client";

import { useState, createContext, useContext, type ReactNode } from "react";
import { Popover } from "@/components/ui/Popover";
import Link from "next/link";
import { ListChecks, UsersThree } from "@phosphor-icons/react";
import { SectionHeader } from "@/components/agent/SectionHeader";
import { SectionDisclosure } from "@/components/ui/SectionDisclosure";
import type { ManualTaskWithRelations } from "@/lib/services/manual-tasks";
import { createManualTaskAction, updateManualTaskAction } from "@/app/actions/manual-tasks";
import { AddManualTaskForm } from "@/components/todos/AddManualTaskForm";
import { TodoTabs, type TodoTab } from "@/components/agent/TodoTabs";
import { Card } from "@/components/ui/Card";
import { toUKDateStr } from "@/lib/utils";
import { PropertyThumb } from "@/components/ui/PropertyThumb";

// First line + town/postcode split (last two comma parts) — matches the address
// treatment on the reminders / enquiries / completions cards.
function splitTodoAddress(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 2) return { line: parts[0] ?? address, location: parts.slice(1).join(" · ") };
  return { line: parts.slice(0, -2).join(", "), location: parts.slice(-2).join(" · ") };
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type Task = ManualTaskWithRelations;

type Group = {
  transactionId: string | null;
  address: string | null;
  tasks: Task[];
};

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (ad !== bd) return ad - bd;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function getDueStatus(dueDate: Date): { label: string; color: string; reassure: boolean } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - due.getTime()) / 86400000);
  if (diffDays < 0) {
    if (diffDays === -1) return { label: "Due tomorrow", color: "var(--agent-text-muted)", reassure: false };
    return { label: `Due ${fmtDate(dueDate)}`, color: "var(--agent-text-muted)", reassure: false };
  }
  if (diffDays === 0) return { label: "Due today", color: "var(--agent-warning)", reassure: true };
  if (diffDays === 1) return { label: "Due yesterday", color: "var(--agent-warning)", reassure: true };
  if (diffDays <= 3) return { label: "Overdue", color: "var(--agent-warning)", reassure: true };
  return { label: `Overdue · ${diffDays} days`, color: "var(--agent-danger)", reassure: false };
}

function groupByTransaction(tasks: Task[]): Group[] {
  const map = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const key = t.transactionId ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  const groups: Group[] = [];
  for (const [txId, txTasks] of map.entries()) {
    groups.push({
      transactionId: txId,
      address: txTasks[0].transaction?.propertyAddress ?? null,
      tasks: txTasks,
    });
  }
  return groups.sort((a, b) => {
    if (a.transactionId === null) return 1;
    if (b.transactionId === null) return -1;
    return 0;
  });
}

// Lets any TaskRow change its own due date without prop-drilling through
// Section → TaskGroup → TaskRow. Null = editing disabled.
const DueDateContext = createContext<((id: string, dueDate: string | null) => void) | null>(null);
// Combined reschedule: a new date plus an optional update note, saved in one go
// (critique #274). `note` undefined = leave the note untouched.
const RescheduleContext = createContext<((id: string, data: { dueDate: string | null; note?: string | null }) => void) | null>(null);
// Property photos keyed by transaction id (signed on the page) — consumed by
// TaskGroup for its file-group header thumbnail.
const PhotoContext = createContext<Map<string, string | null> | null>(null);
// The business progressing this agency's files (null = TSP/self-signup → "our
// team"). Consumed deep in TaskRow for the "… is on it" reassurance line.
const ProgressorNameContext = createContext<string | null>(null);

export function AgentTodoList({ initialTasks, role, hasOutsourced = false, photoByTx, attachableFiles, progressorName = null, reviewsSlot = null, reviewsCount = 0 }: { initialTasks: Task[]; role?: string; hasOutsourced?: boolean; photoByTx?: Map<string, string | null>; attachableFiles?: { id: string; propertyAddress: string }[]; progressorName?: string | null; reviewsSlot?: ReactNode; reviewsCount?: number }) {
  const isProgressor = role === "sales_progressor";
  // Only offer the "assign to your progressor" flow (and its wording) when the
  // agency actually has a file with our team. Self-managed-only agencies just
  // see their own to-dos.
  const canUseProgressor = !isProgressor && hasOutsourced;
  const isInternal = role === "sales_progressor" || role === "admin" || role === "superadmin";
  const [tasks, setTasks] = useState(initialTasks);
  const [showOwnDone, setShowOwnDone] = useState(false);
  const [showProgDone, setShowProgDone] = useState(false);
  const [showInternalDone, setShowInternalDone] = useState(false);
  // Which tab is showing (critique #261). Progressors land on Internal, agencies
  // on their own To-Do.
  const [activeTab, setActiveTab] = useState<string>(isInternal ? "internal" : "mine");
  // The Add-to-do form's open state, lifted so the trigger can live in the tab
  // row (right-aligned) while the form renders in the panel below. Reset on tab
  // change so switching tabs doesn't leave a stray open form.
  const [addOpen, setAddOpen] = useState(false);
  const changeTab = (key: string) => { setAddOpen(false); setActiveTab(key); };

  async function handleToggle(id: string, newStatus: "open" | "done") {
    try {
      const updated = await updateManualTaskAction(id, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch {
      // Leave the row unchanged on failure — matches the previous no-op.
    }
  }

  async function handleDueDate(id: string, dueDate: string | null) {
    try {
      const updated = await updateManualTaskAction(id, { dueDate });
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch {
      // Leave the row unchanged on failure — matches the previous no-op.
    }
  }

  // Reschedule + add an update in one save (critique #274). Only touches the
  // note when the caller passes one (undefined = date-only).
  async function handleReschedule(id: string, data: { dueDate: string | null; note?: string | null }) {
    try {
      const updated = await updateManualTaskAction(id, {
        dueDate: data.dueDate,
        ...(data.note !== undefined ? { progressorNote: data.note } : {}),
      });
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch {
      // Leave the row unchanged on failure.
    }
  }

  async function handleAdd(input: {
    title: string;
    notes?: string;
    dueDate?: string;
    transactionId?: string;
    isAgentRequest?: boolean;
    isInternalSelfAssigned?: boolean;
  }) {
    try {
      const created = await createManualTaskAction(input);
      setTasks((prev) => [created, ...prev]);
    } catch {
      // Nothing added on failure — matches the previous no-op.
    }
  }

  async function handleAddInternal(input: {
    title: string;
    notes?: string;
    dueDate?: string;
    transactionId?: string;
  }) {
    await handleAdd({ ...input, isInternalSelfAssigned: true });
  }

  const todayStr = toUKDateStr(new Date());

  // Three-way partition. Internal tasks take precedence — a task can't be
  // both an agent-request and internal-self-assigned in practice.
  // Reviews (isReview) are excluded everywhere here — they render in the
  // dedicated "Reviews due" section above this list, so they must not
  // double-appear in My-to-dos / Internal / progressor buckets.
  const visible       = tasks.filter((t) => !t.isReview);
  const internalTasks = visible.filter((t) =>  t.isInternalSelfAssigned);
  const ownTasks      = visible.filter((t) => !t.isInternalSelfAssigned && !t.isAgentRequest);
  const progTasks     = visible.filter((t) => !t.isInternalSelfAssigned &&  t.isAgentRequest);

  const ownOpen  = sortTasks(ownTasks.filter((t) => t.status === "open"));
  const ownDone  = sortTasks(ownTasks.filter((t) => t.status === "done"));
  const progOpen = sortTasks(progTasks.filter((t) => t.status === "open"));
  const progDone = sortTasks(progTasks.filter((t) => t.status === "done"));
  const internalOpen = sortTasks(internalTasks.filter((t) => t.status === "open"));
  const internalDone = sortTasks(internalTasks.filter((t) => t.status === "done"));

  const ownOverdue        = ownOpen.filter((t) => t.dueDate && toUKDateStr(t.dueDate) < todayStr);
  const ownUpcoming       = ownOpen.filter((t) => !t.dueDate || toUKDateStr(t.dueDate) >= todayStr);
  const progOverdue       = progOpen.filter((t) => t.dueDate && toUKDateStr(t.dueDate) < todayStr);
  const progUpcoming      = progOpen.filter((t) => !t.dueDate || toUKDateStr(t.dueDate) >= todayStr);
  const internalOverdue   = internalOpen.filter((t) => t.dueDate && toUKDateStr(t.dueDate) < todayStr);
  const internalUpcoming  = internalOpen.filter((t) => !t.dueDate || toUKDateStr(t.dueDate) >= todayStr);

  // Tab set is role-aware (critique #261). Progressors: Internal · From agents ·
  // Reviews. Agencies: To-Do · Reviews · (Outbound, only if they use a progressor).
  const tabs: TodoTab[] = isInternal
    ? [
        { key: "internal", label: "Internal", count: internalOpen.length },
        { key: "prog", label: "From agents", count: progOpen.length },
        { key: "reviews", label: "Reviews", count: reviewsCount },
      ]
    : [
        { key: "mine", label: "To-Do", count: ownOpen.length },
        { key: "reviews", label: "Reviews", count: reviewsCount },
        ...(canUseProgressor ? [{ key: "prog", label: "Outbound", count: progOpen.length }] : []),
      ];
  const safeActive = tabs.some((t) => t.key === activeTab) ? activeTab : (tabs[0]?.key ?? "mine");

  // Primary "Add" trigger that sits on the tab row (right-aligned). Only on the
  // tabs that have an add form, and hidden while the form is open.
  const canAdd = safeActive === "internal" || safeActive === "mine";
  const addAction = canAdd && !addOpen ? (
    <button type="button" onClick={() => setAddOpen(true)} className="agent-btn agent-btn-sm agent-btn-primary">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      {safeActive === "internal" ? "Add internal to-do" : "Add to-do"}
    </button>
  ) : null;

  return (
    <PhotoContext.Provider value={photoByTx ?? null}>
    <ProgressorNameContext.Provider value={progressorName}>
    <RescheduleContext.Provider value={handleReschedule}>
    <DueDateContext.Provider value={handleDueDate}>
    <TodoTabs tabs={tabs} active={safeActive} onChange={changeTab} action={addAction}>
      {/* ── To-Do (agency): add form + my notes ── */}
      {safeActive === "mine" && (
        <div className="space-y-8">
          <AddManualTaskForm showOwnership={canUseProgressor} onAdd={handleAdd} attachableFiles={attachableFiles} controlledOpen={addOpen} onOpenChange={setAddOpen} hideTrigger />
          <Section
            id="section-mine"
            title="My to-dos"
            subtitle="Your notes and reminders."
            overdueGroups={groupByTransaction(ownOverdue)}
            openGroups={groupByTransaction(ownUpcoming)}
            doneGroups={groupByTransaction(ownDone)}
            doneCount={ownDone.length}
            showDone={showOwnDone}
            onToggleShowDone={() => setShowOwnDone((v) => !v)}
            onToggle={handleToggle}
            isProgressorView={false}
          />
        </div>
      )}

      {/* ── Internal (progressor): add form + internal notes ── */}
      {safeActive === "internal" && (
        <div className="space-y-8">
          <AddManualTaskForm internalMode onAdd={handleAddInternal} attachableFiles={attachableFiles} controlledOpen={addOpen} onOpenChange={setAddOpen} hideTrigger />
          <Section
            id="section-internal"
            title="Internal to-dos"
            subtitle="Your team's notes and follow-ups."
            overdueGroups={groupByTransaction(internalOverdue)}
            openGroups={groupByTransaction(internalUpcoming)}
            doneGroups={groupByTransaction(internalDone)}
            doneCount={internalDone.length}
            showDone={showInternalDone}
            onToggleShowDone={() => setShowInternalDone((v) => !v)}
            onToggle={handleToggle}
            isProgressorView={isProgressor}
            emptyText="No internal to-dos yet. Add one above to get started."
          />
        </div>
      )}

      {/* ── From agents (progressor) / Outbound (agency) ── */}
      {safeActive === "prog" && (
        <Section
          id="section-progressor"
          title={isProgressor ? "From agents" : "With your progressor"}
          subtitle={isProgressor ? "Requests from your agents." : `Requests you've sent ${progressorName ?? "our team"}.`}
          icon={<UsersThree size={22} weight="regular" />}
          overdueGroups={groupByTransaction(progOverdue)}
          openGroups={groupByTransaction(progUpcoming)}
          doneGroups={groupByTransaction(progDone)}
          doneCount={progDone.length}
          showDone={showProgDone}
          onToggleShowDone={() => setShowProgDone((v) => !v)}
          onToggle={handleToggle}
          progressor
          isProgressorView={isProgressor}
          emptyText={isProgressor ? "No pending requests from agents." : "Nothing sent to your progressor yet."}
        />
      )}

      {/* ── Reviews (both) — the section with its own empty state + add one ── */}
      {safeActive === "reviews" && reviewsSlot}
    </TodoTabs>
    </DueDateContext.Provider>
    </RescheduleContext.Provider>
    </ProgressorNameContext.Provider>
    </PhotoContext.Provider>
  );
}

function Section({
  id, title, subtitle, icon, overdueGroups, openGroups, doneGroups, doneCount, showDone,
  onToggleShowDone, onToggle, progressor = false, isProgressorView = false, emptyText,
}: {
  id: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  overdueGroups: Group[];
  openGroups: Group[];
  doneGroups: Group[];
  doneCount: number;
  showDone: boolean;
  onToggleShowDone: () => void;
  onToggle: (id: string, status: "open" | "done") => void;
  progressor?: boolean;
  isProgressorView?: boolean;
  emptyText?: string;
}) {
  const hasOpen = overdueGroups.length > 0 || openGroups.length > 0;

  return (
    <div id={id} className="space-y-3">
      {/* Section header — matches the top of the No-comms card. No count badge:
          it duplicated the active tab's own number (founder, 2026-10-20). */}
      <SectionHeader
        icon={icon ?? <ListChecks size={22} weight="regular" />}
        title={title}
        subtitle={subtitle ?? ""}
      />

      {/* Overdue sub-group */}
      {overdueGroups.length > 0 && (
        <div className="agent-bloom-stagger" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: openGroups.length > 0 ? 8 : 0 }}>
          {overdueGroups.map((group) => (
            <TaskGroup key={group.transactionId ?? "_general"} group={group} onToggle={onToggle} progressor={progressor} overdue isProgressorView={isProgressorView} />
          ))}
        </div>
      )}

      {/* Upcoming / open groups.
          NOTE: uses raw div with agent-glass-strong + agent-empty-card rather
          than <Card>. Card's default 'glass-card' backdrop is opaque and
          blocks the aurora AppBackground, making empty states look flat.
          Standard empty-state pattern across comms/completions/work-queue.
          2026-08-10 (fix missed in the Aug-9 empty-state sweep). */}
      {!hasOpen ? (
        <div
          className="agent-glass-strong agent-empty-card"
          style={{ padding: "28px 20px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-muted)" }}>
            {emptyText ?? (progressor ? "All caught up." : "All clear.")}
          </p>
        </div>
      ) : openGroups.length > 0 ? (
        <div className="agent-bloom-stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {openGroups.map((group) => (
            <TaskGroup key={group.transactionId ?? "_general"} group={group} onToggle={onToggle} progressor={progressor} isProgressorView={isProgressorView} />
          ))}
        </div>
      ) : null}

      {/* Completed section — canonical disclosure bar (2026-08-11
          drawer-consistency pass). Replaces the small "Show N completed"
          text link: whole bar clickable, rotating chevron, same
          agent-acc slide. */}
      {doneCount > 0 && (
        <div style={{ marginTop: 16 }}>
          {/* Free bar + free cards (SectionDisclosure) — the done TaskGroup cards
              float at full width under the bar, matching the open groups above
              instead of nesting inside an enclosing card. */}
          <SectionDisclosure
            label="Completed"
            count={doneCount}
            open={showDone}
            onToggle={onToggleShowDone}
          >
            {doneGroups.map((group) => (
              <TaskGroup key={group.transactionId ?? "_general"} group={group} onToggle={onToggle} dimmed progressor={progressor} isProgressorView={isProgressorView} />
            ))}
          </SectionDisclosure>
        </div>
      )}
    </div>
  );
}

function TaskGroup({ group, onToggle, dimmed = false, progressor = false, overdue = false, isProgressorView = false }: {
  group: Group;
  onToggle: (id: string, status: "open" | "done") => void;
  dimmed?: boolean;
  progressor?: boolean;
  overdue?: boolean;
  isProgressorView?: boolean;
}) {
  const photoByTx = useContext(PhotoContext);
  const { line, location } = group.address ? splitTodoAddress(group.address) : { line: "Unknown address", location: "" };
  void overdue; // accent removed (Ellis, 2026-09-19) — urgency reads on the row
  return (
    <Card glassId="todo-page-group" glassLabel="To-Do · Task group" glassDefault="v03" padding="none" style={{ opacity: dimmed ? 0.7 : 1 }}>
      <div style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
        {group.transactionId ? (
          // Identity link — photo + first line + town/postcode. Hovering anywhere
          // lights the first line coral; clicking goes to the file (like enquiries).
          <Link
            href={`/agent/transactions/${group.transactionId}`}
            className="todo-id"
            style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, textDecoration: "none" }}
          >
            <PropertyThumb photoUrl={photoByTx?.get(group.transactionId) ?? null} size={38} />
            <span style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
              <span className="todo-addr" style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line}</span>
              {location && <span style={{ fontSize: 11, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{location}</span>}
            </span>
          </Link>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-muted)" }}>Quick note</span>
        )}
      </div>
      <div>
        {group.tasks.map((task, i) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={onToggle}
            hasBorder={i < group.tasks.length - 1}
            progressor={progressor}
            isProgressorView={isProgressorView}
          />
        ))}
      </div>
    </Card>
  );
}

function TaskRow({ task, onToggle, hasBorder, progressor, isProgressorView = false }: {
  task: Task;
  onToggle: (id: string, status: "open" | "done") => void;
  hasBorder: boolean;
  progressor: boolean;
  isProgressorView?: boolean;
}) {
  const isDone = task.status === "done";
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const onReschedule = useContext(RescheduleContext);
  const progressorName = useContext(ProgressorNameContext);
  const dueStatus = task.dueDate && !isDone ? getDueStatus(task.dueDate) : null;

  // Reschedule popover: pick a new date AND add an update in one step (#274).
  // Open/close + positioning now handled by the shared Popover primitive.
  const [newDate, setNewDate] = useState("");
  const [updateText, setUpdateText] = useState("");
  const [savingResched, setSavingResched] = useState(false);

  // Seed the fields when the trigger opens the popover.
  function openResched() {
    setNewDate(task.dueDate ? toUKDateStr(task.dueDate) : "");
    setUpdateText(task.progressorNote ?? "");
  }

  async function saveResched() {
    if (!newDate) return;
    setSavingResched(true);
    const nextNote = updateText.trim();
    const noteChanged = nextNote !== (task.progressorNote ?? "");
    onReschedule?.(task.id, { dueDate: newDate, ...(noteChanged ? { note: nextNote || null } : {}) });
    setSavingResched(false);
  }

  // Who the saved note reads as: the progressor's reply to an agent in the
  // requests section, otherwise a plain "Latest update" (#274).
  const noteIsProgressorReply = progressor && !isProgressorView;

  async function toggle() {
    setLoading(true);
    await onToggle(task.id, isDone ? "open" : "done");
    setLoading(false);
  }

  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "12px 16px",
        borderBottom: hasBorder ? "0.5px solid var(--agent-border-subtle)" : "none",
      }}
    >
      {/* Toggle — wrapper div aligns circle with first text line */}
      <div style={{ flexShrink: 0, marginTop: 0 }}>
        <button
          onClick={toggle}
          disabled={loading}
          aria-label={isDone ? "Reopen" : "Mark as done"}
          className="agent-circle-btn"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: 18, height: 18, borderRadius: "50%",
            border: isDone && !loading ? "none" : `1.5px solid ${loading ? "var(--agent-border-default)" : hovered && !isDone ? "var(--agent-success)" : progressor ? "var(--agent-warning)" : "var(--agent-info-border)"}`,
            background: isDone && !loading ? "var(--agent-success)" : "transparent",
            cursor: loading ? "wait" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 150ms",
            position: "relative",
          }}
        >
          {loading ? (
            <div style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid var(--agent-border-default)", borderTopColor: "var(--agent-text-secondary)", animation: "agent-spin 700ms linear infinite" }} />
          ) : isDone ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              className={`todo-hover-tick${hovered ? " todo-hover-tick-show" : ""}`}
              width="10" height="10" viewBox="0 0 24 24"
              fill="none" stroke="var(--agent-success)"
              strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute" }}
            >
              <polyline className="todo-tick-path" points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 13, lineHeight: "1.4",
          fontWeight: isDone ? 400 : 500,
          color: isDone ? "var(--agent-text-muted)" : "var(--agent-text-primary)",
          textDecoration: isDone ? "line-through" : "none",
        }}>
          {task.title}
        </p>
        {task.notes && (
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--agent-text-muted)", lineHeight: "1.4" }}>
            {task.notes}
          </p>
        )}
        {/* The saved note. In the agent↔progressor requests section it's the
            progressor's reply (amber "Your progressor"); everywhere else it's a
            plain "Latest update" — the note you add when you reschedule (#274). */}
        {task.progressorNote && (
          noteIsProgressorReply ? (
            <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "var(--agent-warning-bg)", borderLeft: "2px solid var(--agent-warning-border)" }}>
              <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--agent-warning)" }}>
                Your progressor{task.progressorNoteAt ? ` · ${fmtDate(task.progressorNoteAt)}` : ""}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--agent-warning)", lineHeight: "1.4" }}>
                {task.progressorNote}
              </p>
            </div>
          ) : (
            <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "var(--agent-surface-subtle, rgba(0,0,0,0.03))", borderLeft: "2px solid var(--agent-border-default)" }}>
              <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
                Latest update{task.progressorNoteAt ? ` · ${fmtDate(task.progressorNoteAt)}` : ""}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: "1.4" }}>
                {task.progressorNote}
              </p>
            </div>
          )
        )}
      </div>

      {/* Due date — click to reschedule + add an update (open tasks); created
          date otherwise (#274). */}
      <div style={{ flexShrink: 0, textAlign: "right", marginTop: 2 }}>
        {onReschedule && !isDone ? (
          <Popover
            preset="popover"
            width={244}
            placement="bottom-end"
            trigger={
              <button
                type="button"
                onClick={openResched}
                title="Reschedule and add an update"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "right" }}
              >
                {dueStatus ? (
                  <span style={{ fontSize: 11, fontWeight: 600, color: dueStatus.color }}>{dueStatus.label}</span>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--agent-text-muted)", textDecoration: "underline", textUnderlineOffset: 2 }}>Set date</span>
                )}
              </button>
            }
          >
            {(close) => (
              <div style={{ textAlign: "left" }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--agent-text-muted)", marginBottom: 5 }}>
                  New date
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="agent-focus"
                  style={{ width: "100%", fontSize: 12, padding: "6px 8px", borderRadius: 8, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface, #fff)", color: "var(--agent-text-primary)", boxSizing: "border-box" }}
                />
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--agent-text-muted)", margin: "10px 0 5px" }}>
                  Update <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                </label>
                <textarea
                  value={updateText}
                  onChange={(e) => setUpdateText(e.target.value)}
                  placeholder="What's happened?"
                  rows={2}
                  className="agent-focus"
                  style={{ width: "100%", fontSize: 12, lineHeight: 1.45, padding: "6px 8px", borderRadius: 8, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface, #fff)", color: "var(--agent-text-secondary)", resize: "vertical", boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}>
                  <button type="button" onClick={close} className="agent-btn agent-btn-neutral agent-btn-sm">Cancel</button>
                  <button type="button" onClick={async () => { await saveResched(); close(); }} disabled={!newDate || savingResched} className="agent-btn agent-btn-primary agent-btn-sm">
                    {savingResched ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            )}
          </Popover>
        ) : dueStatus ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: dueStatus.color }}>{dueStatus.label}</span>
        ) : (
          <span style={{ fontSize: 11, color: "var(--agent-text-disabled)" }}>{fmtDate(task.createdAt)}</span>
        )}
        {progressor && dueStatus?.reassure && !isProgressorView && (
          <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--agent-text-muted)", lineHeight: 1.3 }}>
            {progressorName ?? "Our team"} is on it
          </p>
        )}
      </div>
    </div>
  );
}
