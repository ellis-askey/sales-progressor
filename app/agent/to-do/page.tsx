import { requireSession } from "@/lib/session";
import { listAllTasksForAgent } from "@/lib/services/manual-tasks";
import { AgentTodoList } from "@/components/agent/AgentTodoList";

export default async function AgentTodoPage() {
  const session = await requireSession();
  const tasks = await listAllTasksForAgent(session.user.id, session.user.agencyId);

  const openCount = tasks.filter((t) => t.status === "open").length;

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
        <div style={{ position: "relative", padding: "24px 32px 28px" }}>
          <p className="agent-eyebrow" style={{ marginBottom: 12 }}>{session.user.firmName ?? "Agent Portal"}</p>
          <h1 style={{ margin: 0, fontSize: "var(--agent-text-h1)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>
            To-Do
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "var(--agent-text-body-sm)", color: "var(--agent-text-tertiary)" }}>
            {openCount === 0
              ? "No pending requests with your progressor."
              : `${openCount} pending request${openCount === 1 ? "" : "s"} with your progressor.`}
          </p>
        </div>
      </div>

      <div className="px-8 py-7" style={{ maxWidth: 680 }}>
        <AgentTodoList initialTasks={tasks} />
      </div>
    </>
  );
}
