"use client";

// A built-in smart filter, run live against the real filter engine and wired
// into the optimistic task cache like every other view.

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { useTodo } from "@/components/boardwalk/todo/TodoProvider";
import { TaskList } from "@/components/boardwalk/todo/TaskList";
import { EmptyNote, ViewHeader, ViewShell } from "@/components/boardwalk/todo/ViewHeader";
import { getSmartFilter } from "@/components/boardwalk/todo/smartFilters";

export default function SmartFilterPage() {
  const todo = useTodo();
  const params = useParams<{ key: string }>();
  const smart = getSmartFilter(params.key);
  const viewKey = `smart:${params.key}`;
  const tasks = todo.views[viewKey];

  useEffect(() => {
    if (smart && todo.ready) void todo.loadView(viewKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, todo.ready]);

  if (!smart) {
    return (
      <ViewShell>
        <EmptyNote icon={<SlidersHorizontal size={18} />} title="Filter not found" hint="Pick one from Filters & labels instead." />
      </ViewShell>
    );
  }

  return (
    <ViewShell>
      <ViewHeader title={smart.name} meta={tasks === undefined ? "Loading…" : `${tasks.length} task${tasks.length === 1 ? "" : "s"} · ${smart.hint}`} />
      <TaskList
        viewKey={viewKey}
        tasks={tasks ?? []}
        showProject
        emptyState={tasks !== undefined ? <EmptyNote icon={<SlidersHorizontal size={18} />} title="Nothing here right now." hint={smart.hint} /> : null}
      />
    </ViewShell>
  );
}
