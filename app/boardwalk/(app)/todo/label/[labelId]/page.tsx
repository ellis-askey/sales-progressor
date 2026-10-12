"use client";

// Every open task carrying one label, across projects.

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Tag } from "lucide-react";
import { useTodo } from "@/components/boardwalk/todo/TodoProvider";
import { TaskList } from "@/components/boardwalk/todo/TaskList";
import { EmptyNote, ViewHeader, ViewShell } from "@/components/boardwalk/todo/ViewHeader";

export default function LabelPage() {
  const todo = useTodo();
  const params = useParams<{ labelId: string }>();
  const label = todo.labels.find((l) => l.id === params.labelId);
  const viewKey = `label:${params.labelId}`;
  const tasks = todo.views[viewKey];

  useEffect(() => {
    void todo.loadView(viewKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  return (
    <ViewShell>
      <ViewHeader
        kicker="Label"
        title={label ? `@${label.name}` : "…"}
        meta={tasks === undefined ? "Loading…" : `${tasks.length} open task${tasks.length === 1 ? "" : "s"}`}
      />
      <TaskList
        viewKey={viewKey}
        tasks={tasks ?? []}
        showProject
        emptyState={tasks !== undefined ? <EmptyNote icon={<Tag size={22} />} title="Nothing carries this label." hint="Add it from any task's Labels picker, or with @name in quick-add." /> : null}
      />
    </ViewShell>
  );
}
