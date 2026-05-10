import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getAgentMilestoneActivity, resolveAgentVisibility } from "@/lib/services/agent";
import { ChartLine } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  CommsActivityFeed,
  type DayBucket,
  type TxGroup,
  type MilestoneRow,
} from "@/components/comms/CommsActivityFeed";

function dayLabel(d: Date | string) {
  const date = new Date(d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (date >= today) return "Today";
  if (date >= yesterday) return "Yesterday";
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export default async function AgentCommsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await requireSession();
  const { filter } = await searchParams;
  const portalOnly = filter === "portal";

  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const milestones = await getAgentMilestoneActivity(vis, portalOnly);

  // Group into day buckets, each day grouped by transaction
  const dayOrder: string[] = [];
  const dayTxMap = new Map<string, Map<string, TxGroup>>();

  for (const m of milestones) {
    const label = dayLabel(m.completedAt ?? new Date());
    if (!dayTxMap.has(label)) {
      dayTxMap.set(label, new Map());
      dayOrder.push(label);
    }
    const txMap = dayTxMap.get(label)!;
    if (!txMap.has(m.transaction.id)) {
      txMap.set(m.transaction.id, {
        transactionId: m.transaction.id,
        transactionAddress: m.transaction.propertyAddress,
        milestones: [],
      });
    }
    const row: MilestoneRow = {
      id: m.id,
      completedAtIso: (m.completedAt ?? new Date()).toISOString(),
      confirmedByPortal: m.confirmedByPortal,
      side: m.milestoneDefinition.side,
      milestoneName: m.milestoneDefinition.name,
      completedByName: m.completedBy?.name ?? null,
    };
    txMap.get(m.transaction.id)!.milestones.push(row);
  }

  const days: DayBucket[] = dayOrder.map((label) => ({
    label,
    txGroups: Array.from(dayTxMap.get(label)!.values()),
    defaultOpen: label === "Today" || label === "Yesterday",
  }));

  const filterBase = "/agent/comms";

  return (
    <>
      <PageHeader title="Updates" subtitle="Milestone activity across all your files.">
        <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.05)", borderRadius: 10, padding: 3 }}>
          <Link
            href={filterBase}
            style={{
              fontSize: 12, fontWeight: 500, padding: "6px 12px", borderRadius: 7,
              textDecoration: "none", transition: "background 150ms",
              background: !portalOnly ? "rgba(255,255,255,0.9)" : "transparent",
              color: !portalOnly ? "var(--agent-text-primary)" : "var(--agent-text-secondary)",
              boxShadow: !portalOnly ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            All milestones
          </Link>
          <Link
            href={`${filterBase}?filter=portal`}
            style={{
              fontSize: 12, fontWeight: 500, padding: "6px 12px", borderRadius: 7,
              textDecoration: "none", transition: "background 150ms",
              background: portalOnly ? "rgba(255,255,255,0.9)" : "transparent",
              color: portalOnly ? "var(--agent-text-primary)" : "var(--agent-text-secondary)",
              boxShadow: portalOnly ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            Client confirmations
          </Link>
        </div>
      </PageHeader>

      <div className="px-4 md:px-8 py-2 md:py-4 space-y-6">

        {milestones.length === 0 && (
          <>
            <div className="glass-card" style={{ padding: "48px 24px", textAlign: "center" }}>
              <ChartLine weight="regular" style={{ width: 32, height: 32, color: "var(--agent-text-muted)", margin: "0 auto 16px", display: "block", opacity: 0.45 }} />
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                {portalOnly ? "No client confirmations yet" : "No milestone activity yet"}
              </p>
              <p style={{ margin: "0 auto", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 340, lineHeight: 1.5 }}>
                {portalOnly
                  ? "Client confirmations will appear here when clients confirm their milestones via the portal."
                  : "Completed milestones across your files will appear here."}
              </p>
            </div>

            {/* Ghost day-bucket preview */}
            <div style={{ opacity: 0.3, pointerEvents: "none" }}>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Today</p>
              <div className="agent-glass-strong" style={{ borderRadius: 16, overflow: "hidden" }}>
                <div style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>14 Maple Close, Birmingham</p>
                </div>
                {[
                  { text: "Mortgage offer received", time: "9:41 am" },
                  { text: "Search results obtained", time: "8:15 am" },
                ].map(({ text, time }, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                    borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                  }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(var(--agent-coral-rgb), 0.12)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="var(--agent-coral)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <p style={{ flex: 1, margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>{text}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)", flexShrink: 0 }}>{time}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {days.length > 0 && <CommsActivityFeed days={days} />}

      </div>
    </>
  );
}
