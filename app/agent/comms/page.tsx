import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getAgentMilestoneActivity, resolveAgentVisibility } from "@/lib/services/agent";
import { ChartLine } from "@phosphor-icons/react/dist/ssr";
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
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-4">
            <div>
              <h1 style={{ margin: 0, fontSize: "var(--agent-text-h1)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>Updates</h1>
              <p style={{ margin: "4px 0 0", fontSize: "var(--agent-text-body-sm)", color: "var(--agent-text-tertiary)" }}>
                Milestone activity across all your files.
              </p>
            </div>
            {/* Filter tabs */}
            <div className="flex w-full md:w-auto" style={{ gap: 4, background: "rgba(255,255,255,0.40)", borderRadius: 10, padding: 3 }}>
              <Link
                href={filterBase}
                className="flex flex-1 items-center justify-center md:flex-none"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "10px 12px",
                  borderRadius: 7,
                  textDecoration: "none",
                  transition: "background 150ms",
                  background: !portalOnly ? "rgba(255,255,255,0.9)" : "transparent",
                  color: !portalOnly ? "var(--agent-text-primary)" : "var(--agent-text-secondary)",
                  boxShadow: !portalOnly ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                All milestones
              </Link>
              <Link
                href={`${filterBase}?filter=portal`}
                className="flex flex-1 items-center justify-center md:flex-none"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "10px 12px",
                  borderRadius: 7,
                  textDecoration: "none",
                  transition: "background 150ms",
                  background: portalOnly ? "rgba(255,255,255,0.9)" : "transparent",
                  color: portalOnly ? "var(--agent-text-primary)" : "var(--agent-text-secondary)",
                  boxShadow: portalOnly ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Client confirmations
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 py-5 md:py-7 space-y-6">

        {milestones.length === 0 && (
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
        )}

        {days.length > 0 && <CommsActivityFeed days={days} />}

      </div>
    </>
  );
}
