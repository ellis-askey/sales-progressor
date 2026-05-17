import Link from "next/link";
import { ClockCountdown } from "@phosphor-icons/react/dist/ssr";
import { requireSession } from "@/lib/session";
import { getAgentCompletions, resolveAgentVisibility } from "@/lib/services/agent";
import {
  CompletionsGroupList,
  type CompletionGroup,
  type CompletionFileRow,
} from "@/components/completions/CompletionsGroupList";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatPill } from "@/components/layout/StatPill";
import type { PillColor } from "@/components/layout/StatPill";

function fmtCompact(pence: number) {
  const pounds = pence / 100;
  if (pounds >= 1_000_000) return "£" + (pounds / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  return "£" + pounds.toLocaleString("en-GB");
}

const GROUP_STYLES_STAT = {
  overdue:   { statColor: "#dc2626", pillColor: "danger"  as PillColor },
  this_week: { statColor: "#d97706", pillColor: "warning" as PillColor },
  next_week: { statColor: "#3b82f6", pillColor: "muted"   as PillColor },
  later:     { statColor: "rgba(15,23,42,0.5)", pillColor: "muted" as PillColor },
  no_date:   { statColor: "rgba(15,23,42,0.4)", pillColor: "muted" as PillColor },
} as const;

const STAT_LABELS: Record<string, string> = {
  overdue:   "overdue",
  this_week: "this week",
  next_week: "next week",
  later:     "later",
  no_date:   "no date",
};

const ALL_GROUPS = [
  { key: "overdue"   as const, label: "Overdue" },
  { key: "this_week" as const, label: "Completing this week" },
  { key: "next_week" as const, label: "Completing next week" },
  { key: "later"     as const, label: "Later" },
  { key: "no_date"   as const, label: "No completion date set" },
];

export default async function AgentCompletionsPage() {
  const session = await requireSession();
  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const files = await getAgentCompletions(vis);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7  = new Date(today); in7.setDate(today.getDate() + 7);
  const in14 = new Date(today); in14.setDate(today.getDate() + 14);

  function urgencyFor(date: Date | null) {
    if (!date) return "no_date";
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    if (d < today) return "overdue";
    if (d < in7)   return "this_week";
    if (d < in14)  return "next_week";
    return "later";
  }

  const counts = { overdue: 0, this_week: 0, next_week: 0, later: 0, no_date: 0 };
  for (const f of files) counts[urgencyFor(f.completionDate)]++;

  const statSegments = (["overdue", "this_week", "next_week", "later", "no_date"] as const)
    .filter((k) => counts[k] > 0)
    .map((k) => ({ key: k, label: `${counts[k]} ${STAT_LABELS[k]}`, pillColor: GROUP_STYLES_STAT[k].pillColor, anchor: `#section-${k}` }));

  const totalValue    = files.reduce((sum, f) => sum + (f.purchasePrice  ?? 0), 0);
  const filesWithPrice = files.filter((f) => f.purchasePrice).length;
  const totalFees     = files.reduce((sum, f) => sum + (f.agentFeeAmount ?? 0), 0);
  const filesWithFee  = files.filter((f) => f.agentFeeAmount).length;

  // Pre-compute groups with serialisable per-file data for the client component
  const completionGroups: CompletionGroup[] = ALL_GROUPS.flatMap(({ key, label }) => {
    const group = files.filter((f) => urgencyFor(f.completionDate) === key);
    if (group.length === 0) return [];

    const groupValue      = group.reduce((sum, f) => sum + (f.purchasePrice  ?? 0), 0);
    const groupFeeTotal   = group.reduce((sum, f) => sum + (f.agentFeeAmount ?? 0), 0);
    const missingFeeCount = group.filter((f) => !f.agentFeeAmount).length;

    /* OLD: server computed daysRel, daysLabel, daysColor (hex strings) and serialised into row.
       Now computed client-side in CompletionFileRowView via computeDays() using CSS var tokens. */
    const fileRows: CompletionFileRow[] = group.map((f) => ({
        id:                    f.id,
        propertyAddress:       f.propertyAddress,
        purchasePrice:         f.purchasePrice ?? null,
        agentFeeAmount:        f.agentFeeAmount ?? null,
        purchasers:            f.purchasers,
        assignedUserName:      f.assignedUserName ?? null,
        exchangedAtIso:        f.exchangedAt ? new Date(f.exchangedAt).toISOString() : null,
        completionDateIso:     f.completionDate ? new Date(f.completionDate).toISOString() : null,
        vendorSolicitorName:   f.vendorSolicitorName ?? null,
        purchaserSolicitorName: f.purchaserSolicitorName ?? null,
      }));

    return [{ key, label, files: fileRows, groupValue, groupFeeTotal, missingFeeCount }];
  });

  return (
    <>
      {/* OLD subtitle: "Files that have exchanged and are heading to completion." */}
      <PageHeader title="Completions" subtitle="Exchanged files, tracking to completion.">
        {statSegments.map(s => (
          <StatPill key={s.key} href={s.anchor} label={s.label} color={s.pillColor} />
        ))}
      </PageHeader>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 py-2 md:py-4 space-y-7">

        {/* Empty state */}
        {files.length === 0 && (
          <>
            <div className="agent-glass-strong" style={{ padding: "48px 24px", textAlign: "center" }}>
              <ClockCountdown
                size={32}
                weight="regular"
                style={{ color: "var(--agent-text-muted)", margin: "0 auto 16px", display: "block", opacity: 0.45 }}
              />
              {/* OLD: "No files awaiting completion" */}
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                No completions
              </p>
              <p style={{ margin: "0 auto", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 340, lineHeight: 1.5 }}>
                Once a file exchanges, it&apos;ll appear here as it heads toward completion.
              </p>
            </div>

            {/* Ghost — abstract agent-skeleton bars in urgency-group shape.
                OLD: fake real-looking content (addresses, solicitor names, hardcoded hex colours).
                Per polish-pass standard: no fake copy, no hardcoded hex, opacity 0.35. */}
            <div style={{ opacity: 0.35, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Ghost group 1 — overdue shape */}
              <div className="agent-glass" style={{ overflow: "hidden" }}>
                <div className="agent-acc-hdr" style={{ pointerEvents: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                    <div className="agent-skeleton" style={{ width: 10, height: 10, borderRadius: "50%" }} />
                    <div className="agent-skeleton" style={{ height: 11, width: 80, borderRadius: 4 }} />
                  </div>
                  <div className="agent-skeleton" style={{ height: 11, width: 64, borderRadius: 4 }} />
                </div>
                <div className="agent-acc open">
                  <div className="agent-acc-in">
                    <div className="agent-acc-body">
                      <div className="space-y-2">
                        {[200, 240].map((w, i) => (
                          <div key={i} className="glass-card overflow-hidden">
                            <div className="px-5 py-4" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                              <div>
                                <div className="agent-skeleton" style={{ height: 13, width: w, borderRadius: 6, marginBottom: 5 }} />
                                <div className="agent-skeleton" style={{ height: 11, width: 110, borderRadius: 6 }} />
                              </div>
                              <div className="agent-skeleton" style={{ height: 22, width: 52, borderRadius: 99 }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Ghost group 2 — this-week shape (collapsed) */}
              <div className="agent-glass" style={{ overflow: "hidden" }}>
                <div className="agent-acc-hdr" style={{ pointerEvents: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                    <div className="agent-skeleton" style={{ width: 10, height: 10, borderRadius: "50%" }} />
                    <div className="agent-skeleton" style={{ height: 11, width: 140, borderRadius: 4 }} />
                  </div>
                  <div className="agent-skeleton" style={{ height: 11, width: 56, borderRadius: 4 }} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Pipeline summary — numbers prominent, descriptors muted */}
        {/* OLD: color: "rgba(15,23,42,0.40)" */}
        {files.length > 0 && (
          <p style={{ fontSize: 13, color: "var(--agent-text-muted)", margin: 0 }}>
            <span style={{ fontWeight: 700, color: "var(--agent-text-primary)" }}>{files.length}</span>
            {" "}{files.length !== 1 ? "files" : "file"}
            {filesWithFee > 0 && (
              <>{" · "}<span style={{ fontWeight: 700, color: "var(--agent-text-primary)" }}>{fmtCompact(totalFees)}</span>{" total fees"}</>
            )}
            {filesWithPrice > 0 && (
              <>{" · "}<span style={{ fontWeight: 700, color: "var(--agent-text-primary)" }}>{fmtCompact(totalValue)}</span>{" in sales"}</>
            )}
          </p>
        )}

        {/* ── Groups (collapsible, all start collapsed) ───────────────────── */}
        {completionGroups.length > 0 && (
          <CompletionsGroupList groups={completionGroups} />
        )}
      </div>
    </>
  );
}
