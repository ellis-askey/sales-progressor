"use client";

// Inbox — frictionless capture. Compact reorderable list, always-ready
// inline add, organise later via each row's Move action.

import { useEffect } from "react";
import { Inbox as InboxIcon } from "lucide-react";
import { useTodo } from "@/components/boardwalk/todo/TodoProvider";
import { TaskList } from "@/components/boardwalk/todo/TaskList";
import { EmptyNote, ViewHeader, ViewShell } from "@/components/boardwalk/todo/ViewHeader";
import { BwButton } from "@/components/boardwalk/ui";

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
        title="Inbox"
        meta={tasks === undefined ? "Loading…" : tasks.length ? `${tasks.length} to organise · capture now, file later` : "Capture tasks quickly. Organise them later."}
        actions={
          <BwButton size="sm" variant="primary" onClick={() => todo.openQuickAdd()}>
            + Add task
          </BwButton>
        }
      />
      <TaskList
        viewKey={viewKey}
        tasks={tasks ?? []}
        reorderable
        inlineAddDefaults={{}}
        emptyState={
          tasks === undefined ? (
            <p className="bw-hint" style={{ padding: "22px 14px" }}>Loading…</p>
          ) : (
            <EmptyNote
              icon={<InboxIcon size={17} />}
              title="Inbox zero."
              hint='Press Q anywhere — "Call vendor tomorrow 10am" becomes a scheduled task.'
            />
          )
        }
      />
    </ViewShell>
  );
}
