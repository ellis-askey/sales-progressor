// Shared scope resolution for the Automated-emails surface.
//
// Single source of truth for "which automated-email records may this caller
// see". Both the feed list (automated-emails-list.ts) and the overview /
// needs-attention service (automated-emails-overview.ts) resolve scope through
// here, so counts, KPIs, issues and rows can never diverge on visibility.
//
// buildTxWhere is intentionally stricter than lib/security/access-scope.ts's
// scopeTransactionWhere (self-managed only; negotiator → own files); it stays
// the feed's resolver rather than being replaced, so the extra narrowing
// isn't lost. Both email sources scope off the txIds it yields:
//   - OutboundEmailQueue → via its recipientContact → transaction relation
//   - OutboundMessage (solicitor sends) → via its own transactionId column

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type EmailScopeInput = {
  role: "director" | "negotiator" | "sales_progressor" | "admin" | "superadmin" | "viewer";
  userId: string;
  agencyId: string | null;
  hasAdminPowers?: boolean;
  mineOnly?: boolean;
  fileId?: string;
};

export function buildTxWhere(input: EmailScopeInput): Prisma.PropertyTransactionWhereInput {
  const where: Prisma.PropertyTransactionWhereInput = {};

  if (input.hasAdminPowers) {
    // No agency filter — admin (and hybrid SP) sees the whole platform.
  } else if (input.role === "sales_progressor") {
    where.assignedUserId = input.userId;
  } else if (input.role === "negotiator" || input.role === "viewer") {
    where.agencyId = input.agencyId ?? "__none__";
    where.agentUserId = input.userId;
    where.serviceType = "self_managed";
  } else if (input.role === "director") {
    where.agencyId = input.agencyId ?? "__none__";
    where.serviceType = "self_managed";
    if (input.mineOnly) where.agentUserId = input.userId;
  }

  if (input.fileId) where.id = input.fileId;

  return where;
}

export type ResolvedEmailScope = {
  txIds: string[];
  txAddressById: Map<string, string>;
  activeRoundIds: string[];
  // Round-aware filter for the queue: purchaser contacts from a fall-through
  // round are hidden; vendor / solicitor / broker are file-level.
  queueScope: Prisma.OutboundEmailQueueWhereInput;
  // Solicitor automated sends only (createdByRole="director" is the solicitor
  // mirror's signature — excludes client mirrors "system" and historical null).
  solicitorScope: Prisma.OutboundMessageWhereInput;
};

export async function resolveEmailScope(input: EmailScopeInput): Promise<ResolvedEmailScope> {
  const transactions = await prisma.propertyTransaction.findMany({
    where: buildTxWhere(input),
    select: { id: true, propertyAddress: true, activeBuyerRoundId: true },
  });
  const txIds = transactions.map((t) => t.id);
  const txAddressById = new Map(transactions.map((t) => [t.id, t.propertyAddress]));
  const activeRoundIds = transactions
    .map((t) => t.activeBuyerRoundId)
    .filter((id): id is string => id !== null);

  const queueScope: Prisma.OutboundEmailQueueWhereInput = {
    recipientContact: {
      propertyTransactionId: { in: txIds },
      OR: [
        { roleType: { not: "purchaser" as const } },
        { buyerRoundId: null },
        { buyerRoundId: { in: activeRoundIds } },
      ],
    },
  };

  const solicitorScope: Prisma.OutboundMessageWhereInput = {
    transactionId: { in: txIds },
    channel: "email",
    purpose: "chase",
    isAutomated: true,
    createdByRole: "director",
  };

  return { txIds, txAddressById, activeRoundIds, queueScope, solicitorScope };
}
