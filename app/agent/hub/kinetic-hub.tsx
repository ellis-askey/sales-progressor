// Kinetic Depth hub — Stage 1 target for internal roles (admin, superadmin,
// sales_progressor). Same data fetches as legacy-hub.tsx — different
// presentation. When rollout completes and every agency is on this hub,
// legacy-hub.tsx gets deleted and this becomes the only version.
//
// Composition follows the pattern validated in /dev/vibe:
//   1. Attention hero — action list, not KPI splash
//   2. Mini stats — real bar charts + contextual line
//   3. File grid — status lead + address anchor + next-action block
//                  + progress prose + quiet people footer
//   4. Cross-agency insight cards (internal only — quiet for agents)

import type React from "react";
import Link from "next/link";
import { Plus, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { extractFirstName } from "@/lib/contacts/displayName";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import {
  getHubPipelineStats, getHubAttentionItems, getHubWins,
  getHubServiceSplit, getHubUnassignedFiles, getHubRelistsToAcknowledge,
} from "@/lib/services/hub";
import { AttentionRowList } from "@/components/kinetic/hub/AttentionRowList";
import { KineticMiniStat } from "@/components/kinetic/hub/KineticMiniStat";
import { InternalOnlyCards } from "@/components/kinetic/hub/InternalOnlyCards";
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

  const [pipelineStats, attentionItems, wins, serviceSplit, unassignedFiles, relistsToAcknowledge] =
    await Promise.all([
      getHubPipelineStats(vis),
      getHubAttentionItems(vis),
      getHubWins(vis),
      getHubServiceSplit(vis),
      getHubUnassignedFiles(vis),
      getHubRelistsToAcknowledge(vis),
    ]);

  const attentionFileCount = new Set(attentionItems.map((i) => i.transaction.id)).size;
  const greeting = getGreeting(session.user.name ?? "there");

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
              <>You&rsquo;re all caught up</>
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

      {/* Attention list — the anchor of the page */}
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

      {/* Mini stats — with bar charts + contextual lines */}
      <section className={styles.miniStatsRow}>
        <KineticMiniStat
          label="Active files"
          value={pipelineStats.activeFiles}
          bars={[pipelineStats.activeFiles]}
          contextLine={pipelineStats.newThisMonth > 0 ? `${pipelineStats.newThisMonth} new this month` : "No new this month"}
          caption="Live pipeline"
        />
        <KineticMiniStat
          label="Exchanged this month"
          value={wins.exchangesThisMonth}
          bars={[wins.exchangesLastMonth, wins.exchangesThisMonth]}
          contextLine={
            wins.exchangesLastMonth === 0
              ? "First exchange in this window"
              : wins.exchangesThisMonth >= wins.exchangesLastMonth
                ? `+${wins.exchangesThisMonth - wins.exchangesLastMonth} vs last month`
                : `${wins.exchangesThisMonth - wins.exchangesLastMonth} vs last month`
          }
          caption="This vs last month"
        />
        <KineticMiniStat
          label="Service mix"
          value={serviceSplit.selfManaged + serviceSplit.outsourced}
          bars={[serviceSplit.selfManaged, serviceSplit.outsourced]}
          contextLine={`${serviceSplit.outsourced} outsourced · ${serviceSplit.selfManaged} self-managed`}
          caption="Active files by service"
        />
      </section>

      {/* Cross-agency cards for internal — quiet for agents (component decides) */}
      <InternalOnlyCards
        isInternal={isInternalStaff}
        unassignedFiles={unassignedFiles}
        relistsToAcknowledge={relistsToAcknowledge}
      />
    </div>
  );
}
