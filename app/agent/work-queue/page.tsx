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
            <div className="agent-glass-strong" style={{ padding: "48px 24px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
              <Bell weight="regular" style={{ width: 32, height: 32, color: "var(--agent-text-muted)", margin: "0 auto 16px", display: "block", opacity: 0.45 }} />
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                Your reminders will appear here
              </p>
              <p style={{ margin: "0 auto", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 340, lineHeight: 1.5 }}>
                {/* OLD: "Once you create a sale, we'll surface chases and follow-ups as files progress." — Rule 1 (VOICE_GUIDELINES.md pre-catalogued) */}
                Chases and follow-ups appear here as your files move forward.
              </p>
            </div>

            {/* Ghost reminder groups preview — skeleton lines, not mock data.
             * Keeps group headers + row count to convey the structure agents will see;
             * replaces hardcoded addresses/reminders/tags with .agent-skeleton shapes. */}
            <div style={{ opacity: 0.5, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
              {[
                { groupLabel: "Overdue",   rows: 2 },
                { groupLabel: "Due today", rows: 1 },
              ].map(({ groupLabel, rows }) => (
                <div key={groupLabel}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--agent-text-muted)" }}>{groupLabel}</span>
                    <div className="agent-skeleton" style={{ height: 18, width: 22, borderRadius: 99 }} />
                  </div>
                  <div className="agent-glass-strong" style={{ borderRadius: 12, overflow: "hidden" }}>
                    {Array.from({ length: rows }).map((_, i) => (
                      <div key={i} style={{
                        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                        borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="agent-skeleton" style={{ height: 12, width: "55%", borderRadius: 6, marginBottom: 7 }} />
                          <div className="agent-skeleton" style={{ height: 10, width: "38%", borderRadius: 6 }} />
                        </div>
                        <div className="agent-skeleton" style={{ height: 20, width: 76, borderRadius: 6, flexShrink: 0 }} />
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
