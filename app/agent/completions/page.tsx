import Link from "next/link";
import { ClockCountdown } from "@phosphor-icons/react/dist/ssr";
import { requireSession } from "@/lib/session";
import { getAgentCompletions, resolveAgentVisibility } from "@/lib/services/agent";
import {
  CompletionsGroupList,
  type CompletionGroup,
  type CompletionFileRow,
} from "@/components/completions/CompletionsGroupList";

function fmtCompact(pence: number) {
  const pounds = pence / 100;
  if (pounds >= 1_000_000) return "£" + (pounds / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  return "£" + pounds.toLocaleString("en-GB");
}

const GROUP_STYLES_STAT = {
  overdue:   { statColor: "#dc2626" },
  this_week: { statColor: "#d97706" },
  next_week: { statColor: "#3b82f6" },
  later:     { statColor: "rgba(15,23,42,0.5)" },
  no_date:   { statColor: "rgba(15,23,42,0.4)" },
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
    .map((k) => ({ key: k, label: STAT_LABELS[k], count: counts[k], color: GROUP_STYLES_STAT[k].statColor, anchor: `#section-${k}` }));

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

    const fileRows: CompletionFileRow[] = group.map((f) => {
      const daysRel = f.completionDate
        ? Math.round((new Date(f.completionDate).setHours(0, 0, 0, 0) - today.getTime()) / 86400000)
        : null;

      let daysLabel = "";
      let daysColor = "rgba(15,23,42,0.4)";
      if (daysRel !== null) {
        if (daysRel < 0)        { daysLabel = `${Math.abs(daysRel)} days overdue`; daysColor = "#dc2626"; }
        else if (daysRel === 0) { daysLabel = "today";    daysColor = "#d97706"; }
        else if (daysRel === 1) { daysLabel = "tomorrow"; }
        else                    { daysLabel = `in ${daysRel} days`; }
      }

      return {
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
        daysRel,
        daysLabel,
        daysColor,
      };
    });

    return [{ key, label, files: fileRows, groupValue, groupFeeTotal, missingFeeCount }];
  });

  return (
    <>
      {/* ── Page header ──────────────────────────────────────────────────────── */}
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
        <div className="relative px-4 pt-6 pb-4 md:px-8">
          <h1 style={{ margin: 0, fontSize: "var(--agent-text-h1)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>Completions</h1>
          <p style={{ margin: "4px 0 0", fontSize: "var(--agent-text-body-sm)", color: "var(--agent-text-tertiary)" }}>Files that have exchanged and are heading to completion.</p>

          {/* Stat row — each anchor is ≥44px tall for touch */}
          {statSegments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", rowGap: 0, marginTop: 10 }}>
              {statSegments.map((s, i) => (
                <span key={s.key} style={{ display: "flex", alignItems: "center" }}>
                  {i > 0 && <span style={{ color: "rgba(15,23,42,0.2)", margin: "0 8px" }}>·</span>}
                  <a href={s.anchor} style={{ fontSize: 12, color: s.color, fontWeight: 500, textDecoration: "none", minHeight: 44, display: "flex", alignItems: "center" }}>
                    {s.count} {s.label}
                  </a>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 py-5 md:py-7 space-y-7">

        {/* Empty state */}
        {files.length === 0 && (
          <div className="text-center py-16">
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <ClockCountdown size={40} weight="thin" style={{ color: "rgba(15,23,42,0.2)" }} />
            </div>
            <p className="text-base font-medium text-slate-900/50 mb-2">No files awaiting completion</p>
            <p className="text-sm text-slate-900/40 mb-1">Once a file exchanges, it&apos;ll appear here as it heads toward completion.</p>
            <p className="text-sm text-slate-900/30">We&apos;ll track target dates, days remaining, and surface anything that drifts past its date.</p>
          </div>
        )}

        {/* Pipeline summary — numbers prominent, descriptors muted */}
        {files.length > 0 && (
          <p style={{ fontSize: 13, color: "rgba(15,23,42,0.40)", margin: 0 }}>
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
