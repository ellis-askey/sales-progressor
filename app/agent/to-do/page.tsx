import { requireSession } from "@/lib/session";
import { listAllTasksForAgent } from "@/lib/services/manual-tasks";
import { AgentTodoList } from "@/components/agent/AgentTodoList";

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
    ownOpen.length > 0  && { key: "mine",    label: `${ownOpen.length} to-do${ownOpen.length === 1 ? "" : "s"}`, href: "#section-mine",       color: "#2563eb" },
    progOpen.length > 0 && { key: "prog",    label: `${progOpen.length} with progressor`,                         href: "#section-progressor", color: "#b45309" },
    overdueCount > 0    && { key: "overdue", label: `${overdueCount} overdue`,                                     href: "#section-mine",       color: hasRedOverdue ? "#dc2626" : "#b45309" },
  ].filter(Boolean) as { key: string; label: string; href: string; color: string }[];

  return (
    <>
      {/* Header */}
      <div style={{
        background: "rgba(255,255,255,0.52)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        borderBottom: "0.5px solid rgba(255,255,255,0.70)",
        boxShadow: "0 4px 24px rgba(255,138,101,0.07), 0 1px 0 rgba(255,255,255,0.80) inset",
        position: "relative",
        overflow: "hidden",
      }}>
        <div aria-hidden="true" style={{ position: "absolute", top: -60, right: -40, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,138,101,0.13) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "absolute", bottom: -40, left: 60, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,220,100,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div className="relative px-4 pt-6 pb-7 md:px-8">
          <h1 style={{ margin: 0, fontSize: "var(--agent-text-h1)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>
            To-Do
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "var(--agent-text-body-sm)", color: "var(--agent-text-tertiary)" }}>
            Your notes, plus anything you&apos;ve sent to your progressor.
          </p>
          {statSegs.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0 4px", marginTop: 10 }}>
              {statSegs.map((seg, i) => (
                <span key={seg.key} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {i > 0 && <span style={{ color: "rgba(15,23,42,0.20)", fontSize: 12 }}>·</span>}
                  <a
                    href={seg.href}
                    style={{ color: seg.color, fontSize: 12, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", minHeight: 44 }}
                  >
                    {seg.label}
                  </a>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 md:px-8 py-5 md:py-7" style={{ maxWidth: 680 }}>
        <AgentTodoList initialTasks={tasks} />
      </div>
    </>
  );
}
