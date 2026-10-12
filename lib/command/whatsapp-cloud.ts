import "server-only";
// Command Centre read model for the official Cloud API integration (Phase 1).
// Superadmin-only surface (Law 8); the underlying integration lib is shared.

import { prisma } from "@/lib/prisma";
import { isCloudConfigured, cloudEnv } from "@/lib/integrations/whatsapp-cloud/config";
import { ensureTspNumber } from "@/lib/integrations/whatsapp-cloud/accounts";

export type CloudPhase1Status = {
  configured: boolean;
  phoneNumberId: string | null;
  displayPhone: string | null;
  wabaId: string | null;
  lastEventAt: string | null;
  tokenExpiresAt: string | null;
  lastError: string | null; // watchdog / send problems — red line on the card
  // 24h intake counts — proof the webhook genuinely flows.
  messages24h: number;
  statuses24h: number;
  unprocessed: number; // rows awaiting the Phase 2 thread router
};

// ── Phase 2: thread queues ───────────────────────────────────────────────────

export type CloudThreadRow = {
  id: string;
  kind: string;
  waId: string;
  displayName: string | null;
  lastPreview: string | null;
  lastInboundAt: string | null;
  assignmentState: string;
  transactionId: string | null;
  transactionAddress: string | null;
  side: string | null;
  candidates: { id: string; address: string }[];
};

export type CloudThreads = {
  needsAssigning: CloudThreadRow[];
  assigned: CloudThreadRow[];
};

export async function getCloudThreads(): Promise<CloudThreads> {
  const threads = await prisma.whatsAppThread.findMany({
    where: { assignmentState: { in: ["needs_assigning", "auto", "manual"] } },
    orderBy: { updatedAt: "desc" },
    take: 60,
    include: { transaction: { select: { propertyAddress: true } } },
  });
  // Candidate addresses in one lookup.
  const candidateIds = [...new Set(threads.flatMap((t) => t.candidateTransactionIds))];
  const candidateTx = candidateIds.length
    ? await prisma.propertyTransaction.findMany({
        where: { id: { in: candidateIds } },
        select: { id: true, propertyAddress: true },
      })
    : [];
  const addrById = new Map(candidateTx.map((t) => [t.id, t.propertyAddress]));

  const toRow = (t: (typeof threads)[number]): CloudThreadRow => ({
    id: t.id,
    kind: t.kind,
    waId: t.waId,
    displayName: t.displayName,
    lastPreview: t.lastPreview,
    lastInboundAt: t.lastInboundAt?.toISOString() ?? null,
    assignmentState: t.assignmentState,
    transactionId: t.transactionId,
    transactionAddress: t.transaction?.propertyAddress ?? null,
    side: t.side ?? null,
    candidates: t.candidateTransactionIds.map((id) => ({ id, address: addrById.get(id) ?? id })),
  });

  return {
    needsAssigning: threads.filter((t) => t.assignmentState === "needs_assigning").map(toRow),
    assigned: threads.filter((t) => t.assignmentState !== "needs_assigning").map(toRow),
  };
}

export async function getCloudPhase1Status(): Promise<CloudPhase1Status> {
  if (!isCloudConfigured()) {
    return {
      configured: false,
      phoneNumberId: null,
      displayPhone: null,
      wabaId: null,
      lastEventAt: null,
      tokenExpiresAt: null,
      lastError: null,
      messages24h: 0,
      statuses24h: 0,
      unprocessed: 0,
    };
  }
  const row = await ensureTspNumber();
  const env = cloudEnv();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [messages24h, statuses24h, unprocessed] = await Promise.all([
    prisma.whatsAppCloudEvent.count({ where: { kind: "message", receivedAt: { gte: since } } }),
    prisma.whatsAppCloudEvent.count({ where: { kind: "status", receivedAt: { gte: since } } }),
    prisma.whatsAppCloudEvent.count({ where: { kind: "message", processedAt: null } }),
  ]);
  return {
    configured: true,
    phoneNumberId: row?.phoneNumberId ?? env?.phoneNumberId ?? null,
    displayPhone: row?.displayPhone ?? null,
    wabaId: row?.wabaId ?? env?.wabaId ?? null,
    lastEventAt: row?.lastEventAt?.toISOString() ?? null,
    tokenExpiresAt: row?.tokenExpiresAt?.toISOString() ?? null,
    lastError: row?.lastError ?? null,
    messages24h,
    statuses24h,
    unprocessed,
  };
}
