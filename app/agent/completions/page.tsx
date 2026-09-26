import Link from "next/link";
import { ClockCountdown, Plus, ListChecks } from "@phosphor-icons/react/dist/ssr";
import { SetupCard } from "@/components/agent/SetupCard";
import { HeroArt } from "@/components/agent/HeroArt";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { getAgentCompletions, getAgentCompletedFiles, getCompletionsMomentum, resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import {
  CompletionsGroupList,
  type CompletionGroup,
  type CompletionFileRow,
} from "@/components/completions/CompletionsGroupList";
import { CompletionsMomentum } from "@/components/completions/CompletionsMomentum";
import { CompletionsTimeline, type TimelineDay } from "@/components/completions/CompletionsTimeline";
import { CompletingTodayCard, type TodayFile } from "@/components/completions/CompletingTodayCard";
import { CompletedSection } from "@/components/completions/CompletedSection";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatPill } from "@/components/layout/StatPill";
import type { PillColor } from "@/components/layout/StatPill";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { toUKDateStr } from "@/lib/utils";

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

// The bottom "Track your setup progress" guide card is built below but hidden
// until its "View all steps" modal exists (logged in docs/active/TODO.md).
const SHOW_SETUP_GUIDE = false;

export default async function AgentCompletionsPage() {
  const session = await requireSession();
  const isInternalStaff = session.user.role === "admin" || session.user.role === "sales_progressor" || session.user.role === "viewer";
  const isProgressor = session.user.role === "sales_progressor";
  const isAdmin = hasAdminPowers(session);
  const vis = isInternalStaff
    ? resolveInternalVisibility(session.user.id, session.user.role, isAdmin)
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const [files, completedFiles, momentum] = await Promise.all([
    getAgentCompletions(vis),
    getAgentCompletedFiles(vis),
    getCompletionsMomentum(vis),
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

  const totalValue = files.reduce((sum, f) => sum + (f.purchasePrice ?? 0), 0);

  // Week-ahead timeline: days (today..+14) that have completions, chain-flagged.
  const timelineDays: TimelineDay[] = (() => {
    const byDay = new Map<string, { dateObj: Date; count: number; chainCount: number }>();
    for (const f of files) {
      if (!f.completionDate) continue;
      const d = new Date(f.completionDate);
      const dStr = toUKDateStr(d);
      if (dStr < todayStr || dStr > in14Str) continue;
      const cur = byDay.get(dStr) ?? { dateObj: d, count: 0, chainCount: 0 };
      cur.count++;
      if ((f.chainSize ?? 1) > 1) cur.chainCount++;
      byDay.set(dStr, cur);
    }
    return [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(0, 7)
      .map(([key, v]) => ({
        key,
        dow: v.dateObj.toLocaleDateString("en-GB", { weekday: "short" }),
        dayNum: v.dateObj.getDate(),
        count: v.count,
        chainCount: v.chainCount,
        isToday: key === todayStr,
      }));
  })();

  // Files completing today → the command card.
  const todayFiles: TodayFile[] = files
    .filter((f) => f.completionDate && toUKDateStr(new Date(f.completionDate)) === todayStr)
    .map((f) => ({
      id: f.id,
      propertyAddress: f.propertyAddress,
      purchasers: f.purchasers,
      purchasePrice: f.purchasePrice ?? null,
      chainSize: f.chainSize ?? 1,
      solsOk: !!f.vendorSolicitorName && !!f.purchaserSolicitorName,
      fundsOk: isInternalStaff ? f.completionFundsSent === true || f.fundsInPlace === "yes" : null,
      keysReleased: f.keysReleased,
    }));

  // Brand-new agency user (no pending, no completed history): show the onboarding
  // empty state (hero + "getting set up" cards). Internal staff never see it.
  const isBrandNew = files.length === 0 && completedFiles.length === 0 && !isInternalStaff;

  // Pre-compute groups with serialisable per-file data for the client component
  const completionGroups: CompletionGroup[] = ALL_GROUPS.flatMap(({ key, label }) => {
    const group = files.filter((f) => urgencyFor(f.completionDate) === key);
    if (group.length === 0) return [];

    const groupValue      = group.reduce((sum, f) => sum + (f.purchasePrice  ?? 0), 0);
    const groupFeeTotal   = group.reduce((sum, f) => sum + (f.agentFeeAmount ?? 0) + f.brokerFeeTotal, 0);
    const missingFeeCount = group.filter((f) => !f.agentFeeAmount).length;

    /* OLD: server computed daysRel, daysLabel, daysColor (hex strings) and serialised into row.
       Now computed client-side in CompletionFileRowView via computeDays() using CSS var tokens. */
    const fileRows: CompletionFileRow[] = group.map((f) => ({
        id:                    f.id,
        propertyAddress:       f.propertyAddress,
        purchasePrice:         f.purchasePrice ?? null,
        agentFeeAmount:        f.agentFeeAmount ?? null,
        agentFeePercent:       f.agentFeePercent ?? null,
        agentFeeIsVatInclusive: f.agentFeeIsVatInclusive ?? null,
        purchasers:            f.purchasers,
        assignedUserName:      f.assignedUserName ?? null,
        exchangedAtIso:        f.exchangedAt ? new Date(f.exchangedAt).toISOString() : null,
        completionDateIso:     f.completionDate ? new Date(f.completionDate).toISOString() : null,
        vendorSolicitorName:   f.vendorSolicitorName ?? null,
        purchaserSolicitorName: f.purchaserSolicitorName ?? null,
        agencyName:            isInternalStaff ? (f.agencyName ?? null) : undefined,
        photoUrl:              signed(f.photoStoragePath),
        // Completions hub: journey + buyer-entered context (funds gated to internal)
        internal:              isInternalStaff,
        // Progressors are blocked from editing commercial fees server-side, so
        // don't offer them the inline editor — it could only ever fail.
        hideFeeEdit:           isProgressor,
        chainSize:             f.chainSize,
        instructedAtIso:       f.instructedAt ? new Date(f.instructedAt).toISOString() : null,
        firstTimeBuyer:        f.firstTimeBuyer,
        sellingRelated:        f.sellingRelated,
        mortgageOfferExpiryIso: f.mortgageOfferExpiry ? new Date(f.mortgageOfferExpiry).toISOString() : null,
        ...(isInternalStaff ? {
          fundsInPlace:        f.fundsInPlace,
          depositPence:        f.depositPence,
          mortgagePence:       f.mortgagePence,
          otherFundsPence:     f.otherFundsPence,
          completionFundsSent: f.completionFundsSent,
        } : {}),
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

        {/* Empty state — brand-new agency users get the onboarding layout. */}
        {files.length === 0 && isBrandNew && (
          <>
            {/* Hero — matches the other empty states (gradient + HeroArt; the
                generic backdrop takes over < 1000px via HeroArt). */}
            <div
              style={{
                position: "relative", overflow: "hidden",
                borderRadius: "var(--agent-radius-xl)", minHeight: 210, padding: "28px 30px",
                border: "1px solid var(--agent-border-subtle)",
                background: "linear-gradient(100deg, rgba(var(--agent-coral-rgb),0.14), rgba(var(--agent-coral-rgb),0.05) 52%, transparent 78%)",
              }}
            >
              <HeroArt light="/completions-hero.png" dark="/completions-hero-dark.png" maxWidth="46%" maskStart="42%" />
              <div style={{ position: "relative", maxWidth: 480 }}>
                <p style={{ margin: "0 0 8px", fontSize: "var(--agent-text-h2)", fontWeight: 600, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)" }}>
                  No completions yet
                </p>
                <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 430 }}>
                  Once files are exchanged, they&apos;ll appear here and you&apos;ll be able to track them all the way to completion.
                </p>
                <Link href="/agent/transactions/new" className="agent-btn agent-btn-primary agent-btn-md" style={{ textDecoration: "none", display: "inline-flex", width: "fit-content" }}>
                  <Plus size={16} weight="bold" />
                  Add your first sale
                </Link>
              </div>
            </div>

            {/* While you're getting set up */}
            <div>
              <p className="agent-eyebrow" style={{ marginBottom: 12 }}>While you&apos;re getting set up</p>
              <div className="setup-cards-3">
                <SetupCard
                  glassId="empty-completions-profile"
                  label="Completions empty · Complete profile"
                  iconSrc="/setup-profile.png"
                  tint="coral"
                  title="Complete your profile"
                  desc="Add your contact details and photo so clients know who they're dealing with."
                  cta="Set up profile"
                  href="/agent/account/profile"
                />
                <SetupCard
                  glassId="empty-completions-agency"
                  label="Completions empty · Set up agency"
                  iconSrc="/setup-agency.png"
                  tint="blue"
                  title="Set up your agency"
                  desc="Add your branding and contact details to personalise the client experience."
                  cta="Agency settings"
                  href="/agent/account/profile"
                />
                <SetupCard
                  glassId="empty-completions-invite"
                  label="Completions empty · Invite team"
                  iconSrc="/setup-invite.png"
                  tint="green"
                  title="Invite your team"
                  desc="Add your negotiators so they're ready when your first sales come in."
                  cta="Invite team"
                  href="/agent/account/team"
                />
              </div>
            </div>

            {/* Bottom guide card — built, hidden until its "View all steps" modal
                exists (docs/active/TODO.md). Flip SHOW_SETUP_GUIDE to reveal. */}
            {SHOW_SETUP_GUIDE && (
              <div className="agent-glass" style={{ padding: "18px 20px", borderRadius: "var(--agent-radius-lg)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(var(--agent-coral-rgb), 0.12)", color: "var(--agent-coral-deep)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <ListChecks size={20} weight="regular" />
                  </span>
                  <div>
                    <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Track your setup progress</p>
                    <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>Follow the Getting started guide to make sure you&apos;re ready to go.</p>
                  </div>
                </div>
                {/* TODO: opens the "View all steps" modal (see docs/active/TODO.md). */}
                <button type="button" className="agent-btn agent-btn-secondary agent-btn-sm" style={{ gap: 8, flexShrink: 0 }}>
                  <ListChecks size={14} weight="bold" />
                  View all steps
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty state — has completed history, or internal staff: the simpler card. */}
        {files.length === 0 && !isBrandNew && (
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
        )}

        {/* Finish-line band — the payoff (completed, turnaround, on-time, in flight) */}
        {files.length > 0 && (
          <CompletionsMomentum
            completed30dCount={momentum.completed30dCount}
            completed30dValuePence={momentum.completed30dValuePence}
            avgExchangeToCompletionDays={momentum.avgExchangeToCompletionDays}
            onTimePct={momentum.onTimePct}
            inFlightCount={files.length}
            inFlightValuePence={totalValue}
          />
        )}

        {/* Completing today — command card (only on days there are completions) */}
        {todayFiles.length > 0 && <CompletingTodayCard files={todayFiles} />}

        {/* Week-ahead timeline */}
        {timelineDays.length > 0 && <CompletionsTimeline days={timelineDays} />}

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
            exchangedAtIso: f.exchangedAt ? new Date(f.exchangedAt).toISOString() : null,
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

// Perceived-performance (2026-09-18): let the client router reuse this
// page for 5 minutes after a visit — moving around a working burst never
// re-renders a page you just saw. Per-page opt-in rather than a global
// staleTimes so buyer/seller portal navigation keeps its default
// always-fresh behaviour. Every mutation still purges this via its
// revalidatePath calls, and the "As of" button force-refreshes.
export const unstable_dynamicStaleTime = 300;
