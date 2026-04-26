import Link from "next/link";
import { requireSession } from "@/lib/session";
import { resolveAgentVisibility } from "@/lib/services/agent";
import { getWorkQueueItems, ALERT_CONFIG } from "@/lib/services/work-queue";
import type { AlertType } from "@/lib/services/work-queue";
import { getAgentReminderLogs } from "@/lib/services/reminders";
import { AgentRemindersList } from "@/components/reminders/AgentRemindersList";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react/dist/ssr";

export default async function WorkQueuePage() {
  const session = await requireSession();
  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const [items, reminderLogs] = await Promise.all([
    getWorkQueueItems(vis),
    getAgentReminderLogs(vis),
  ]);

  const overdueCount = items.filter((i) => i.alerts.includes("overdue_exchange")).length;
  const missingSolicitorCount = items.filter(
    (i) =>
      i.alerts.includes("missing_vendor_solicitor") ||
      i.alerts.includes("missing_purchaser_solicitor")
  ).length;
  const staleCount = items.filter((i) => i.alerts.includes("stale")).length;

  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const activeReminderCount = reminderLogs.filter((l) => {
    if (l.snoozedUntil && new Date(l.snoozedUntil) > now) return false;
    const due = new Date(l.nextDueDate); due.setHours(0, 0, 0, 0);
    return due <= today || l.chaseTasks.length > 0;
  }).length;

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
            Chases and files that need your follow-up.
          </p>
        </div>
      </div>

      <div className="px-8 py-7 space-y-6">

        {/* Summary chips */}
        {(items.length > 0 || activeReminderCount > 0) && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {activeReminderCount > 0 && (
              <SummaryChip
                count={activeReminderCount}
                label="chase reminders"
                color="var(--agent-text-primary)"
                bg="rgba(255,255,255,0.55)"
                border="rgba(255,255,255,0.60)"
              />
            )}
            {overdueCount > 0 && (
              <SummaryChip
                count={overdueCount}
                label="overdue exchange"
                color="var(--agent-danger)"
                bg="var(--agent-danger-bg)"
                border="var(--agent-danger-border)"
              />
            )}
            {missingSolicitorCount > 0 && (
              <SummaryChip
                count={missingSolicitorCount}
                label="missing solicitor"
                color="var(--agent-warning)"
                bg="var(--agent-warning-bg)"
                border="var(--agent-warning-border)"
              />
            )}
            {staleCount > 0 && (
              <SummaryChip
                count={staleCount}
                label="no recent progress"
                color="var(--agent-info)"
                bg="var(--agent-info-bg)"
                border="var(--agent-info-border)"
              />
            )}
          </div>
        )}

        {/* Milestone reminders */}
        <section>
          <h2 className="agent-eyebrow mb-4">Milestone Reminders</h2>
          <AgentRemindersList logs={reminderLogs} />
        </section>

        {/* File alerts */}
        {items.length > 0 && (
          <section>
            <h2 className="agent-eyebrow mb-4">File Alerts</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((item) => (
                <WorkQueueCard key={item.id} item={item} isDirector={vis.seeAll} />
              ))}
            </div>
          </section>
        )}

      </div>
    </>
  );
}

function SummaryChip({ count, label, color, bg, border }: {
  count: number; label: string; color: string; bg: string; border: string;
}) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "baseline", gap: 6,
      padding: "7px 14px", borderRadius: 10,
      background: bg, border: `1px solid ${border}`,
    }}>
      <span style={{ fontSize: 18, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
        {count}
      </span>
      <span style={{ fontSize: 12, color, opacity: 0.85 }}>{label}</span>
    </div>
  );
}

function WorkQueueCard({ item, isDirector }: {
  item: Awaited<ReturnType<typeof getWorkQueueItems>>[number];
  isDirector: boolean;
}) {
  const now = new Date();
  const daysSinceActivity = item.lastActivityAt
    ? Math.floor((now.getTime() - new Date(item.lastActivityAt).getTime()) / 86400000)
    : null;

  const exchangeDate = item.expectedExchangeDate ? new Date(item.expectedExchangeDate) : null;
  const exchangeOverdue = exchangeDate && exchangeDate < now;
  const daysOverdue = exchangeDate
    ? Math.floor((now.getTime() - exchangeDate.getTime()) / 86400000)
    : null;

  const partyLine = [
    ...(item.vendors.length ? [`${item.vendors.join(", ")} (vendor)`] : []),
    ...(item.purchasers.length ? [`${item.purchasers.join(", ")} (purchaser)`] : []),
  ].join(" · ");

  return (
    <Link
      href={`/agent/transactions/${item.id}`}
      style={{ textDecoration: "none" }}
    >
      <div className="glass-card work-queue-row" style={{
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        cursor: "pointer",
      }}>
        {/* Left: address + parties */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.propertyAddress}
          </p>
          {partyLine && (
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {partyLine}
            </p>
          )}
          {isDirector && item.agentUser && (
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-disabled)" }}>
              {item.agentUser.name}
            </p>
          )}
        </div>

        {/* Centre: alerts + dates */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0, maxWidth: 420, justifyContent: "flex-end" }}>
          {item.alerts.map((alert: AlertType) => {
            const cfg = ALERT_CONFIG[alert];
            return (
              <span key={alert} style={{
                display: "inline-flex", alignItems: "center",
                padding: "3px 9px", borderRadius: 6,
                fontSize: 11, fontWeight: 600,
                color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
              }}>
                {cfg.label}
              </span>
            );
          })}
          {exchangeDate && (
            <span style={{
              padding: "3px 9px", borderRadius: 6,
              fontSize: 11, fontWeight: 500,
              color: exchangeOverdue ? "var(--agent-danger)" : "var(--agent-text-muted)",
              background: exchangeOverdue ? "var(--agent-danger-bg)" : "rgba(255,255,255,0.40)",
              border: exchangeOverdue ? "1px solid var(--agent-danger-border)" : "1px solid rgba(255,255,255,0.50)",
            }}>
              {exchangeOverdue
                ? `${daysOverdue}d overdue`
                : `Exch. ${exchangeDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
              }
            </span>
          )}
          {daysSinceActivity !== null && item.alerts.includes("stale") && (
            <span style={{
              padding: "3px 9px", borderRadius: 6,
              fontSize: 11, color: "var(--agent-text-muted)",
              background: "rgba(255,255,255,0.40)",
              border: "1px solid rgba(255,255,255,0.50)",
            }}>
              Last progress {daysSinceActivity}d ago
            </span>
          )}
          {!item.lastActivityAt && item.alerts.includes("stale") && (
            <span style={{
              padding: "3px 9px", borderRadius: 6,
              fontSize: 11, color: "var(--agent-text-muted)",
              background: "rgba(255,255,255,0.40)",
              border: "1px solid rgba(255,255,255,0.50)",
            }}>
              No milestones completed
            </span>
          )}
        </div>

        {/* Right: arrow */}
        <ArrowRight weight="regular" style={{ width: 16, height: 16, color: "var(--agent-text-muted)", flexShrink: 0, opacity: 0.6 }} />
      </div>
    </Link>
  );
}
