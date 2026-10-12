"use client";

// Completed history — most recent first, grouped by completion day, with
// one-click reopen (the row checkbox).

import { useEffect, useMemo } from "react";
import { CircleCheck } from "lucide-react";
import { useTodo } from "@/components/boardwalk/todo/TodoProvider";
import { TaskRow } from "@/components/boardwalk/todo/TaskList";
import { EmptyNote, ViewHeader, ViewShell } from "@/components/boardwalk/todo/ViewHeader";

export default function CompletedPage() {
  const todo = useTodo();
  const viewKey = "completed";
  const tasks = todo.views[viewKey];

  useEffect(() => {
    void todo.loadView(viewKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<typeof tasks>>();
    for (const t of tasks ?? []) {
      const day = t.completedAt?.slice(0, 10) ?? "";
      map.set(day, [...(map.get(day) ?? []), t]);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [tasks]);

  return (
    <ViewShell>
      <ViewHeader kicker="History" title="Completed" meta={tasks === undefined ? "Loading…" : `${tasks.length} recent completion${tasks.length === 1 ? "" : "s"}`} />
      {tasks !== undefined && tasks.length === 0 && (
        <EmptyNote icon={<CircleCheck size={22} />} title="Nothing completed yet." hint="Finished tasks land here, grouped by day, and can be reopened any time." />
      )}
      {groups.map(([day, list]) => (
        <section key={day} style={{ marginBottom: 10 }}>
          <p className="bw-kicker" style={{ fontSize: 10.5, margin: "16px 0 4px" }}>
            {new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
          </p>
          {list.map((t) => (
            <TaskRow key={t.id} task={t} viewKey={viewKey} showProject />
          ))}
        </section>
      ))}
    </ViewShell>
  );
}
