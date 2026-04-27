import { requireSession } from "@/lib/session";
import { resolveAgentVisibility } from "@/lib/services/agent";
import { getWorkQueueItems } from "@/lib/services/work-queue";
import { getAgentReminderLogs } from "@/lib/services/reminders";
import { AgentRemindersList } from "@/components/reminders/AgentRemindersList";
import { FileAlertsStrip } from "@/components/reminders/FileAlertsStrip";

type AgentLog = Awaited<ReturnType<typeof getAgentReminderLogs>>[number];

function isSunday(d: Date) { return d.getDay() === 0; }
function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (!isSunday(result)) added++;
  }
  return result;
}

function classifyForStats(log: AgentLog, today: Date): "overdue" | "due_today" | "coming_up" | null {
  const openTask = log.chaseTasks[0] ?? null;
  if (openTask?.priority === "escalated") return "overdue";
  const due = new Date(log.nextDueDate); due.setHours(0, 0, 0, 0);
  const taskDue = openTask ? (() => { const d = new Date(openTask.dueDate); d.setHours(0, 0, 0, 0); return d; })() : null;
  if (due < today || (taskDue && taskDue < today)) return "overdue";
  if (due.getTime() === today.getTime()) return "due_today";
  if (due <= addBusinessDays(today, 3)) return "coming_up";
  return null;
}

export default async function WorkQueuePage() {
  const session = await requireSession();
  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const [items, reminderLogs] = await Promise.all([
    getWorkQueueItems(vis),
    getAgentReminderLogs(vis),
  ]);

  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Compute header stat row (exclude snoozed logs)
  const activeForStats = reminderLogs.filter((l) => !(l.snoozedUntil && new Date(l.snoozedUntil) > now));
  let overdueCount = 0, dueTodayCount = 0, comingUpCount = 0;
  for (const l of activeForStats) {
    const g = classifyForStats(l, today);
    if (g === "overdue") overdueCount++;
    else if (g === "due_today") dueTodayCount++;
    else if (g === "coming_up") comingUpCount++;
  }

  const statSegments: { label: string; anchor: string; color: string }[] = [];
  if (overdueCount > 0)  statSegments.push({ label: `${overdueCount} overdue`,   anchor: "#section-overdue",  color: "var(--agent-danger)"   });
  if (dueTodayCount > 0) statSegments.push({ label: `${dueTodayCount} due today`, anchor: "#section-due_today", color: "#d97706"               });
  if (comingUpCount > 0) statSegments.push({ label: `${comingUpCount} coming up`, anchor: "#section-upcoming",  color: "var(--agent-text-muted)" });

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
            Reminders
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "var(--agent-text-body-sm)", color: "var(--agent-text-tertiary)" }}>
            What needs chasing, today and ahead.
          </p>
          {statSegments.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0, marginTop: 10 }}>
              {statSegments.map((seg, i) => (
                <span key={seg.anchor} style={{ display: "inline-flex", alignItems: "center" }}>
                  {i > 0 && <span style={{ margin: "0 6px", color: "var(--agent-text-muted)", fontSize: 11, opacity: 0.4 }}>·</span>}
                  <a
                    href={seg.anchor}
                    style={{ fontSize: 12, fontWeight: 500, color: seg.color, textDecoration: "none" }}
                  >
                    {seg.label}
                  </a>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 md:px-8 py-5 md:py-7 space-y-6">
        {items.length > 0 && <FileAlertsStrip items={items} />}
        <AgentRemindersList logs={reminderLogs} />
      </div>
    </>
  );
}
