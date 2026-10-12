"use client";

// Inbox — frictionless capture. Reorderable flat list with an always-ready
// inline add; organise into projects later via the row's Move action.

import { useEffect } from "react";
import { Inbox as InboxIcon } from "lucide-react";
import { useTodo } from "@/components/boardwalk/todo/TodoProvider";
import { TaskList } from "@/components/boardwalk/todo/TaskList";
import { EmptyNote, ViewHeader, ViewShell } from "@/components/boardwalk/todo/ViewHeader";

export default function InboxPage() {
  const todo = useTodo();
  const viewKey = "inbox";
  const tasks = todo.views[viewKey];

  useEffect(() => {
    void todo.loadView(viewKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ViewShell>
      <ViewHeader
        kicker="Capture"
        title="Inbox"
        meta={tasks === undefined ? "Loading…" : `${tasks.length} task${tasks.length === 1 ? "" : "s"} to organise`}
      />
      <TaskList
        viewKey={viewKey}
        tasks={tasks ?? []}
        reorderable
        inlineAddDefaults={{}}
        emptyState={
          tasks === undefined ? (
            <p className="bw-hint" style={{ padding: 30, textAlign: "center" }}>Loading…</p>
          ) : (
            <EmptyNote
              icon={<InboxIcon size={22} />}
              title="Inbox zero."
              hint='Capture anything with Q — "Call vendor tomorrow 10am" becomes a scheduled task.'
            />
          )
        }
      />
    </ViewShell>
  );
}
