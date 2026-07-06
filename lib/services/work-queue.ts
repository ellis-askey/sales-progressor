import { prisma } from "@/lib/prisma";
import type { AgentVisibility } from "./agent";
import type { TransactionStatus } from "@prisma/client";
import { roundScopedOR, loadActiveRoundIds } from "@/lib/services/round-scope";

const DRAFT = "draft" as TransactionStatus;

export type AlertType =
  | "missing_vendor_solicitor"
  | "missing_purchaser_solicitor"
  | "overdue_exchange"
  | "stale";

export type WorkQueueItem = {
  id: string;
  propertyAddress: string;
  status: TransactionStatus;
  expectedExchangeDate: Date | null;
  alerts: AlertType[];
  vendors: string[];
  purchasers: string[];
  lastActivityAt: Date | null;
  agentUser: { id: string; name: string } | null;
  createdAt: Date;
};

export const ALERT_CONFIG: Record<AlertType, { label: string; color: string; bg: string; border: string }> = {
  overdue_exchange:          { label: "Exchange date overdue",       color: "var(--agent-danger)",  bg: "var(--agent-danger-bg)",  border: "var(--agent-danger-border)"  },
  missing_vendor_solicitor:  { label: "No vendor solicitor",         color: "var(--agent-warning)", bg: "var(--agent-warning-bg)", border: "var(--agent-warning-border)" },
  missing_purchaser_solicitor: { label: "No purchaser solicitor",    color: "var(--agent-warning)", bg: "var(--agent-warning-bg)", border: "var(--agent-warning-border)" },
  stale:                     { label: "No progress in 14+ days",     color: "var(--agent-info)",    bg: "var(--agent-info-bg)",    border: "var(--agent-info-border)"    },
};

export function txWhereWorkQueue(vis: AgentVisibility) {
  // Internal staff paths — checked first; agent callers have internalMode undefined.
  // admin_all: filter to outsourced only. Internal team never progresses
  // self_managed files (those belong to the customer agency and appear on
  // the agency's own work queue). Fixed 2026-07-06 alongside the sibling
  // bug in lib/services/reminders.ts:260.
  if (vis.internalMode === "admin_all") return { serviceType: "outsourced" as const };
  if (vis.internalMode === "assigned")  return { assignedUserId: vis.userId };
  // Agent paths — unchanged.
  if (vis.seeAll) {
    if (vis.firmName) {
      return { agencyId: vis.agencyId, agentUser: { firmName: vis.firmName } };
    }
    return { agencyId: vis.agencyId };
  }
  return { agentUserId: vis.userId };
}

export async function getWorkQueueItems(vis: AgentVisibility): Promise<WorkQueueItem[]> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const newFileGrace = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const exchangeDefs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM19", "PM26"] } },
    select: { id: true },
  });
  const exchangeDefIds = new Set(exchangeDefs.map((d) => d.id));

  const transactions = await prisma.propertyTransaction.findMany({
    where: {
      ...txWhereWorkQueue(vis),
      // On-hold files don't surface on the work queue — see lib/services/reminders.ts
      // getAgentReminderLogs for the matching exclusion.
      status: "active" as TransactionStatus,
    },
    select: {
      id: true,
      propertyAddress: true,
      status: true,
      expectedExchangeDate: true,
      overridePredictedDate: true,
      vendorSolicitorFirmId: true,
      purchaserSolicitorFirmId: true,
      createdAt: true,
      agentUser: { select: { id: true, name: true } },
      contacts: { select: { name: true, roleType: true } },
      // PHASE 1 (a)-CLASS resolved — Phase-3 OR scope below. The
      // archived-round PM26/VM19 of a relisted file no longer makes
      // hasExchanged read true; the OR clause restricts MC visibility
      // to file-level (vendor) + active-round rows.
      milestoneCompletions: {
        where: { state: "complete", OR: roundScopedOR(await loadActiveRoundIds({ ...txWhereWorkQueue(vis), status: "active" as TransactionStatus })) },
        select: {
          milestoneDefinitionId: true,
          completedAt: true,
          eventDate: true,
          reconciledAtExchange: true,
          reconciledAtClaim: true,
        },
        orderBy: { completedAt: "desc" },
      },
    },
  });

  const items: WorkQueueItem[] = [];

  for (const tx of transactions) {
    const alerts: AlertType[] = [];

    const hasExchanged = tx.milestoneCompletions.some((c) =>
      exchangeDefIds.has(c.milestoneDefinitionId)
    );

    if (!hasExchanged) {
      // Overdue exchange date — prefer manually-overridden date if set
      const exchangeDateToCheck = tx.overridePredictedDate ?? tx.expectedExchangeDate;
      if (exchangeDateToCheck && new Date(exchangeDateToCheck) < now) {
        alerts.push("overdue_exchange");
      }

      // Stale progress — active files only, older than grace period, no effective activity in 14 days.
      // Effective last activity = most recent of:
      //   (1) genuine non-reconciled completion's completedAt
      //   (2) reconciledAtClaim completion's eventDate (where non-null) — captures backdated real-world activity
      //   (3) tx.createdAt (fallback — handles fresh claims with all-null eventDates)
      // reconciledAtClaim completion with null eventDate is invisible to stale detection (agent ticked but didn't supply a date).
      if (tx.status === "active" && new Date(tx.createdAt) < newFileGrace) {
        const realCompletions = tx.milestoneCompletions.filter(
          (c) => !c.reconciledAtExchange && !c.reconciledAtClaim,
        );
        const latestRealCompletedAt = realCompletions[0]?.completedAt ?? null;

        const backdatedEventDates = tx.milestoneCompletions
          .filter((c) => c.reconciledAtClaim && c.eventDate)
          .map((c) => c.eventDate as Date)
          .sort((a, b) => b.getTime() - a.getTime());
        const latestBackdatedEventDate = backdatedEventDates[0] ?? null;

        const candidates: Date[] = [];
        if (latestRealCompletedAt) candidates.push(new Date(latestRealCompletedAt));
        if (latestBackdatedEventDate) candidates.push(new Date(latestBackdatedEventDate));
        candidates.push(new Date(tx.createdAt));

        const effectiveLastActivity = new Date(Math.max(...candidates.map((d) => d.getTime())));
        if (effectiveLastActivity < staleThreshold) {
          alerts.push("stale");
        }
      }
    }

    // Missing solicitors — any active file
    if (!tx.vendorSolicitorFirmId) alerts.push("missing_vendor_solicitor");
    if (!tx.purchaserSolicitorFirmId) alerts.push("missing_purchaser_solicitor");

    if (alerts.length === 0) continue;

    items.push({
      id: tx.id,
      propertyAddress: tx.propertyAddress,
      status: tx.status,
      expectedExchangeDate: tx.expectedExchangeDate,
      alerts,
      vendors: tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name),
      purchasers: tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name),
      lastActivityAt: tx.milestoneCompletions[0]?.completedAt ?? null,
      agentUser: tx.agentUser,
      createdAt: tx.createdAt,
    });
  }

  // Sort: overdue exchange first, then by alert count
  return items.sort((a, b) => {
    const aOverdue = a.alerts.includes("overdue_exchange") ? 0 : 1;
    const bOverdue = b.alerts.includes("overdue_exchange") ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    return b.alerts.length - a.alerts.length;
  });
}
