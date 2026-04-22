import { requireSession } from "@/lib/session";
import { listManualTasks, countManualTasksDueToday } from "@/lib/services/manual-tasks";
import { getWorkQueueCounts } from "@/lib/services/tasks";
import { AppShell } from "@/components/layout/AppShell";
import { ManualTaskList } from "@/components/todos/ManualTaskList";

export default async function TodosPage() {
  const session = await requireSession();

  const [tasks, taskCounts, todoCount] = await Promise.all([
    listManualTasks(session.user.agencyId),
    getWorkQueueCounts(session.user.agencyId, session.user.id).catch(() => null),
    countManualTasksDueToday(session.user.agencyId).catch(() => 0),
  ]);

  const openCount = tasks.filter((t) => t.status === "open").length;

  return (
    <AppShell session={session} activePath="/todos" taskCount={taskCounts?.pending ?? 0} todoCount={todoCount}>
      {/* Header */}
      <div className="glass-panel-dark relative overflow-hidden">
        <div className="relative px-8 pt-6 pb-7">
          <p className="text-xs text-label-secondary-on-dark mb-4 font-medium tracking-wide uppercase">
            {session.user.name}
          </p>
          <h1 className="text-2xl font-bold text-white leading-tight tracking-tight">To-Do</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {openCount === 0 ? "Nothing outstanding" : `${openCount} item${openCount === 1 ? "" : "s"} open`}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-7 max-w-2xl">
        <ManualTaskList initialTasks={tasks} showDone />
      </div>
    </AppShell>
  );
}
