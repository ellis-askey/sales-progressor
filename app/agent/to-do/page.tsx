import { requireSession } from "@/lib/session";
import { listAllTasksForAgent, listProgressorInboxTasks } from "@/lib/services/manual-tasks";
import { AgentTodoList } from "@/components/agent/AgentTodoList";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatPill } from "@/components/layout/StatPill";
import type { PillColor } from "@/components/layout/StatPill";
import { toUKDateStr } from "@/lib/utils";

export default async function AgentTodoPage() {
  const session = await requireSession();
  const role = session.user.role;
  const isProgressor = role === "sales_progressor";

  const ownTasks = await listAllTasksForAgent(session.user.id, session.user.agencyId ?? "");
  const inboxTasks = isProgressor ? await listProgressorInboxTasks(session.user.id) : [];
  const tasks = [...ownTasks, ...inboxTasks];

  const todayStr = toUKDateStr(new Date());

  const ownOpen      = tasks.filter((t) => !t.isAgentRequest && t.status === "open");
  const progOpen     = tasks.filter((t) =>  t.isAgentRequest && t.status === "open");
  const overdueOpen  = tasks.filter((t) => t.status === "open" && t.dueDate && toUKDateStr(t.dueDate) < todayStr);
  const overdueCount = overdueOpen.length;
  const hasRedOverdue = overdueOpen.some((t) => {
    const dueStr = toUKDateStr(t.dueDate!);
    return Math.round((new Date(todayStr).getTime() - new Date(dueStr).getTime()) / 86400000) >= 4;
  });

  const subtitle = isProgressor
    ? "Your management notes, plus requests from agents."
    : "Your notes, plus anything you've flagged to your progressor.";

  const progLabel = isProgressor ? "from agents" : "with progressor";

  const statSegs = [
    ownOpen.length > 0  && { key: "mine",    label: `${ownOpen.length} to-do${ownOpen.length === 1 ? "" : "s"}`, href: "#section-mine",       pillColor: "muted"   as PillColor },
    progOpen.length > 0 && { key: "prog",    label: `${progOpen.length} ${progLabel}`,                            href: "#section-progressor", pillColor: "warning" as PillColor },
    overdueCount > 0    && { key: "overdue", label: `${overdueCount} overdue`,                                     href: "#section-mine",       pillColor: "danger"  as PillColor },
  ].filter(Boolean) as { key: string; label: string; href: string; pillColor: PillColor }[];

  // hasRedOverdue is unused in the stat pill render but kept for future colour-coding parity
  void hasRedOverdue;

  return (
    <>
      <PageHeader title="To-Do" subtitle={subtitle}>
        {statSegs.map(seg => (
          <StatPill key={seg.key} href={seg.href} label={seg.label} color={seg.pillColor} />
        ))}
      </PageHeader>

      <div className="px-4 md:px-8 py-2 md:py-4" style={{ maxWidth: 680 }}>
        <AgentTodoList initialTasks={tasks} role={role} />
      </div>
    </>
  );
}
