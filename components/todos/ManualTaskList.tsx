"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ManualTaskCard } from "./ManualTaskCard";
import { AddManualTaskForm } from "./AddManualTaskForm";
import type { ManualTaskWithRelations } from "@/lib/services/manual-tasks";

export function ManualTaskList({
  initialTasks,
  transactionId,
  transactionAddress,
  showDone = true,
}: {
  initialTasks: ManualTaskWithRelations[];
  transactionId?: string;
  transactionAddress?: string;
  showDone?: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState<"open" | "all">("open");

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
    setTasks((prev) => [task, ...prev]);
    router.refresh();
  }

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

  async function handleDelete(id: string) {
    const res = await fetch(`/api/manual-tasks/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const open = tasks.filter((t) => t.status === "open");
  const done = tasks.filter((t) => t.status === "done");
  const visible = filter === "open" ? open : tasks;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-900/80">
            To-Do
            {open.length > 0 && (
              <span className="ml-2 text-xs font-medium bg-blue-50/80 text-blue-600 px-2 py-0.5 rounded-full">
                {open.length}
              </span>
            )}
          </h2>
          {showDone && done.length > 0 && (
            <button
              onClick={() => setFilter(filter === "open" ? "all" : "open")}
              className="text-xs text-slate-900/40 hover:text-slate-900/70"
            >
              {filter === "open" ? `Show ${done.length} done` : "Hide done"}
            </button>
          )}
        </div>
        <AddManualTaskForm
          transactionId={transactionId}
          transactionAddress={transactionAddress}
          onAdd={handleAdd}
        />
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-900/30">
          {filter === "open" ? "Nothing to do — nice." : "No tasks yet."}
        </div>
      ) : (
        <div className="space-y-2">
          {open.map((task) => (
            <ManualTaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
          {filter === "all" && done.length > 0 && (
            <>
              <div className="text-xs text-slate-900/30 font-medium pt-2 pb-1">Done</div>
              {done.map((task) => (
                <ManualTaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
