// Kinetic Depth hub — Stage 1 target for internal roles.
//
// 2026-08-10: progressive-reveal loading pattern. The shell (header,
// greeting, "New sale" CTA) renders immediately from session data.
// Each async section is its own Suspense-bounded child that fetches its
// OWN data — the moment each service resolves, its section streams in
// and the SectionReveal wrapper fades it up with a small `order` stagger
// so multi-section resolves cascade top-to-bottom.
//
// Presentation is Kinetic Depth (dark, glass, gradient accents, motion).
// When rollout completes and every agency is on this hub, legacy-hub.tsx
// gets deleted and this becomes the only version.

import type React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { Plus, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { extractFirstName } from "@/lib/contacts/displayName";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import type { AgentVisibility } from "@/lib/services/agent";
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
import { SectionReveal } from "@/components/hub/SectionReveal";
import { SectionLoading } from "@/components/hub/SectionLoading";
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

// Both agent + internal resolvers return AgentVisibility (internal branch
// just sets internalMode). Aliased for readability of the slot signatures.
type Vis = AgentVisibility;

export default async function KineticHub() {
  const session = await requireSession();
  const role = session.user.role;
  const isInternalStaff = role === "admin" || role === "sales_progressor" || role === "viewer";
  const isAdmin = hasAdminPowers(session);
  const canCreateSale = role === "director" || role === "negotiator" || role === "admin";

  const vis = isInternalStaff
    ? resolveInternalVisibility(session.user.id, role, isAdmin)
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);

  const greeting = getGreeting(session.user.name ?? "there");

  return (
    <div className={styles.root}>
      {/* Header — instant. Attention count fills in once counted. */}
      <header className={styles.header}>
        <div>
          <div className={styles.greeting}>{greeting}</div>
          <Suspense fallback={<div className={styles.headline} style={{ opacity: 0.55 }}>Looking for what needs attention today…</div>}>
            <HeadlineSlot vis={vis} />
          </Suspense>
        </div>
        {canCreateSale && (
          <Link href="/agent/transactions/new" className={styles.primaryCta}>
            <Plus size={14} weight="bold" />
            New sale
          </Link>
        )}
      </header>

      {/* Today's diary — hidden when empty */}
      <Suspense fallback={null}>
        <DiarySlot vis={vis} />
      </Suspense>

      {/* Holds needing attention */}
      <Suspense fallback={null}>
        <HoldsSlot vis={vis} />
      </Suspense>

      {/* Big attention list — anchor of the page */}
      <Suspense fallback={
        <section className={styles.section}>
          <SectionLoading label="Looking for anything needing attention…" />
        </section>
      }>
        <AttentionSlot vis={vis} />
      </Suspense>

      {/* Cross-agency work stack — internal only */}
      <Suspense fallback={null}>
        <WorkStackSlot vis={vis} isInternal={isInternalStaff} />
      </Suspense>

      {/* Pipeline at a glance */}
      <Suspense fallback={
        <div className={styles.section}>
          <SectionLoading label="Loading pipeline stages…" minHeight={120} />
        </div>
      }>
        <PipelineStagesSlot vis={vis} />
      </Suspense>

      {/* Pipeline health tiles + stalled-files warning */}
      <Suspense fallback={
        <div className={styles.section}>
          <SectionLoading label="Loading pipeline health…" minHeight={100} />
        </div>
      }>
        <HealthAndStalledSlot vis={vis} />
      </Suspense>

      {/* Wins + Service split, two columns */}
      <section className={styles.twoCol}>
        <Suspense fallback={<SectionLoading label="Loading recent wins…" className={styles.section} minHeight={140} />}>
          <WinsSlot vis={vis} />
        </Suspense>
        <Suspense fallback={<SectionLoading label="Loading service split…" className={styles.section} minHeight={140} />}>
          <ServiceSplitSlot vis={vis} isInternal={isInternalStaff} />
        </Suspense>
      </section>

      {/* Exchange forecast */}
      <Suspense fallback={
        <section className={styles.section}>
          <SectionLoading label="Loading exchange forecast…" minHeight={180} />
        </section>
      }>
        <ForecastSlot vis={vis} />
      </Suspense>

      {/* Recent activity */}
      <Suspense fallback={null}>
        <RecentActivitySlot vis={vis} />
      </Suspense>

      {/* Pro tip banner */}
      <Suspense fallback={null}>
        <ProTipSlot vis={vis} />
      </Suspense>
    </div>
  );
}

// ── Per-section async slots ─────────────────────────────────────────────────
// `order` prop on SectionReveal drives a 40ms-per-index transition-delay
// so multi-section resolves cascade top-to-bottom. On slow networks where
// sections resolve seconds apart, the delay is invisible.

async function HeadlineSlot({ vis }: { vis: Vis }) {
  const attentionItems = await getHubAttentionItems(vis);
  const attentionFileCount = new Set(attentionItems.map((i) => i.transaction.id)).size;
  return (
    <SectionReveal order={0}>
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
    </SectionReveal>
  );
}

async function DiarySlot({ vis }: { vis: Vis }) {
  const diaryItems = await getHubDiary(vis);
  if (diaryItems.length === 0) return null;
  return (
    <SectionReveal order={1}>
      <KineticDiaryStrip items={diaryItems} />
    </SectionReveal>
  );
}

async function HoldsSlot({ vis }: { vis: Vis }) {
  const expiredHolds = await getExpiredHolds(vis);
  if (expiredHolds.length === 0) return null;
  return (
    <SectionReveal order={2}>
      <HoldsNeedingAttention items={expiredHolds} />
    </SectionReveal>
  );
}

async function AttentionSlot({ vis }: { vis: Vis }) {
  const attentionItems = await getHubAttentionItems(vis);
  if (attentionItems.length === 0) return null;
  return (
    <SectionReveal order={3}>
      <section className={styles.section}>
        <AttentionRowList items={attentionItems.slice(0, 6)} />
        {attentionItems.length > 6 && (
          <Link href="/agent/work-queue" className={styles.viewAll}>
            View all {attentionItems.length} in reminders
            <ArrowRight size={12} />
          </Link>
        )}
      </section>
    </SectionReveal>
  );
}

async function WorkStackSlot({ vis, isInternal }: { vis: Vis; isInternal: boolean }) {
  if (!isInternal) return null;
  const [unassignedFiles, relistsToAcknowledge, chainSetupPending] = await Promise.all([
    getHubUnassignedFiles(vis),
    getHubRelistsToAcknowledge(vis),
    getHubChainSetupPending(vis),
  ]);
  return (
    <SectionReveal order={4}>
      <InternalOnlyCards
        isInternal={isInternal}
        unassignedFiles={unassignedFiles}
        relistsToAcknowledge={relistsToAcknowledge}
        chainSetupPending={chainSetupPending}
      />
    </SectionReveal>
  );
}

async function PipelineStagesSlot({ vis }: { vis: Vis }) {
  const pipelineStages = await getHubPipelineStages(vis);
  return (
    <SectionReveal order={5}>
      <PipelineAtAGlance stages={pipelineStages} />
    </SectionReveal>
  );
}

async function HealthAndStalledSlot({ vis }: { vis: Vis }) {
  const [pipelineStats, weeklyForecast, attentionItems] = await Promise.all([
    getHubPipelineStats(vis),
    getHubWeeklyForecast(vis),
    getHubAttentionItems(vis),
  ]);
  const escalatedCount = attentionItems.filter((i) => i.urgency === "escalated").length;
  const overdueCount   = attentionItems.filter((i) => i.urgency === "overdue").length;
  const attentionFileCount = new Set(attentionItems.map((i) => i.transaction.id)).size;
  const stalledCount = pipelineStats.stalled.count;
  return (
    <SectionReveal order={6}>
      <>
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
        <StalledFilesWarning count={stalledCount} />
      </>
    </SectionReveal>
  );
}

async function WinsSlot({ vis }: { vis: Vis }) {
  const wins = await getHubWins(vis);
  return (
    <SectionReveal order={7}>
      <WinsPanel wins={wins} />
    </SectionReveal>
  );
}

async function ServiceSplitSlot({ vis, isInternal }: { vis: Vis; isInternal: boolean }) {
  const serviceSplit = await getHubServiceSplit(vis);
  return (
    <SectionReveal order={8}>
      <ServiceSplitDonut
        selfManaged={serviceSplit.selfManaged}
        outsourced={serviceSplit.outsourced}
        isInternal={isInternal}
      />
    </SectionReveal>
  );
}

async function ForecastSlot({ vis }: { vis: Vis }) {
  const weeklyForecast = await getHubWeeklyForecast(vis);
  return (
    <SectionReveal order={9}>
      <section className={styles.section}>
        <ExchangeForecastChart forecast={weeklyForecast} />
      </section>
    </SectionReveal>
  );
}

async function RecentActivitySlot({ vis }: { vis: Vis }) {
  const recentActivity = await getHubRecentActivity(vis);
  if (!recentActivity) return null;
  return (
    <SectionReveal order={10}>
      <section className={styles.section}>
        <RecentActivityFeed activity={recentActivity} />
      </section>
    </SectionReveal>
  );
}

async function ProTipSlot({ vis }: { vis: Vis }) {
  const [pipelineStats, attentionItems, unassignedFiles, chainSetupPending, expiredHolds] = await Promise.all([
    getHubPipelineStats(vis),
    getHubAttentionItems(vis),
    getHubUnassignedFiles(vis),
    getHubChainSetupPending(vis),
    getExpiredHolds(vis),
  ]);
  const escalatedCount = attentionItems.filter((i) => i.urgency === "escalated").length;
  const stalledCount = pipelineStats.stalled.count;
  return (
    <SectionReveal order={11}>
      <ProTipBanner signals={{
        chasesQuietFiles: stalledCount,
        clientSilentFiles: 0,
        needAssignCount: unassignedFiles.length,
        chainSetupPendingCount: chainSetupPending.length,
        holdsExpiredCount: expiredHolds.length,
        escalatedCount,
      }} />
    </SectionReveal>
  );
}
