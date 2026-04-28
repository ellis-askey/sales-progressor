import { prisma } from "@/lib/prisma";
import type { AgentVisibility } from "./agent";
import type { TransactionStatus } from "@prisma/client";

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

function txWhere(vis: AgentVisibility) {
  if (vis.seeAll) {
    if (vis.firmName) {
      return { agencyId: vis.agencyId, agentUser: { firmName: vis.firmName } };
    }
    return { agentUserId: vis.userId };
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
      ...txWhere(vis),
      status: { in: ["active", "on_hold"] as TransactionStatus[] },
    },
    select: {
      id: true,
      propertyAddress: true,
      status: true,
      expectedExchangeDate: true,
      vendorSolicitorFirmId: true,
      purchaserSolicitorFirmId: true,
      createdAt: true,
      agentUser: { select: { id: true, name: true } },
      contacts: { select: { name: true, roleType: true } },
      milestoneCompletions: {
        where: { state: "complete" },
        select: { milestoneDefinitionId: true, completedAt: true },
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
      // Overdue exchange date
      if (tx.expectedExchangeDate && new Date(tx.expectedExchangeDate) < now) {
        alerts.push("overdue_exchange");
      }

      // Stale progress — only flag if file is older than the grace period
      if (new Date(tx.createdAt) < newFileGrace) {
        const lastCompletion = tx.milestoneCompletions[0]?.completedAt ?? null;
        if (!lastCompletion || new Date(lastCompletion) < staleThreshold) {
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
