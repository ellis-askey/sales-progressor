import Link from "next/link";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { getAgentMilestoneActivity, resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import { ChartLine } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  CommsActivityFeed,
  type DayBucket,
  type TxGroup,
  type MilestoneRow,
} from "@/components/comms/CommsActivityFeed";
import { toUKDateStr } from "@/lib/utils";

function dayLabel(d: Date | string) {
  const date = new Date(d);
  const todayStr = toUKDateStr(new Date());
  const yesterdayStr = toUKDateStr(new Date(Date.now() - 86_400_000));
  const dStr = toUKDateStr(date);
  if (dStr >= todayStr) return "Today";
  if (dStr >= yesterdayStr) return "Yesterday";
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

  const isInternalStaff = session.user.role === "admin" || session.user.role === "sales_progressor" || session.user.role === "viewer";
  const isProgressor = session.user.role === "sales_progressor";
  const isAdmin = hasAdminPowers(session);
  const vis = isInternalStaff
    ? resolveInternalVisibility(session.user.id, session.user.role, isAdmin)
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);
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
      {/* OLD subtitle: "Milestone activity across all your files." */}
      <PageHeader
        title="Updates"
        subtitle={
          isAdmin      ? "What's happened across the platform." :
          isProgressor ? "What's happened on your assigned files." :
                         "What's happened across your files."
        }
      >
        {/* OLD filter strip: <Link> with inline rgba(0,0,0,0.05) container, rgba(255,255,255,0.9) active pill, rgba(0,0,0,0.08) shadow */}
        <div style={{ display: "flex", gap: 4 }}>
          <Link
            href={filterBase}
            className={`agent-segment-pill agent-segment-pill-sm${!portalOnly ? " on" : ""}`}
          >
            All milestones
          </Link>
          <Link
            href={`${filterBase}?filter=portal`}
            className={`agent-segment-pill agent-segment-pill-sm${portalOnly ? " on" : ""}`}
          >
            Client confirmations
          </Link>
        </div>
      </PageHeader>

      <div className="px-4 md:px-8 py-2 md:py-4 space-y-4">

        {milestones.length === 0 && (
          <>
            <div className="agent-glass-strong" style={{ padding: "48px 24px", textAlign: "center" }}>
              <ChartLine weight="regular" style={{ width: 32, height: 32, color: "var(--agent-text-muted)", margin: "0 auto 16px", display: "block", opacity: 0.45 }} />
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                {/* OLD: portalOnly ? "No client confirmations yet" : "No milestone activity yet" */}
                {portalOnly ? "No client confirmations yet" : "No completed steps yet"}
              </p>
              <p style={{ margin: "0 auto", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 340, lineHeight: 1.5 }}>
                {/* OLD: portalOnly
                  ? "Client confirmations will appear here when clients confirm their milestones via the portal."
                  : "Completed milestones across your files will appear here." */}
                {portalOnly
                  ? "When clients confirm steps themselves, they'll appear here."
                  : isAdmin
                    ? "Confirmed steps appear here as they happen across the platform."
                    : isProgressor
                      ? "Confirmed steps on your assigned files appear here."
                      : "Confirmed steps appear here as they happen."}
              </p>
            </div>

            {/* Ghost day-bucket preview — abstract agent-skeleton bars, filter-neutral.
                OLD: fake content (14 Maple Close, coral icon, hardcoded milestone names). */}
            <div style={{ opacity: 0.35, pointerEvents: "none" }}>
              <div className="agent-glass" style={{ overflow: "hidden" }}>
                <div className="agent-acc-hdr">
                  <div className="agent-skeleton" style={{ width: 56, height: 11, borderRadius: 4 }} />
                  <div className="agent-skeleton" style={{ width: 68, height: 11, borderRadius: 4 }} />
                </div>
                <div className="agent-acc open">
                  <div className="agent-acc-in">
                    <div className="agent-acc-body">
                      <div className="glass-card overflow-hidden">
                        <div className="px-4 py-2.5" style={{ borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
                          <div className="agent-skeleton" style={{ width: 156, height: 10, borderRadius: 4 }} />
                        </div>
                        {([148, 190] as const).map((w, i) => (
                          <div key={i} className="flex items-start gap-3 px-4 py-3" style={{
                            borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                          }}>
                            <div className="agent-skeleton mt-0.5 w-5 h-5 flex-shrink-0" style={{ borderRadius: "50%" }} />
                            <div className="flex-1 space-y-2">
                              <div className="agent-skeleton h-3" style={{ maxWidth: w, borderRadius: 4 }} />
                              <div className="agent-skeleton h-2.5" style={{ maxWidth: 52, borderRadius: 4 }} />
                            </div>
                            <div className="agent-skeleton h-2.5 w-8 flex-shrink-0" style={{ borderRadius: 4 }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {days.length > 0 && <CommsActivityFeed days={days} />}

      </div>
    </>
  );
}
