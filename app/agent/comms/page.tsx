import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getAgentMilestoneActivity, resolveAgentVisibility } from "@/lib/services/agent";

function relativeDate(d: Date | string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

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

  // Group into day buckets
  const days: { label: string; items: typeof milestones }[] = [];
  for (const m of milestones) {
    const label = dayLabel(m.completedAt);
    const last = days[days.length - 1];
    if (last && last.label === label) {
      last.items.push(m);
    } else {
      days.push({ label, items: [m] });
    }
  }

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
        <div style={{ position: "relative", padding: "24px 32px 28px" }}>
          <p className="agent-eyebrow" style={{ marginBottom: 12 }}>Agent Portal</p>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "var(--agent-text-h1)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>Updates</h1>
              <p style={{ margin: "4px 0 0", fontSize: "var(--agent-text-body-sm)", color: "var(--agent-text-tertiary)" }}>
                Milestone activity across all your files.
              </p>
            </div>
            {/* Filter tabs */}
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.40)", borderRadius: 10, padding: 3 }}>
              <Link
                href={filterBase}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "5px 12px",
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
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "5px 12px",
                  borderRadius: 7,
                  textDecoration: "none",
                  transition: "background 150ms",
                  background: portalOnly ? "rgba(255,255,255,0.9)" : "transparent",
                  color: portalOnly ? "var(--agent-text-primary)" : "var(--agent-text-secondary)",
                  boxShadow: portalOnly ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Portal confirmations
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-7 space-y-6">

        {milestones.length === 0 && (
          <div className="text-center py-16">
            <p className="text-base text-slate-900/50 mb-1">
              {portalOnly ? "No portal confirmations yet" : "No milestone activity yet"}
            </p>
            <p className="text-sm text-slate-900/40">
              {portalOnly
                ? "Client portal confirmations will appear here when clients confirm their milestones."
                : "Completed milestones across your files will appear here."}
            </p>
          </div>
        )}

        {days.map(({ label, items }) => (
          <div key={label}>
            <p className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-3">{label}</p>
            <div className="glass-card divide-y divide-white/15">
              {items.map((m) => {
                const isPortal = !!m.statusReason?.includes("via portal");
                const clientName = isPortal
                  ? (m.statusReason?.replace(/^Confirmed by /, "").replace(/ via portal$/, "") ?? "Client")
                  : null;
                const side = m.milestoneDefinition.side;
                return (
                  <div key={m.id} className="flex items-start gap-3 px-4 py-3.5">
                    {/* Check circle */}
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isPortal ? "bg-violet-100" : "bg-emerald-100"
                    }`}>
                      <svg className={`w-3 h-3 ${isPortal ? "text-violet-600" : "text-emerald-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-900/80">{m.milestoneDefinition.name}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          side === "vendor"
                            ? "bg-blue-50 text-blue-600"
                            : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {side === "vendor" ? "Vendor" : "Purchaser"}
                        </span>
                        {isPortal && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200">
                            Client confirmed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Link
                          href={`/agent/transactions/${m.transaction.id}`}
                          className="text-xs text-blue-500 hover:text-blue-600 transition-colors truncate"
                        >
                          {m.transaction.propertyAddress}
                        </Link>
                        <span className="text-xs text-slate-900/30">
                          · {isPortal ? clientName : (m.completedBy?.name ?? "unknown")}
                        </span>
                      </div>
                    </div>

                    {/* Time */}
                    <span className="text-[11px] text-slate-900/35 flex-shrink-0 mt-0.5">{relativeDate(m.completedAt)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

      </div>
    </>
  );
}
