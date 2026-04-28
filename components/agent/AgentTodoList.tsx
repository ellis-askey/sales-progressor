"use client";

import { useState } from "react";
import Link from "next/link";
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
        <div style={{ paddingTop: 48, textAlign: "center" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(15,23,42,0.18)" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 16px", display: "block" }}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: "rgba(15,23,42,0.35)" }}>Nothing here yet.</p>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(15,23,42,0.28)", maxWidth: 280, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
            Jot down your next steps, or send a request to your progressor.
          </p>
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

  const sectionHasRedOverdue = overdueGroups.some((g) =>
    g.tasks.some((t) => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate); due.setHours(0, 0, 0, 0);
      const now = new Date(); now.setHours(0, 0, 0, 0);
      return Math.floor((now.getTime() - due.getTime()) / 86400000) >= 4;
    })
  );

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
            background: progressor ? "var(--agent-warning-bg)" : "rgba(37,99,235,0.08)",
            color: progressor ? "var(--agent-warning)" : "#2563eb",
            border: `1px solid ${progressor ? "var(--agent-warning-border)" : "rgba(37,99,235,0.20)"}`,
          }}>
            {openCount}
          </span>
        )}
      </div>

      {/* Overdue sub-group */}
      {overdueGroups.length > 0 && (
        <div style={{ marginBottom: openGroups.length > 0 ? 8 : 0 }}>
          <p style={{ margin: "0 0 6px 2px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: sectionHasRedOverdue ? "#dc2626" : "var(--agent-warning)" }}>
            Overdue
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {overdueGroups.map((group) => (
              <TaskGroup key={group.transactionId ?? "_general"} group={group} onToggle={onToggle} progressor={progressor} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming / open groups */}
      {!hasOpen ? (
        <div className="glass-card" style={{ padding: "28px 20px", textAlign: "center" }}>
          {progressor ? (
            <>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-muted)" }}>No pending requests.</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-disabled)" }}>Anything you send to your progressor will appear here.</p>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-muted)" }}>All clear.</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-disabled)" }}>Use the button above to add a to-do or send a request.</p>
            </>
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
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: "var(--agent-text-muted)",
              padding: "4px 0", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <span style={{
              display: "inline-block", width: 16, height: 16,
              border: "1px solid var(--agent-text-muted)", borderRadius: 4,
              lineHeight: "14px", textAlign: "center", fontSize: 10,
            }}>
              {showDone ? "▲" : "▼"}
            </span>
            {showDone ? "Hide resolved" : `Show ${doneCount} resolved`}
          </button>

          {showDone && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {doneGroups.map((group) => (
                <TaskGroup key={group.transactionId ?? "_general"} group={group} onToggle={onToggle} dimmed progressor={progressor} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskGroup({ group, onToggle, dimmed = false, progressor = false }: {
  group: Group;
  onToggle: (id: string, status: "open" | "done") => void;
  dimmed?: boolean;
  progressor?: boolean;
}) {
  return (
    <div className="glass-card" style={{ overflow: "hidden", opacity: dimmed ? 0.7 : 1 }}>
      <div style={{ padding: "10px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.35)" }}>
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
      borderBottom: hasBorder ? "0.5px solid rgba(255,255,255,0.25)" : "none",
    }}>
      {/* Toggle — wrapper div expands tap area to ≥44px without changing visual size */}
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <button
          onClick={toggle}
          disabled={loading}
          aria-label={isDone ? "Mark as open" : "Mark as done"}
          className="p-2 -m-2"
          style={{
            width: 18, height: 18, borderRadius: "50%",
            border: isDone && !loading ? "none" : `1.5px solid ${loading ? "rgba(15,23,42,0.30)" : progressor ? "var(--agent-warning)" : "rgba(37,99,235,0.40)"}`,
            background: isDone && !loading ? "var(--agent-success)" : "transparent",
            cursor: loading ? "wait" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 150ms",
          }}
        >
          {loading ? (
            <div style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid rgba(15,23,42,0.20)", borderTopColor: "rgba(15,23,42,0.60)", animation: "agent-spin 700ms linear infinite" }} />
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
          <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "rgba(180,87,9,0.06)", borderLeft: "2px solid rgba(180,87,9,0.28)" }}>
            <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "rgba(180,87,9,0.65)" }}>
              Progressor{task.progressorNoteAt ? ` · ${fmtDate(task.progressorNoteAt)}` : ""}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#b45309", lineHeight: "1.4" }}>
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
