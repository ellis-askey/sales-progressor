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
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 60%, #1e3a5f 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative px-8 pt-6 pb-7">
          <p className="text-xs text-slate-500 mb-4 font-medium tracking-wide uppercase">
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
