// Kinetic Depth hub — Stage 1 target for internal roles.
// Renders every section legacy renders, using the same 12 hub service
// functions. Presentation is Kinetic Depth (dark, glass, gradient
// accents, motion). When rollout completes and every agency is on this
// hub, legacy-hub.tsx gets deleted and this becomes the only version.

import type React from "react";
import Link from "next/link";
import { Plus, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { extractFirstName } from "@/lib/contacts/displayName";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import {
  getHubPipelineStats, getHubAttentionItems, getHubWins,
  getHubWeeklyForecast, getHubServiceSplit, getHubRecentActivity,
  getHubDiary, getHubUnassignedFiles, getExpiredHolds,
  getHubRelistsToAcknowledge, getHubChainSetupPending,
  getHubPipelineStages,
} from "@/lib/services/hub";
import { AttentionRowList } from "@/components/kinetic/hub/AttentionRowList";
import { KineticDiaryStrip } from "@/components/kinetic/hub/KineticDiaryStrip";
import { HoldsNeedingAttention } from "@/components/kinetic/hub/HoldsNeedingAttention";
import { InternalOnlyCards } from "@/components/kinetic/hub/InternalOnlyCards";
import { PipelineAtAGlance } from "@/components/kinetic/hub/PipelineAtAGlance";
import { PipelineHealthTiles } from "@/components/kinetic/hub/PipelineHealthTiles";
import { StalledFilesWarning } from "@/components/kinetic/hub/StalledFilesWarning";
import { WinsPanel } from "@/components/kinetic/hub/WinsPanel";
import { ServiceSplitDonut } from "@/components/kinetic/hub/ServiceSplitDonut";
import { ExchangeForecastChart } from "@/components/kinetic/hub/ExchangeForecastChart";
import { RecentActivityFeed } from "@/components/kinetic/hub/RecentActivityFeed";
import { ProTipBanner } from "@/components/kinetic/hub/ProTipBanner";
import styles from "@/components/kinetic/hub/kinetic-hub.module.css";

function getGreeting(name: string): string {
  try {
    const hourStr = new Date().toLocaleString("en-GB", {
      timeZone: "Europe/London", hour: "numeric", hour12: false,
    });
    const hour = parseInt(hourStr, 10);
    const prefix = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    return `${prefix}, ${extractFirstName(name)}`;
  } catch {
    return `Hello, ${extractFirstName(name)}`;
  }
}

export default async function KineticHub() {
  const session = await requireSession();
  const role = session.user.role;
  const isInternalStaff = role === "admin" || role === "sales_progressor" || role === "viewer";
  const isAdmin = hasAdminPowers(session);
  const canCreateSale = role === "director" || role === "negotiator" || role === "admin";

  const vis = isInternalStaff
    ? resolveInternalVisibility(session.user.id, role, isAdmin)
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);

  // All 12 hub services in one Promise.all — same set as legacy.
  const [
    pipelineStats, attentionItems, wins, weeklyForecast, serviceSplit,
    recentActivity, diaryItems, unassignedFiles, expiredHolds,
    relistsToAcknowledge, chainSetupPending, pipelineStages,
  ] = await Promise.all([
    getHubPipelineStats(vis),
    getHubAttentionItems(vis),
    getHubWins(vis),
    getHubWeeklyForecast(vis),
    getHubServiceSplit(vis),
    getHubRecentActivity(vis),
    getHubDiary(vis),
    getHubUnassignedFiles(vis),
    getExpiredHolds(vis),
    getHubRelistsToAcknowledge(vis),
    getHubChainSetupPending(vis),
    getHubPipelineStages(vis),
  ]);

  // Derived
  const escalatedCount = attentionItems.filter((i) => i.urgency === "escalated").length;
  const overdueCount   = attentionItems.filter((i) => i.urgency === "overdue").length;
  const attentionFileCount = new Set(attentionItems.map((i) => i.transaction.id)).size;
  const greeting = getGreeting(session.user.name ?? "there");
  const stalledCount = pipelineStats.stalled.count;

  // Signals feeding the pro-tip banner
  const proTipSignals = {
    chasesQuietFiles: stalledCount,
    clientSilentFiles: 0, // wired properly when audit item #6 lands
    needAssignCount: unassignedFiles.length,
    chainSetupPendingCount: chainSetupPending.length,
    holdsExpiredCount: expiredHolds.length,
    escalatedCount,
  };

  return (
    <div className={styles.root}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <div className={styles.greeting}>{greeting}</div>
          <div className={styles.headline}>
            {attentionFileCount > 0 ? (
              <>
                <span className={styles.grad}>{attentionFileCount}</span>{" "}
                {attentionFileCount === 1 ? "file needs" : "files need"} attention today
              </>
            ) : (
              <>You&rsquo;re all clear this morning</>
            )}
          </div>
        </div>
        {canCreateSale && (
          <Link href="/agent/transactions/new-v2" className={styles.primaryCta}>
            <Plus size={14} weight="bold" />
            New sale
          </Link>
        )}
      </header>

      {/* Today's diary strip (hidden when empty) */}
      <KineticDiaryStrip items={diaryItems} />

      {/* Holds needing attention — top-priority intervention */}
      <HoldsNeedingAttention items={expiredHolds} />

      {/* Big attention list — anchor of the page */}
      {attentionItems.length > 0 && (
        <section className={styles.section}>
          <AttentionRowList items={attentionItems.slice(0, 6)} />
          {attentionItems.length > 6 && (
            <Link href="/agent/work-queue" className={styles.viewAll}>
              View all {attentionItems.length} in reminders
              <ArrowRight size={12} />
            </Link>
          )}
        </section>
      )}

      {/* Cross-agency work stack — internal only, quiet for agents */}
      <InternalOnlyCards
        isInternal={isInternalStaff}
        unassignedFiles={unassignedFiles}
        relistsToAcknowledge={relistsToAcknowledge}
        chainSetupPending={chainSetupPending}
      />

      {/* Pipeline at a glance — 5 stage tiles */}
      <PipelineAtAGlance stages={pipelineStages} />

      {/* Pipeline health — 4 KPIs */}
      <PipelineHealthTiles
        activeFiles={pipelineStats.activeFiles}
        newThisMonth={pipelineStats.newThisMonth}
        exchangingSoon={pipelineStats.exchangingSoon}
        exchangingThisWeek={pipelineStats.comingUp.exchangingThisWeek}
        next30Days={weeklyForecast.reduce((s, w) => s + w.count, 0)}
        needAttention={attentionFileCount}
        escalated={escalatedCount}
        overdue={overdueCount}
        pipelineValuePence={pipelineStats.pipelineValuePence}
        closingThisMonthPence={pipelineStats.comingUp.closingThisMonth.total}
      />

      {/* Stalled files warning row */}
      <StalledFilesWarning count={stalledCount} />

      {/* Wins + Service split, two columns */}
      <section className={styles.twoCol}>
        <WinsPanel wins={wins} />
        <ServiceSplitDonut
          selfManaged={serviceSplit.selfManaged}
          outsourced={serviceSplit.outsourced}
          isInternal={isInternalStaff}
        />
      </section>

      {/* Exchange forecast — full-width chart */}
      <section className={styles.section}>
        <ExchangeForecastChart forecast={weeklyForecast} />
      </section>

      {/* Recent activity — single latest item (service returns one today; component ready to accept more) */}
      {recentActivity && (
        <section className={styles.section}>
          <RecentActivityFeed activity={recentActivity} />
        </section>
      )}

      {/* Pro tip banner — contextual */}
      <ProTipBanner signals={proTipSignals} />
    </div>
  );
}
