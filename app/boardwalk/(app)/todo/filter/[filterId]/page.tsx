"use client";

// A saved filter, run live.

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { useTodo } from "@/components/boardwalk/todo/TodoProvider";
import { TaskList } from "@/components/boardwalk/todo/TaskList";
import { EmptyNote, ViewHeader, ViewShell } from "@/components/boardwalk/todo/ViewHeader";

export default function FilterPage() {
  const todo = useTodo();
  const params = useParams<{ filterId: string }>();
  const filter = todo.filters.find((f) => f.id === params.filterId);
  const viewKey = `filter:${params.filterId}`;
  const tasks = todo.views[viewKey];

  useEffect(() => {
    if (todo.ready) void todo.loadView(viewKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, todo.ready]);

  if (todo.ready && !filter) {
    return (
      <ViewShell>
        <EmptyNote icon={<SlidersHorizontal size={22} />} title="Filter not found" hint="It may have been removed." />
      </ViewShell>
    );
  }

  return (
    <ViewShell>
      <ViewHeader kicker="Filter" title={filter?.name ?? "…"} meta={tasks === undefined ? "Loading…" : `${tasks.length} matching task${tasks.length === 1 ? "" : "s"}`} />
      <TaskList
        viewKey={viewKey}
        tasks={tasks ?? []}
        showProject
        emptyState={tasks !== undefined ? <EmptyNote icon={<SlidersHorizontal size={22} />} title="No matches right now." hint="Tasks that meet the conditions will appear here." /> : null}
      />
    </ViewShell>
  );
}
