"use client";

import { useState } from "react";
import { ManualTaskCard } from "./ManualTaskCard";
import { AddManualTaskForm } from "./AddManualTaskForm";
import { useTabBadge } from "@/components/transaction/PropertyFileTabs";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { Card } from "@/components/ui/Card";
import type { ManualTaskWithRelations } from "@/lib/services/manual-tasks";

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function AgentRequestRow({ task }: { task: ManualTaskWithRelations }) {
  const isDone = task.status === "done";
  return (
    <div
      className={`px-4 py-2.5 flex items-start gap-3 ${isDone ? "opacity-70" : ""}`}
      style={{ borderBottom: "0.5px solid var(--agent-border-default)" }}
    >
      <div className={`mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${
        isDone ? "bg-emerald-500" : "bg-amber-100 border border-amber-300"
      }`}>
        {isDone ? (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p style={{
          fontSize: 12, fontWeight: 600,
          color: isDone ? "var(--agent-text-muted)" : "var(--agent-text-primary)",
          textDecoration: isDone ? "line-through" : "none",
          lineHeight: 1.4,
        }}>
          {task.title}
        </p>

        {task.notes && (
          <div className="mt-1.5 space-y-0.5">
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Your note · {timeAgo(task.createdAt)}
            </p>
            <p style={{ fontSize: 11, color: "var(--agent-text-secondary)", lineHeight: 1.45 }}>{task.notes}</p>
          </div>
        )}

        {task.progressorNote && (
          <div className="mt-1.5 space-y-0.5">
            <p style={{ fontSize: 10, fontWeight: 600, color: "#059669", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Sales Progressor · {task.progressorNoteAt ? timeAgo(task.progressorNoteAt) : ""}
            </p>
            <p style={{ fontSize: 11, color: "var(--agent-text-secondary)", lineHeight: 1.45 }}>{task.progressorNote}</p>
          </div>
        )}

        {isDone && !task.progressorNote && (
          <p style={{ fontSize: 11, color: "#059669", fontWeight: 500, marginTop: 4 }}>✓ Taken care of</p>
        )}
      </div>
    </div>
  );
}

export function ManualTaskList({
  initialTasks,
  initialInternalTasks = [],
  transactionId,
  transactionAddress,
  showDone = true,
  showOwnership = false,
  perspective = "progressor",
}: {
  initialTasks: ManualTaskWithRelations[];
  // Internal-self-assigned tasks for this transaction, visible to all
  // internal staff. Only passed when the viewer is internal.
  initialInternalTasks?: ManualTaskWithRelations[];
  transactionId?: string;
  transactionAddress?: string;
  showDone?: boolean;
  showOwnership?: boolean;
  perspective?: "agent" | "progressor";
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [internalTasks, setInternalTasks] = useState(initialInternalTasks);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [showAgentDone, setShowAgentDone] = useState(false);
  const [showInternalDone, setShowInternalDone] = useState(false);
  const updateBadge = useTabBadge();
  const { toast } = useAgentToast();

  function countForBadge(all: ManualTaskWithRelations[]) {
    return perspective === "progressor"
      ? all.filter((t) => t.status === "open" && t.isAgentRequest).length
      : all.filter((t) => t.status === "open").length;
  }

  async function handleAdd(data: {
    title: string;
    notes?: string;
    dueDate?: string;
    transactionId?: string;
    isAgentRequest?: boolean;
  }) {
    const tempId = `temp-${Date.now()}`;
    const optimistic: ManualTaskWithRelations = {
      id: tempId,
      title: data.title,
      notes: data.notes ?? null,
      progressorNote: null,
      progressorNoteAt: null,
      status: "open",
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      createdAt: new Date(),
      isAgentRequest: data.isAgentRequest ?? false,
      isInternalSelfAssigned: false,
      transactionId: data.transactionId ?? null,
      transaction: null,
      assignedTo: null,
      createdBy: { id: "", name: "" },
    };
    setTasks((prev) => [optimistic, ...prev]);
    updateBadge?.("todos", countForBadge(tasks) + (data.isAgentRequest ? 1 : 0));

    const res = await fetch("/api/manual-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      console.error("Failed to save to-do:", res.status, await res.text());
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      updateBadge?.("todos", countForBadge(tasks));
      return;
    }
    const saved = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === tempId ? saved : t)));
    toast.success("To-do added");
  }

  async function handleToggle(id: string, newStatus: "open" | "done") {
    const res = await fetch(`/api/manual-tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    if (updated.isInternalSelfAssigned) {
      setInternalTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } else {
      const newTasks = tasks.map((t) => (t.id === id ? updated : t));
      setTasks(newTasks);
      updateBadge?.("todos", countForBadge(newTasks));
    }
    if (newStatus === "done") toast.success("To-do completed");
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/manual-tasks/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    // Try both task lists — the row could be in either.
    setInternalTasks((prev) => prev.filter((t) => t.id !== id));
    const newTasks = tasks.filter((t) => t.id !== id);
    setTasks(newTasks);
    updateBadge?.("todos", countForBadge(newTasks));
    toast.success("To-do removed");
  }

  async function handleAddInternal(data: {
    title: string;
    notes?: string;
    dueDate?: string;
    transactionId?: string;
    isAgentRequest?: boolean;
  }) {
    const tempId = `temp-${Date.now()}`;
    const optimistic: ManualTaskWithRelations = {
      id: tempId,
      title: data.title,
      notes: data.notes ?? null,
      progressorNote: null,
      progressorNoteAt: null,
      status: "open",
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      createdAt: new Date(),
      isAgentRequest: false,
      isInternalSelfAssigned: true,
      transactionId: data.transactionId ?? null,
      transaction: null,
      assignedTo: null,
      createdBy: { id: "", name: "" },
    };
    setInternalTasks((prev) => [optimistic, ...prev]);

    const res = await fetch("/api/manual-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, isInternalSelfAssigned: true }),
    });
    if (!res.ok) {
      console.error("Failed to save internal to-do:", res.status, await res.text());
      setInternalTasks((prev) => prev.filter((t) => t.id !== tempId));
      return;
    }
    const saved = await res.json();
    setInternalTasks((prev) => prev.map((t) => (t.id === tempId ? saved : t)));
    toast.success("Internal to-do added");
  }

  const myTasks    = tasks.filter((t) => !t.isAgentRequest);
  const agentTasks = tasks.filter((t) => t.isAgentRequest);

  const myOpen  = myTasks.filter((t) => t.status === "open");
  const myDone  = myTasks.filter((t) => t.status === "done");
  const myVisible = filter === "open" ? myOpen : myTasks;

  const agentOpen = agentTasks.filter((t) => t.status === "open");
  const agentDone = agentTasks.filter((t) => t.status === "done");

  const myTasksCard = (
    <Card glassId="todo-main" glassLabel="To-Do · Main list" padding="none">
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "0.5px solid var(--agent-border-default)" }}
      >
        <div className="flex items-center gap-2">
          <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", margin: 0 }}>
            {perspective === "progressor" ? "Agent's to-do" : "To-Do"}
          </h3>
          {myOpen.length > 0 && <span className="agent-badge">{myOpen.length}</span>}
        </div>
        {perspective !== "progressor" && (
          <AddManualTaskForm
            transactionId={transactionId}
            transactionAddress={transactionAddress}
            showOwnership={showOwnership}
            onAdd={handleAdd}
          />
        )}
      </div>

      {myVisible.length === 0 ? (
        <div style={{ padding: "28px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--agent-text-muted)" }}>
            {filter === "open" ? "Nothing to do. Nice." : "No tasks yet."}
          </p>
        </div>
      ) : (
        <div>
          {myOpen.map((task) => (
            <ManualTaskCard key={task.id} task={task} isNew={task.id.startsWith("temp-")} onToggle={handleToggle} onDelete={handleDelete} readOnly={perspective === "progressor"} />
          ))}
          <div className={`agent-acc ${filter === "all" && myDone.length > 0 ? "open" : ""}`}>
            <div className="agent-acc-in">
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 16px 4px", borderTop: "0.5px solid var(--agent-border-default)" }}>
                Done
              </div>
              {myDone.map((task) => (
                <ManualTaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} readOnly={perspective === "progressor"} />
              ))}
            </div>
          </div>
        </div>
      )}

      {showDone && myDone.length > 0 && (
        <div style={{ padding: "8px 16px", borderTop: myVisible.length > 0 ? "none" : "0.5px solid var(--agent-border-default)" }}>
          <button
            onClick={() => setFilter(filter === "open" ? "all" : "open")}
            className="agent-link agent-link-muted"
            style={{ fontSize: 11 }}
          >
            {filter === "open" ? `Show ${myDone.length} done` : "Hide done"}
          </button>
        </div>
      )}
    </Card>
  );

  const agentRequestsCard = agentTasks.length > 0 ? (
    <Card glassId="todo-agent-requests" glassLabel="To-Do · Agent requests" padding="none">
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "0.5px solid var(--agent-border-default)" }}
      >
        <div className="flex items-center gap-2">
          <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", margin: 0 }}>
            {perspective === "agent" ? "With Sales Progressor" : "Agent requests"}
          </h3>
          {agentOpen.length > 0 && <span className="agent-badge">{agentOpen.length}</span>}
        </div>
        {agentDone.length > 0 && (
          <button
            onClick={() => setShowAgentDone((v) => !v)}
            className="agent-link agent-link-muted"
            style={{ fontSize: 11 }}
          >
            {showAgentDone ? "Hide resolved" : `Show ${agentDone.length} resolved`}
          </button>
        )}
      </div>

      <div>
        {agentOpen.map((task) => (
          perspective === "agent"
            ? <AgentRequestRow key={task.id} task={task} />
            : <ManualTaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
        ))}
        {showAgentDone && agentDone.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 16px 4px", borderTop: "0.5px solid var(--agent-border-default)" }}>
              Resolved
            </div>
            {agentDone.map((task) => (
              perspective === "agent"
                ? <AgentRequestRow key={task.id} task={task} />
                : <ManualTaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
          </>
        )}
        {agentOpen.length === 0 && !showAgentDone && (
          <div style={{ padding: "24px 16px", textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "var(--agent-text-muted)", fontStyle: "italic" }}>
              {perspective === "agent" ? "Nothing pending with us." : "All agent requests resolved."}
            </p>
          </div>
        )}
      </div>
    </Card>
  ) : null;

  const internalOpen = internalTasks.filter((t) => t.status === "open");
  const internalDone = internalTasks.filter((t) => t.status === "done");

  // Internal-self-assigned tasks card. Only rendered when the viewer is
  // internal staff (perspective="progressor" is used as the internal-staff
  // signal — see app/agent/transactions/[id]/page.tsx where perspective is
  // derived from isInternalStaff).
  const internalTasksCard = perspective === "progressor" ? (
    <Card glassId="todo-internal" glassLabel="To-Do · Internal list" padding="none">
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "0.5px solid var(--agent-border-default)" }}
      >
        <div className="flex items-center gap-2">
          <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", margin: 0 }}>
            Internal to-do
          </h3>
          {internalOpen.length > 0 && <span className="agent-badge">{internalOpen.length}</span>}
        </div>
        <AddManualTaskForm
          transactionId={transactionId}
          transactionAddress={transactionAddress}
          internalMode
          onAdd={handleAddInternal}
        />
      </div>

      {internalOpen.length === 0 && internalDone.length === 0 ? (
        <div style={{ padding: "20px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "var(--agent-text-muted)", fontStyle: "italic" }}>
            No internal to-dos on this file yet.
          </p>
        </div>
      ) : (
        <div>
          {internalOpen.map((task) => (
            <ManualTaskCard key={task.id} task={task} isNew={task.id.startsWith("temp-")} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
          {showInternalDone && internalDone.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 16px 4px", borderTop: "0.5px solid var(--agent-border-default)" }}>
                Done
              </div>
              {internalDone.map((task) => (
                <ManualTaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
              ))}
            </>
          )}
          {internalDone.length > 0 && (
            <div style={{ padding: "8px 16px", borderTop: internalOpen.length > 0 ? "none" : "0.5px solid var(--agent-border-default)" }}>
              <button
                onClick={() => setShowInternalDone((v) => !v)}
                className="agent-link agent-link-muted"
                style={{ fontSize: 11 }}
              >
                {showInternalDone ? "Hide done" : `Show ${internalDone.length} done`}
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  ) : null;

  return (
    <div className="space-y-4">
      {perspective === "progressor" ? (
        <>
          {internalTasksCard}
          {agentRequestsCard}
          {myTasksCard}
        </>
      ) : (
        <>
          {myTasksCard}
          {agentRequestsCard}
        </>
      )}
    </div>
  );
}
