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

// Sort: due date asc (nulls last), then createdAt asc
function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (ad !== bd) return ad - bd;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
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
  // Transactions first, general (null) last
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

  const ownTasks  = tasks.filter((t) => !t.isAgentRequest);
  const progTasks = tasks.filter((t) => t.isAgentRequest);

  const ownOpen  = sortTasks(ownTasks.filter((t) => t.status === "open"));
  const ownDone  = sortTasks(ownTasks.filter((t) => t.status === "done"));
  const progOpen = sortTasks(progTasks.filter((t) => t.status === "open"));
  const progDone = sortTasks(progTasks.filter((t) => t.status === "done"));

  return (
    <div className="space-y-8">

      <AddManualTaskForm showOwnership onAdd={handleAdd} />

      {/* ── My To-Dos ── */}
      <Section
        title="To-Do"
        openGroups={groupByTransaction(ownOpen)}
        doneGroups={groupByTransaction(ownDone)}
        doneCount={ownDone.length}
        showDone={showOwnDone}
        onToggleShowDone={() => setShowOwnDone((v) => !v)}
        onToggle={handleToggle}
        emptyLabel="Nothing to do — nice."
      />

      {/* ── With Sales Progressor ── */}
      {(progTasks.length > 0) && (
        <Section
          title="With Sales Progressor"
          openGroups={groupByTransaction(progOpen)}
          doneGroups={groupByTransaction(progDone)}
          doneCount={progDone.length}
          showDone={showProgDone}
          onToggleShowDone={() => setShowProgDone((v) => !v)}
          onToggle={handleToggle}
          emptyLabel="No pending requests."
          progressor
        />
      )}

    </div>
  );
}

function Section({
  title, openGroups, doneGroups, doneCount, showDone,
  onToggleShowDone, onToggle, emptyLabel, progressor = false,
}: {
  title: string;
  openGroups: Group[];
  doneGroups: Group[];
  doneCount: number;
  showDone: boolean;
  onToggleShowDone: () => void;
  onToggle: (id: string, status: "open" | "done") => void;
  emptyLabel: string;
  progressor?: boolean;
}) {
  const openCount = openGroups.reduce((n, g) => n + g.tasks.length, 0);

  return (
    <div className="space-y-3">
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

      {/* Open groups */}
      {openGroups.length === 0 ? (
        <div className="glass-card" style={{ padding: "24px 20px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>{emptyLabel}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {openGroups.map((group) => (
            <TaskGroup key={group.transactionId ?? "_general"} group={group} onToggle={onToggle} progressor={progressor} />
          ))}
        </div>
      )}

      {/* Done toggle */}
      {doneCount > 0 && (
        <div style={{ marginTop: 4 }}>
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
      {/* Group header */}
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
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-muted)" }}>General</span>
        )}
      </div>

      {/* Tasks */}
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
  const now = new Date();
  const isOverdue = !isDone && task.dueDate && new Date(task.dueDate) < now;

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
      {/* Toggle */}
      <button
        onClick={toggle}
        disabled={loading}
        aria-label={isDone ? "Mark as open" : "Mark as done"}
        style={{
          flexShrink: 0, marginTop: 2,
          width: 18, height: 18, borderRadius: "50%",
          border: isDone ? "none" : `1.5px solid ${progressor ? "var(--agent-warning)" : "rgba(37,99,235,0.40)"}`,
          background: isDone ? "var(--agent-success)" : "transparent",
          cursor: loading ? "wait" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 150ms",
        }}
      >
        {isDone && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

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
      </div>

      {/* Due date or created date */}
      <div style={{ flexShrink: 0, textAlign: "right", marginTop: 2 }}>
        {task.dueDate && !isDone ? (
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: isOverdue ? "var(--agent-danger)" : "var(--agent-text-muted)",
          }}>
            {isOverdue ? "Overdue · " : "Due "}{fmtDate(task.dueDate)}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "var(--agent-text-disabled)" }}>
            {fmtDate(task.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}
