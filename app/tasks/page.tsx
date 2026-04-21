// app/tasks/page.tsx
// Sprint 4: Work queue — all open chase tasks across active transactions.

import { requireSession } from "@/lib/session";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkQueue } from "@/components/tasks/WorkQueue";
import { getWorkQueueTasks, getWorkQueueCounts, getSnoozedWorkQueueItems } from "@/lib/services/tasks";
import { countManualTasksDueToday } from "@/lib/services/manual-tasks";

export default async function TasksPage() {
  const session = await requireSession();

  const [tasks, counts, snoozedItems, todoCount] = await Promise.all([
    getWorkQueueTasks(session.user.agencyId, { includeCompleted: false }),
    getWorkQueueCounts(session.user.agencyId, session.user.id),
    getSnoozedWorkQueueItems(session.user.agencyId),
    countManualTasksDueToday(session.user.agencyId).catch(() => 0),
  ]);

  return (
    <AppShell session={session} activePath="/tasks" todoCount={todoCount}>
      <PageHeader
        title="Work Queue"
        subtitle="Chase tasks across all active files"
      />
      <div className="px-8 py-7">
        <WorkQueue
          tasks={tasks}
          snoozedItems={snoozedItems}
          counts={counts}
          currentUserId={session.user.id}
        />
      </div>
    </AppShell>
  );
}
