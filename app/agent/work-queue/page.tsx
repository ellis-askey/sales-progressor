import { requireSession } from "@/lib/session";
import { resolveAgentVisibility } from "@/lib/services/agent";
import { getWorkQueueItems } from "@/lib/services/work-queue";
import { getAgentReminderLogs } from "@/lib/services/reminders";
import { AgentRemindersList } from "@/components/reminders/AgentRemindersList";
import { FileAlertsStrip } from "@/components/reminders/FileAlertsStrip";

export default async function WorkQueuePage() {
  const session = await requireSession();
  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const [items, reminderLogs] = await Promise.all([
    getWorkQueueItems(vis),
    getAgentReminderLogs(vis),
  ]);

  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const activeLogs = reminderLogs.filter((l) => {
    if (l.snoozedUntil && new Date(l.snoozedUntil) > now) return false;
    const due = new Date(l.nextDueDate); due.setHours(0, 0, 0, 0);
    return due <= today || l.chaseTasks.length > 0;
  });

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
            Reminders
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "var(--agent-text-body-sm)", color: "var(--agent-text-tertiary)" }}>
            Chases and files that need your attention.
          </p>
        </div>
      </div>

      <div className="px-8 py-7 space-y-6">

        {/* File alerts strip — always expanded on load */}
        {items.length > 0 && <FileAlertsStrip items={items} />}

        {/* Milestone reminders */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="agent-eyebrow">Milestone Reminders</h2>
            {activeLogs.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/50 text-slate-900/50">
                {activeLogs.length} active
              </span>
            )}
          </div>
          <AgentRemindersList logs={reminderLogs} />
        </section>

      </div>
    </>
  );
}
