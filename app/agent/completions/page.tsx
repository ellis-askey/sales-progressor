import Link from "next/link";
import { ClockCountdown } from "@phosphor-icons/react/dist/ssr";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { getAgentCompletions, getAgentCompletedFiles, resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import {
  CompletionsGroupList,
  type CompletionGroup,
  type CompletionFileRow,
} from "@/components/completions/CompletionsGroupList";
import { CompletionStats } from "@/components/completions/CompletionStats";
import { CompletedSection } from "@/components/completions/CompletedSection";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatPill } from "@/components/layout/StatPill";
import type { PillColor } from "@/components/layout/StatPill";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { toUKDateStr } from "@/lib/utils";

// Bespoke composer per Skeleton.tsx's contract — encodes the
// completions ghost layout. Inner pulses wrap canonical Skeleton.
function Bar({ width, height, mt = 0, mb = 0, radius = 4 }: {
  width: string | number;
  height: number;
  mt?: number;
  mb?: number;
  radius?: number | string;
}) {
  return (
    <Skeleton
      variant="block"
      width={width}
      height={height}
      style={{ borderRadius: radius, marginTop: mt, marginBottom: mb, display: "block" }}
    />
  );
}

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
  const isInternalStaff = session.user.role === "admin" || session.user.role === "sales_progressor" || session.user.role === "viewer";
  const isProgressor = session.user.role === "sales_progressor";
  const isAdmin = hasAdminPowers(session);
  const vis = isInternalStaff
    ? resolveInternalVisibility(session.user.id, session.user.role, isAdmin)
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const [files, completedFiles] = await Promise.all([
    getAgentCompletions(vis),
    getAgentCompletedFiles(vis),
  ]);

  // Sign every property photo (pending + completed) in one round trip.
  const photoMap = await getSignedUrlMap([
    ...files.map((f) => f.photoStoragePath),
    ...completedFiles.map((f) => f.photoStoragePath),
  ]);
  const signed = (p: string | null) => (p ? photoMap.get(p) ?? null : null);

  const now = new Date();
  const todayStr = toUKDateStr(now);
  const in7Str  = toUKDateStr(new Date(now.getTime() + 7 * 86400000));
  const in14Str = toUKDateStr(new Date(now.getTime() + 14 * 86400000));

  function urgencyFor(date: Date | null) {
    if (!date) return "no_date";
    const dStr = toUKDateStr(date);
    if (dStr < todayStr) return "overdue";
    if (dStr < in7Str)   return "this_week";
    if (dStr < in14Str)  return "next_week";
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
        agencyName:            isInternalStaff ? (f.agencyName ?? null) : undefined,
        photoUrl:              signed(f.photoStoragePath),
      }));

    return [{ key, label, files: fileRows, groupValue, groupFeeTotal, missingFeeCount }];
  });

  return (
    <>
      {/* OLD subtitle: "Files that have exchanged and are heading to completion." */}
      <PageHeader
        title="Completions"
        subtitle={
          isAdmin      ? "All exchanged files across every agency." :
          isProgressor ? "Your assigned outsourced files, tracking to completion." :
                         "Exchanged files, tracking to completion."
        }
      >
        {statSegments.map(s => (
          <StatPill key={s.key} href={s.anchor} label={s.label} color={s.pillColor} />
        ))}
      </PageHeader>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 py-2 md:py-4 space-y-7">

        {/* Empty state */}
        {files.length === 0 && (
          <>
            <div className="agent-glass-strong agent-empty-card" style={{ padding: "48px 24px", textAlign: "center" }}>
              <ClockCountdown
                size={32}
                weight="regular"
                style={{ color: "var(--agent-text-muted)", margin: "0 auto 16px", display: "block", opacity: 0.45 }}
              />
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                {completedFiles.length > 0 ? "Nothing heading to completion right now" : "No completions"}
              </p>
              <p style={{ margin: "0 auto", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 340, lineHeight: 1.5 }}>
                {completedFiles.length > 0
                  ? "Files appear here once they exchange. Your completed files are below."
                  : "Files appear here once they exchange."}
              </p>
            </div>

            {/* Ghost skeleton only when the page is genuinely empty (no completed history below). */}
            {completedFiles.length === 0 && (
            <div style={{ opacity: 0.35, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Ghost group 1 — overdue shape */}
              <div className="agent-glass" style={{ overflow: "hidden" }}>
                <div className="agent-acc-hdr" style={{ pointerEvents: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                    <Skeleton variant="circle" width={10} style={{ display: "block" }} />
                    <Bar width={80} height={11} />
                  </div>
                  <Bar width={64} height={11} />
                </div>
                <div className="agent-acc open">
                  <div className="agent-acc-in">
                    <div className="agent-acc-body">
                      <div className="space-y-2">
                        {[200, 240].map((w, i) => (
                          <Card key={i} padding="none">
                            <div className="px-5 py-4" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                              <div>
                                <Bar width={w} height={13} radius={6} mb={5} />
                                <Bar width={110} height={11} radius={6} />
                              </div>
                              <Bar width={52} height={22} radius={99} />
                            </div>
                          </Card>
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
                    <Skeleton variant="circle" width={10} style={{ display: "block" }} />
                    <Bar width={140} height={11} />
                  </div>
                  <Bar width={56} height={11} />
                </div>
              </div>
            </div>
            )}
          </>
        )}

        {/* Headed summary tiles */}
        {files.length > 0 && (
          <CompletionStats
            tiles={[
              { label: files.length !== 1 ? "Files" : "File", value: String(files.length) },
              ...(filesWithPrice > 0 ? [{ label: "Sale value", value: fmtCompact(totalValue) }] : []),
              ...(filesWithFee > 0 ? [{ label: "Your fees", value: fmtCompact(totalFees), accent: true }] : []),
              { label: "This week", value: String(counts.this_week) },
            ]}
          />
        )}

        {/* ── Groups (collapsible, all start collapsed) ───────────────────── */}
        {completionGroups.length > 0 && (
          <CompletionsGroupList groups={completionGroups} />
        )}

        {/* ── Completed history (collapsed, 3 most recent) ─────────────────── */}
        <CompletedSection
          files={completedFiles.map((f) => ({
            id: f.id,
            propertyAddress: f.propertyAddress,
            completionDateIso: f.completionDate ? new Date(f.completionDate).toISOString() : null,
            purchasePrice: f.purchasePrice ?? null,
            agentFeeAmount: f.agentFeeAmount ?? null,
            purchasers: f.purchasers,
            agencyName: isInternalStaff ? (f.agencyName ?? null) : undefined,
            assignedUserName: f.assignedUserName ?? null,
            photoUrl: signed(f.photoStoragePath),
          }))}
        />
      </div>
    </>
  );
}
