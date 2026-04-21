"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TaskCard } from "@/components/tasks/TaskCard";
import { formatDate } from "@/lib/utils";
import type { WorkQueueTask, WorkQueueCounts, SnoozedItem } from "@/lib/services/tasks";

type Filter = "all" | "mine" | "overdue" | "escalated" | "snoozed";

type Props = {
  tasks: WorkQueueTask[];
  snoozedItems: SnoozedItem[];
  counts: WorkQueueCounts;
  currentUserId: string;
};

export function WorkQueue({ tasks, snoozedItems, counts, currentUserId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const filtered = tasks.filter((task) => {
    if (activeFilter === "mine") return task.assignedTo?.id === currentUserId || task.transaction.assignedUserId === currentUserId;
    if (activeFilter === "overdue") return new Date(task.dueDate) < today && task.status === "pending";
    if (activeFilter === "escalated") return task.priority === "escalated" && task.status === "pending";
    return task.status === "pending";
  });

  async function handleAction(taskId: string, action: "complete" | "snooze", snoozeHours?: number) {
    setLoadingId(taskId);
    try {
      await fetch("/api/reminders/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action, ...(snoozeHours ? { snoozeHours } : {}) }),
      });
      startTransition(() => router.refresh());
    } finally {
      setLoadingId(null);
    }
  }

  async function handleWakeup(logId: string) {
    setLoadingId(logId);
    try {
      await fetch("/api/reminders/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId, action: "wakeup" }),
      });
      startTransition(() => router.refresh());
    } finally {
      setLoadingId(null);
    }
  }

  const tabs: { value: Filter; label: string; count: number; color?: string }[] = [
    { value: "all",       label: "All tasks",  count: counts.pending },
    { value: "mine",      label: "Mine",        count: counts.mine },
    { value: "overdue",   label: "Overdue",     count: counts.overdue,   color: counts.overdue > 0 ? "text-orange-600" : undefined },
    { value: "escalated", label: "Escalated",   count: counts.escalated, color: counts.escalated > 0 ? "text-red-600" : undefined },
    { value: "snoozed",   label: "Snoozed",     count: counts.snoozed,   color: counts.snoozed > 0 ? "text-purple-600" : undefined },
  ];

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-5 glass-subtle p-1 w-fit">
        {tabs.map(({ value, label, count, color }) => {
          const isActive = activeFilter === value;
          return (
            <button key={value} onClick={() => setActiveFilter(value)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? value === "snoozed" ? "bg-purple-500 text-white shadow-sm" : "bg-blue-500 text-white shadow-sm"
                  : `${color ?? "text-slate-900/50"} hover:text-slate-900/70 hover:bg-white/40`
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-normal ${
                  isActive
                    ? value === "snoozed" ? "bg-purple-400 text-white" : "bg-blue-400 text-white"
                    : count > 0 && color
                    ? value === "snoozed" ? "bg-purple-100 text-purple-700" : "bg-red-100 text-red-700"
                    : "bg-white/30 text-slate-900/50"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Snoozed view */}
      {activeFilter === "snoozed" ? (
        snoozedItems.length === 0 ? (
          <div className="glass-card px-5 py-12 text-center">
            <p className="text-sm font-medium text-slate-900/60">No snoozed reminders</p>
            <p className="text-xs text-slate-900/40 mt-1">Snoozed tasks will reappear here automatically when they wake up</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {snoozedItems.map((item) => {
              const addressParts = item.transaction.propertyAddress.split(",");
              return (
                <div key={item.id} className="glass-card border-l-4 border-l-purple-400">
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <Link href={`/transactions/${item.transaction.id}`}
                          className="text-sm font-semibold text-slate-900/90 hover:text-blue-600 transition-colors leading-tight block truncate">
                          {addressParts[0].trim()}
                        </Link>
                        {addressParts.length > 1 && (
                          <p className="text-xs text-slate-900/40 truncate mt-0.5">{addressParts.slice(1).join(",").trim()}</p>
                        )}
                      </div>
                      <span className="text-xs font-medium px-2 py-1 rounded-lg flex-shrink-0 bg-purple-100/80 text-purple-700">
                        Wakes {formatDate(item.snoozedUntil)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-900/70 mb-3">{item.reminderRule.name.replace(/^Chase:\s*/i, "")}</p>
                    <div className="flex items-center gap-2 pt-3 border-t border-white/20">
                      <button onClick={() => handleWakeup(item.id)} disabled={loadingId === item.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-purple-200/60 text-purple-600 hover:bg-purple-50/60 disabled:opacity-40">
                        {loadingId === item.id ? "…" : "Wake up now"}
                      </button>
                      <Link href={`/transactions/${item.transaction.id}`} className="ml-auto text-xs text-blue-500 hover:text-blue-600 transition-colors">
                        View file →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Task list for all other filters */
        filtered.length === 0 ? (
          <div className="glass-card px-5 py-12 text-center">
            <div className="w-10 h-10 rounded-full bg-green-100/80 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-900/60">
              {activeFilter === "overdue" ? "No overdue tasks" :
               activeFilter === "escalated" ? "No escalated tasks" :
               activeFilter === "mine" ? "No tasks assigned to you" :
               "All caught up"}
            </p>
            <p className="text-xs text-slate-900/40 mt-1">
              {activeFilter === "all" ? "Tasks will appear here when reminders become due" : "Try a different filter"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onAction={handleAction}
                onChased={() => startTransition(() => router.refresh())}
                loading={loadingId === task.id || isPending}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
