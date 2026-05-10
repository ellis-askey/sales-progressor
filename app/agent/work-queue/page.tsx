import { requireSession } from "@/lib/session";
import { resolveAgentVisibility } from "@/lib/services/agent";
import { getWorkQueueItems, txWhereWorkQueue } from "@/lib/services/work-queue";
import { getAgentReminderLogs } from "@/lib/services/reminders";
import { AgentRemindersList } from "@/components/reminders/AgentRemindersList";
import { FileAlertsStrip } from "@/components/reminders/FileAlertsStrip";
import { prisma } from "@/lib/prisma";
import { Bell } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatPill } from "@/components/layout/StatPill";
import type { PillColor } from "@/components/layout/StatPill";

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
  const [items, reminderLogs, activeFileCount] = await Promise.all([
    getWorkQueueItems(vis),
    getAgentReminderLogs(vis),
    prisma.propertyTransaction.count({ where: { ...txWhereWorkQueue(vis), status: { in: ["active", "on_hold"] } } }),
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

  const statSegments: { label: string; anchor: string; colorKey: PillColor }[] = [];
  if (overdueCount > 0)  statSegments.push({ label: `${overdueCount} overdue`,   anchor: "#section-overdue",  colorKey: "danger"  });
  if (dueTodayCount > 0) statSegments.push({ label: `${dueTodayCount} due today`, anchor: "#section-due_today", colorKey: "warning" });
  if (comingUpCount > 0) statSegments.push({ label: `${comingUpCount} coming up`, anchor: "#section-upcoming",  colorKey: "muted"   });

  return (
    <>
      <PageHeader title="Reminders" subtitle="What needs chasing, today and ahead.">
        {statSegments.map(seg => (
          <StatPill key={seg.anchor} href={seg.anchor} label={seg.label} color={seg.colorKey} />
        ))}
      </PageHeader>

      <div className="px-4 md:px-8 py-2 md:py-4 space-y-6">
        {items.length > 0 && <FileAlertsStrip items={items} />}
        {reminderLogs.length === 0 && activeFileCount === 0 ? (
          <>
            <div className="glass-card" style={{ padding: "48px 24px", textAlign: "center" }}>
              <Bell weight="regular" style={{ width: 32, height: 32, color: "var(--agent-text-muted)", margin: "0 auto 16px", display: "block", opacity: 0.45 }} />
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                Your reminders will appear here
              </p>
              <p style={{ margin: "0 auto", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 340, lineHeight: 1.5 }}>
                Once you create a sale, we&apos;ll surface chases and follow-ups as files progress.
              </p>
            </div>

            {/* Ghost reminder groups preview */}
            <div style={{ opacity: 0.3, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 20 }}>
              {[
                { groupLabel: "Overdue", color: "#dc2626", reminders: [
                  { addr: "14 Maple Close, Birmingham", milestone: "Mortgage offer — chaser due", tag: "3 days overdue" },
                  { addr: "8 The Crescent, Bristol", milestone: "Search results — follow-up", tag: "1 day overdue" },
                ]},
                { groupLabel: "Due today", color: "#d97706", reminders: [
                  { addr: "22 Victoria Road, Manchester", milestone: "Contract pack — review", tag: "Due today" },
                ]},
              ].map(({ groupLabel, color, reminders }) => (
                <div key={groupLabel}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>{groupLabel}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color, background: `${color}18`, borderRadius: 99, padding: "1px 7px" }}>{reminders.length}</span>
                  </div>
                  <div className="agent-glass-strong" style={{ borderRadius: 12, overflow: "hidden" }}>
                    {reminders.map((r, i) => (
                      <div key={i} style={{
                        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                        borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.addr}</p>
                          <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)" }}>{r.milestone}</p>
                        </div>
                        <div style={{ flexShrink: 0, display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 500, color, background: `${color}12`, borderRadius: 6, padding: "3px 8px" }}>{r.tag}</span>
                          <div style={{ height: 30, width: 70, borderRadius: 8, background: "rgba(255,255,255,0.6)", border: "0.5px solid var(--agent-border-subtle)" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <AgentRemindersList logs={reminderLogs} />
        )}
      </div>
    </>
  );
}
