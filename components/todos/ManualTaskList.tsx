"use client";

import { useState } from "react";
import { ManualTaskCard } from "./ManualTaskCard";
import { AddManualTaskForm } from "./AddManualTaskForm";
import { useTabBadge } from "@/components/transaction/PropertyFileTabs";
import type { ManualTaskWithRelations } from "@/lib/services/manual-tasks";

function AgentRequestRow({ task }: { task: ManualTaskWithRelations }) {
  const isDone = task.status === "done";
  return (
    <div className={`glass-card px-4 py-3.5 flex items-center gap-3 ${isDone ? "opacity-75" : ""}`}>
      <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
        isDone ? "bg-emerald-500" : "border-2 border-amber-300 bg-amber-50"
      }`}>
        {isDone ? (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <div className="w-2 h-2 rounded-full bg-amber-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${isDone ? "line-through text-slate-900/35" : "text-slate-900/80"}`}>
          {task.title}
        </p>
        {isDone && (
          <p className="text-xs text-emerald-600 font-medium mt-0.5">✓ Taken care of</p>
        )}
      </div>
    </div>
  );
}

export function ManualTaskList({
  initialTasks,
  transactionId,
  transactionAddress,
  showDone = true,
  perspective = "progressor",
}: {
  initialTasks: ManualTaskWithRelations[];
  transactionId?: string;
  transactionAddress?: string;
  showDone?: boolean;
  perspective?: "agent" | "progressor";
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [showAgentDone, setShowAgentDone] = useState(false);
  const updateBadge = useTabBadge();

  async function handleAdd(data: {
    title: string;
    notes?: string;
    dueDate?: string;
    transactionId?: string;
  }) {
    const res = await fetch("/api/manual-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      console.error("Failed to save to-do:", res.status, await res.text());
      return;
    }
    const task = await res.json();
    const newTasks = [task, ...tasks];
    setTasks(newTasks);
    updateBadge?.("todos", newTasks.filter((t) => t.status === "open").length);
  }

  async function handleToggle(id: string, newStatus: "open" | "done") {
    const res = await fetch(`/api/manual-tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    const newTasks = tasks.map((t) => (t.id === id ? updated : t));
    setTasks(newTasks);
    updateBadge?.("todos", newTasks.filter((t) => t.status === "open").length);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/manual-tasks/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    const newTasks = tasks.filter((t) => t.id !== id);
    setTasks(newTasks);
    updateBadge?.("todos", newTasks.filter((t) => t.status === "open").length);
  }

  const myTasks   = tasks.filter((t) => !t.isAgentRequest);
  const agentTasks = tasks.filter((t) => t.isAgentRequest);

  const myOpen  = myTasks.filter((t) => t.status === "open");
  const myDone  = myTasks.filter((t) => t.status === "done");
  const myVisible = filter === "open" ? myOpen : myTasks;

  const agentOpen = agentTasks.filter((t) => t.status === "open");
  const agentDone = agentTasks.filter((t) => t.status === "done");

  return (
    <div className="space-y-6">
      {/* ── My to-dos ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between glass-subtle px-4 py-3 rounded-xl">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-900/80">
              To-Do
              {myOpen.length > 0 && (
                <span className="ml-2 text-xs font-medium bg-blue-50/80 text-blue-600 px-2 py-0.5 rounded-full">
                  {myOpen.length}
                </span>
              )}
            </h2>
            {showDone && myDone.length > 0 && (
              <button
                onClick={() => setFilter(filter === "open" ? "all" : "open")}
                className="text-xs text-slate-900/40 hover:text-slate-900/70"
              >
                {filter === "open" ? `Show ${myDone.length} done` : "Hide done"}
              </button>
            )}
          </div>
          <AddManualTaskForm
            transactionId={transactionId}
            transactionAddress={transactionAddress}
            onAdd={handleAdd}
          />
        </div>

        {myVisible.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-900/30">
            {filter === "open" ? "Nothing to do — nice." : "No tasks yet."}
          </div>
        ) : (
          <div className="space-y-2">
            {myOpen.map((task) => (
              <ManualTaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
            {filter === "all" && myDone.length > 0 && (
              <>
                <div className="text-xs text-slate-900/30 font-medium pt-2 pb-1">Done</div>
                {myDone.map((task) => (
                  <ManualTaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Agent requests / With Sales Progressor ── */}
      {agentTasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h2 className="text-sm font-semibold text-slate-900/80">
              {perspective === "agent" ? "With Sales Progressor" : "Agent requests"}
              {agentOpen.length > 0 && (
                <span className="ml-2 text-xs font-medium bg-amber-100/80 text-amber-700 px-2 py-0.5 rounded-full">
                  {agentOpen.length}
                </span>
              )}
            </h2>
            {agentDone.length > 0 && (
              <button
                onClick={() => setShowAgentDone((v) => !v)}
                className="ml-auto text-xs text-slate-900/40 hover:text-slate-900/70"
              >
                {showAgentDone ? "Hide resolved" : `Show ${agentDone.length} resolved`}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {agentOpen.map((task) => (
              perspective === "agent"
                ? <AgentRequestRow key={task.id} task={task} />
                : <ManualTaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
            {showAgentDone && agentDone.length > 0 && (
              <>
                <div className="text-xs text-slate-900/30 font-medium pt-2 pb-1">
                  {perspective === "agent" ? "Resolved" : "Resolved"}
                </div>
                {agentDone.map((task) => (
                  perspective === "agent"
                    ? <AgentRequestRow key={task.id} task={task} />
                    : <ManualTaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
                ))}
              </>
            )}
            {agentOpen.length === 0 && !showAgentDone && (
              <div className="text-center py-4 text-sm text-slate-900/30">
                {perspective === "agent" ? "Nothing pending with us." : "All agent requests resolved."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
