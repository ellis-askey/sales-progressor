"use client";

import { useState } from "react";
import Link from "next/link";
import type { ManualTaskWithRelations } from "@/lib/services/manual-tasks";

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type Task = ManualTaskWithRelations;

type Group = {
  transactionId: string | null;
  address: string | null;
  tasks: Task[];
};

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
  // Transactions with tasks first, general (null) last
  return groups.sort((a, b) => {
    if (a.transactionId === null) return 1;
    if (b.transactionId === null) return -1;
    return 0;
  });
}

export function AgentTodoList({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [showResolved, setShowResolved] = useState(false);

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

  const open = tasks.filter((t) => t.status === "open");
  const done = tasks.filter((t) => t.status === "done");
  const openGroups = groupByTransaction(open);
  const doneGroups = groupByTransaction(done);

  return (
    <div className="space-y-6">
      {/* Open requests */}
      {open.length === 0 ? (
        <div className="glass-card" style={{ padding: "48px 32px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
            Nothing pending
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-muted)" }}>
            Requests you raise from a file will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {openGroups.map((group) => (
            <TaskGroup key={group.transactionId ?? "_general"} group={group} onToggle={handleToggle} />
          ))}
        </div>
      )}

      {/* Resolved toggle */}
      {done.length > 0 && (
        <div>
          <button
            onClick={() => setShowResolved((v) => !v)}
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
              {showResolved ? "▲" : "▼"}
            </span>
            {showResolved ? "Hide resolved" : `Show ${done.length} resolved`}
          </button>

          {showResolved && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 16 }}>
              {doneGroups.map((group) => (
                <TaskGroup key={group.transactionId ?? "_general"} group={group} onToggle={handleToggle} dimmed />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskGroup({ group, onToggle, dimmed = false }: {
  group: Group;
  onToggle: (id: string, status: "open" | "done") => void;
  dimmed?: boolean;
}) {
  return (
    <div className="glass-card" style={{ overflow: "hidden", opacity: dimmed ? 0.7 : 1 }}>
      {/* Group header */}
      <div style={{ padding: "12px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.35)" }}>
        {group.transactionId ? (
          <Link
            href={`/agent/transactions/${group.transactionId}`}
            style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", textDecoration: "none" }}
            className="hover:underline"
          >
            {group.address ?? "Unknown address"}
          </Link>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-muted)" }}>
            General
          </span>
        )}
      </div>

      {/* Tasks */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {group.tasks.map((task, i) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={onToggle}
            hasBorder={i < group.tasks.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task, onToggle, hasBorder }: {
  task: Task;
  onToggle: (id: string, status: "open" | "done") => void;
  hasBorder: boolean;
}) {
  const isDone = task.status === "done";
  const [loading, setLoading] = useState(false);

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
      {/* Toggle circle */}
      <button
        onClick={toggle}
        disabled={loading}
        aria-label={isDone ? "Mark as open" : "Mark as done"}
        style={{
          flexShrink: 0, marginTop: 2,
          width: 18, height: 18, borderRadius: "50%",
          border: isDone ? "none" : "1.5px solid var(--agent-warning)",
          background: isDone ? "var(--agent-success)" : "transparent",
          cursor: loading ? "wait" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 150ms, border-color 150ms",
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

      {/* Date */}
      <span style={{ flexShrink: 0, fontSize: 11, color: "var(--agent-text-disabled)", marginTop: 2 }}>
        {fmtDate(task.createdAt)}
      </span>
    </div>
  );
}
