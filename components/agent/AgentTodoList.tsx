"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react";
import type { ManualTaskWithRelations } from "@/lib/services/manual-tasks";
import { AddManualTaskForm } from "@/components/todos/AddManualTaskForm";

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

export function AgentTodoList({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [showOwnDone, setShowOwnDone] = useState(false);
  const [showProgDone, setShowProgDone] = useState(false);

  async function handleToggle(id: string, newStatus: "open" | "done") {
    const res = await fetch(`/api/manual-tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function handleAdd(input: {
    title: string;
    notes?: string;
    dueDate?: string;
    transactionId?: string;
    isAgentRequest?: boolean;
  }) {
    const res = await fetch("/api/manual-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return;
    const created = await res.json();
    setTasks((prev) => [created, ...prev]);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ownTasks  = tasks.filter((t) => !t.isAgentRequest);
  const progTasks = tasks.filter((t) =>  t.isAgentRequest);

  const ownOpen  = sortTasks(ownTasks.filter((t) => t.status === "open"));
  const ownDone  = sortTasks(ownTasks.filter((t) => t.status === "done"));
  const progOpen = sortTasks(progTasks.filter((t) => t.status === "open"));
  const progDone = sortTasks(progTasks.filter((t) => t.status === "done"));

  const ownOverdue   = ownOpen.filter((t) => t.dueDate && new Date(t.dueDate) < today);
  const ownUpcoming  = ownOpen.filter((t) => !t.dueDate || new Date(t.dueDate) >= today);
  const progOverdue  = progOpen.filter((t) => t.dueDate && new Date(t.dueDate) < today);
  const progUpcoming = progOpen.filter((t) => !t.dueDate || new Date(t.dueDate) >= today);

  if (tasks.length === 0) {
    return (
      <div className="space-y-8">
        <AddManualTaskForm showOwnership onAdd={handleAdd} />
        <div className="glass-card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--agent-text-muted)" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 16px", display: "block", opacity: 0.45 }}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>Nothing here yet.</p>
          <p style={{ margin: "0 auto", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 340, lineHeight: 1.5 }}>
            Add a task or send your progressor a request.
          </p>
        </div>

        {/* Ghost to-do section preview — abstract skeleton bars only, no fake content */}
        <div style={{ opacity: 0.35, pointerEvents: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px", marginBottom: 12 }}>
            <div className="agent-skeleton" style={{ width: 60, height: 13, borderRadius: 4 }} />
            <div className="agent-skeleton" style={{ width: 20, height: 18, borderRadius: 99 }} />
          </div>
          <div className="glass-card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
              <div className="agent-skeleton" style={{ width: 150, height: 13, borderRadius: 4 }} />
            </div>
            {[100, 140].map((w, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                borderBottom: i === 0 ? "0.5px solid var(--agent-border-subtle)" : "none",
              }}>
                <div className="agent-skeleton" style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0 }} />
                <div className="agent-skeleton" style={{ flex: 1, height: 13, borderRadius: 4, maxWidth: w }} />
                <div className="agent-skeleton" style={{ width: 36, height: 11, borderRadius: 4, flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AddManualTaskForm showOwnership onAdd={handleAdd} />

      {/* ── My to-dos ── */}
      <Section
        id="section-mine"
        title="My to-dos"
        overdueGroups={groupByTransaction(ownOverdue)}
        openGroups={groupByTransaction(ownUpcoming)}
        doneGroups={groupByTransaction(ownDone)}
        doneCount={ownDone.length}
        showDone={showOwnDone}
        onToggleShowDone={() => setShowOwnDone((v) => !v)}
        onToggle={handleToggle}
      />

      {/* ── With your progressor ── */}
      {progTasks.length > 0 && (
        <Section
          id="section-progressor"
          title="With your progressor"
          overdueGroups={groupByTransaction(progOverdue)}
          openGroups={groupByTransaction(progUpcoming)}
          doneGroups={groupByTransaction(progDone)}
          doneCount={progDone.length}
          showDone={showProgDone}
          onToggleShowDone={() => setShowProgDone((v) => !v)}
          onToggle={handleToggle}
          progressor
        />
      )}
    </div>
  );
}

function Section({
  id, title, overdueGroups, openGroups, doneGroups, doneCount, showDone,
  onToggleShowDone, onToggle, progressor = false,
}: {
  id: string;
  title: string;
  overdueGroups: Group[];
  openGroups: Group[];
  doneGroups: Group[];
  doneCount: number;
  showDone: boolean;
  onToggleShowDone: () => void;
  onToggle: (id: string, status: "open" | "done") => void;
  progressor?: boolean;
}) {
  const openCount = overdueGroups.reduce((n, g) => n + g.tasks.length, 0)
    + openGroups.reduce((n, g) => n + g.tasks.length, 0);

  const hasOpen = overdueGroups.length > 0 || openGroups.length > 0;

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
            background: progressor ? "var(--agent-warning-bg)" : "var(--agent-info-bg)",
            color: progressor ? "var(--agent-warning)" : "var(--agent-info)",
            border: `1px solid ${progressor ? "var(--agent-warning-border)" : "var(--agent-info-border)"}`,
          }}>
            {openCount}
          </span>
        )}
      </div>

      {/* Overdue sub-group */}
      {overdueGroups.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: openGroups.length > 0 ? 8 : 0 }}>
          {overdueGroups.map((group) => (
            <TaskGroup key={group.transactionId ?? "_general"} group={group} onToggle={onToggle} progressor={progressor} overdue />
          ))}
        </div>
      )}

      {/* Upcoming / open groups */}
      {!hasOpen ? (
        <div className="glass-card" style={{ padding: "28px 20px", textAlign: "center" }}>
          {progressor ? (
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-muted)" }}>All caught up.</p>
          ) : (
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-muted)" }}>All clear.</p>
          )}
        </div>
      ) : openGroups.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {openGroups.map((group) => (
            <TaskGroup key={group.transactionId ?? "_general"} group={group} onToggle={onToggle} progressor={progressor} />
          ))}
        </div>
      ) : null}

      {/* Done toggle */}
      {doneCount > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={onToggleShowDone}
            className="agent-link agent-link-muted"
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}
          >
            <CaretDown size={12} style={{ transition: "transform 200ms", transform: showDone ? "rotate(180deg)" : "rotate(0deg)" }} />
            {showDone ? "Hide completed" : `Show ${doneCount} completed`}
          </button>

          <div className={`agent-acc${showDone ? " open" : ""}`}>
            <div className="agent-acc-in" style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 10 }}>
              {doneGroups.map((group) => (
                <TaskGroup key={group.transactionId ?? "_general"} group={group} onToggle={onToggle} dimmed progressor={progressor} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskGroup({ group, onToggle, dimmed = false, progressor = false, overdue = false }: {
  group: Group;
  onToggle: (id: string, status: "open" | "done") => void;
  dimmed?: boolean;
  progressor?: boolean;
  overdue?: boolean;
}) {
  return (
    <div className="glass-card" style={{ overflow: "hidden", opacity: dimmed ? 0.7 : 1, boxShadow: overdue ? "inset 3px 0 0 var(--agent-danger)" : undefined }}>
      <div style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
        {group.transactionId ? (
          <Link
            href={`/agent/transactions/${group.transactionId}`}
            style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", textDecoration: "none" }}
            className="hover:underline"
          >
            {group.address ?? "Unknown address"}
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
          />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task, onToggle, hasBorder, progressor }: {
  task: Task;
  onToggle: (id: string, status: "open" | "done") => void;
  hasBorder: boolean;
  progressor: boolean;
}) {
  const isDone = task.status === "done";
  const [loading, setLoading] = useState(false);
  const dueStatus = task.dueDate && !isDone ? getDueStatus(task.dueDate) : null;

  async function toggle() {
    setLoading(true);
    await onToggle(task.id, isDone ? "open" : "done");
    setLoading(false);
  }

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "12px 16px",
      borderBottom: hasBorder ? "0.5px solid var(--agent-border-subtle)" : "none",
    }}>
      {/* Toggle — wrapper div expands tap area to ≥44px without changing visual size */}
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <button
          onClick={toggle}
          disabled={loading}
          aria-label={isDone ? "Reopen" : "Mark as done"}
          className="p-2 -m-2"
          style={{
            width: 18, height: 18, borderRadius: "50%",
            border: isDone && !loading ? "none" : `1.5px solid ${loading ? "var(--agent-border-default)" : progressor ? "var(--agent-warning)" : "var(--agent-info-border)"}`,
            background: isDone && !loading ? "var(--agent-success)" : "transparent",
            cursor: loading ? "wait" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 150ms",
          }}
        >
          {loading ? (
            <div style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid var(--agent-border-default)", borderTopColor: "var(--agent-text-secondary)", animation: "agent-spin 700ms linear infinite" }} />
          ) : isDone ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : null}
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
        {/* Progressor response — shown for open tasks (fix) and done tasks (resolved display) */}
        {task.progressorNote && (
          <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "var(--agent-warning-bg)", borderLeft: "2px solid var(--agent-warning-border)" }}>
            <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--agent-warning)" }}>
              Your progressor{task.progressorNoteAt ? ` · ${fmtDate(task.progressorNoteAt)}` : ""}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--agent-warning)", lineHeight: "1.4" }}>
              {task.progressorNote}
            </p>
          </div>
        )}
      </div>

      {/* Due date or created date */}
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
            {fmtDate(task.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}
