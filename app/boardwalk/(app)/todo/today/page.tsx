"use client";

// Today — overdue first (with reschedule-all), then today's tasks grouped by
// time/priority, then a collapsed look at what was completed today.

import { useEffect, useMemo, useState } from "react";
import { Sun, CircleCheck, ChevronDown } from "lucide-react";
import { useTodo } from "@/components/boardwalk/todo/TodoProvider";
import { TaskList, TaskRow } from "@/components/boardwalk/todo/TaskList";
import { EmptyNote, ViewHeader, ViewShell } from "@/components/boardwalk/todo/ViewHeader";
import { todayInLondon } from "@/lib/todo/recurrence";
import { BwButton } from "@/components/boardwalk/ui";

export default function TodayPage() {
  const todo = useTodo();
  const [showDone, setShowDone] = useState(false);
  const today = todayInLondon();
  const viewKey = "today";
  const tasks = todo.views[viewKey];

  useEffect(() => {
    void todo.loadView(viewKey);
    void todo.loadView("completed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overdue = useMemo(() => (tasks ?? []).filter((t) => t.dueDate && t.dueDate < today && !t.completedAt), [tasks, today]);
  const dueToday = useMemo(() => (tasks ?? []).filter((t) => t.dueDate === today && !t.completedAt), [tasks, today]);
  const doneToday = useMemo(
    () => (todo.views["completed"] ?? []).filter((t) => t.completedAt && t.completedAt.slice(0, 10) === new Date().toISOString().slice(0, 10)),
    [todo.views]
  );

  const dateLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <ViewShell>
      <ViewHeader
        kicker="Today"
        title={dateLabel}
        meta={
          tasks === undefined
            ? "Loading…"
            : `${dueToday.length} due today${overdue.length ? ` · ${overdue.length} overdue` : ""}${doneToday.length ? ` · ${doneToday.length} done` : ""}`
        }
      />

      {overdue.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
            <p className="bw-kicker" style={{ fontSize: 10.5, margin: 0, color: "var(--bw-red)" }}>Overdue · {overdue.length}</p>
            <BwButton size="sm" variant="ghost" onClick={() => void todo.bulkPatch(overdue.map((t) => t.id), { dueDate: today })}>
              Move all to today
            </BwButton>
          </div>
          {overdue.map((t) => (
            <TaskRow key={t.id} task={t} viewKey={viewKey} showProject />
          ))}
        </section>
      )}

      <TaskList
        viewKey={viewKey}
        tasks={dueToday}
        groupBy="priority"
        showProject
        inlineAddDefaults={{ dueDate: today }}
        emptyState={
          tasks === undefined ? (
            <p className="bw-hint" style={{ padding: 30, textAlign: "center" }}>Loading your day…</p>
          ) : overdue.length === 0 ? (
            <EmptyNote icon={<Sun size={22} />} title="A clear day." hint="Nothing due today. Add a task below, or enjoy the quiet." />
          ) : null
        }
      />

      {doneToday.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <button
            onClick={() => setShowDone((s) => !s)}
            style={{ display: "flex", alignItems: "center", gap: 7, border: "none", background: "transparent", cursor: "pointer", padding: "4px 0", fontFamily: "var(--bw-font-sans)" }}
          >
            <CircleCheck size={14} style={{ color: "var(--bw-sage-ink)" }} />
            <span className="bw-kicker" style={{ fontSize: 10.5 }}>Completed today · {doneToday.length}</span>
            <ChevronDown size={12} style={{ color: "var(--bw-ink-faint)", transform: showDone ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }} />
          </button>
          {showDone && doneToday.map((t) => <TaskRow key={t.id} task={t} viewKey="completed" showProject />)}
        </section>
      )}
    </ViewShell>
  );
}
