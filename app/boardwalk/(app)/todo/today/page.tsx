"use client";

// Today — the everyday workspace. Compact header (date + live counts),
// overdue block with one-click rescue, today's tasks grouped by priority
// with scheduled times right-aligned, and a quiet completed-today foldout.

import { useEffect, useMemo, useState } from "react";
import { Sun, CircleCheck, ChevronDown, CalendarRange } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTodo } from "@/components/boardwalk/todo/TodoProvider";
import { TaskList, TaskRow } from "@/components/boardwalk/todo/TaskList";
import { EmptyNote, ViewHeader, ViewShell } from "@/components/boardwalk/todo/ViewHeader";
import { todayInLondon } from "@/lib/todo/recurrence";
import { BwButton } from "@/components/boardwalk/ui";

export default function TodayPage() {
  const todo = useTodo();
  const router = useRouter();
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
        title="Today"
        meta={
          tasks === undefined
            ? dateLabel
            : `${dateLabel} · ${dueToday.length} due${overdue.length ? ` · ${overdue.length} overdue` : ""}${doneToday.length ? ` · ${doneToday.length} done` : ""}`
        }
        actions={
          <BwButton size="sm" variant="primary" onClick={() => todo.openQuickAdd({ dueDate: today })}>
            + Add task
          </BwButton>
        }
      />

      {overdue.length > 0 && (
        <section style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 1 }}>
            <p className="bw-kicker" style={{ fontSize: 10, margin: 0, color: "var(--bw-red)" }}>Overdue · {overdue.length}</p>
            <button
              className="bw-btn bw-btn-ghost bw-btn-sm"
              style={{ height: 24, fontSize: 11.5 }}
              onClick={() => void todo.bulkPatch(overdue.map((t) => t.id), { dueDate: today })}
            >
              Move all to today
            </button>
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
        showTimeRight
        inlineAddDefaults={{ dueDate: today }}
        emptyState={
          tasks === undefined ? (
            <p className="bw-hint" style={{ padding: "22px 14px" }}>Loading your day…</p>
          ) : overdue.length === 0 ? (
            <EmptyNote
              icon={<Sun size={17} />}
              title="All clear for today."
              hint="Nothing due. Add a task below, or look ahead to what's coming."
              action={
                <BwButton size="sm" onClick={() => router.push("/boardwalk/todo/upcoming")}>
                  <CalendarRange size={12} /> Upcoming
                </BwButton>
              }
            />
          ) : null
        }
      />

      {doneToday.length > 0 && (
        <section style={{ marginTop: 18 }}>
          <button
            onClick={() => setShowDone((s) => !s)}
            style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", cursor: "pointer", padding: "4px 0", fontFamily: "var(--bw-font-sans)" }}
          >
            <CircleCheck size={13} style={{ color: "var(--bw-sage-ink)" }} />
            <span className="bw-kicker" style={{ fontSize: 10 }}>Completed today · {doneToday.length}</span>
            <ChevronDown size={11} style={{ color: "var(--bw-ink-faint)", transform: showDone ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }} />
          </button>
          {showDone && doneToday.map((t) => <TaskRow key={t.id} task={t} viewKey="completed" showProject />)}
        </section>
      )}
    </ViewShell>
  );
}
