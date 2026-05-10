import { requireSession } from "@/lib/session";
import { listAllTasksForAgent } from "@/lib/services/manual-tasks";
import { AgentTodoList } from "@/components/agent/AgentTodoList";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatPill } from "@/components/layout/StatPill";
import type { PillColor } from "@/components/layout/StatPill";

export default async function AgentTodoPage() {
  const session = await requireSession();
  const tasks = await listAllTasksForAgent(session.user.id, session.user.agencyId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ownOpen      = tasks.filter((t) => !t.isAgentRequest && t.status === "open");
  const progOpen     = tasks.filter((t) =>  t.isAgentRequest && t.status === "open");
  const overdueOpen  = tasks.filter((t) => t.status === "open" && t.dueDate && new Date(t.dueDate) < today);
  const overdueCount = overdueOpen.length;
  const hasRedOverdue = overdueOpen.some((t) => {
    const due = new Date(t.dueDate!); due.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - due.getTime()) / 86400000) >= 4;
  });

  const statSegs = [
    ownOpen.length > 0  && { key: "mine",    label: `${ownOpen.length} to-do${ownOpen.length === 1 ? "" : "s"}`, href: "#section-mine",       pillColor: "muted"   as PillColor },
    progOpen.length > 0 && { key: "prog",    label: `${progOpen.length} with progressor`,                         href: "#section-progressor", pillColor: "warning" as PillColor },
    overdueCount > 0    && { key: "overdue", label: `${overdueCount} overdue`,                                     href: "#section-mine",       pillColor: "danger"  as PillColor },
  ].filter(Boolean) as { key: string; label: string; href: string; pillColor: PillColor }[];

  return (
    <>
      <PageHeader title="To-Do" subtitle="Your notes, plus anything you've flagged to your progressor.">
        {statSegs.map(seg => (
          <StatPill key={seg.key} href={seg.href} label={seg.label} color={seg.pillColor} />
        ))}
      </PageHeader>

      <div className="px-4 md:px-8 py-2 md:py-4" style={{ maxWidth: 680 }}>
        <AgentTodoList initialTasks={tasks} />
      </div>
    </>
  );
}
