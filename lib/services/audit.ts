import { prisma } from "@/lib/prisma";

export type AuditEntry = {
  id: string;
  at: Date;
  actorName: string;
  transactionId: string;
  address: string;
  kind: "milestone" | "note" | "status" | "comm";
  detail: string;
};

export async function getAuditLog(
  agencyId: string,
  opts: { userId?: string; page?: number; pageSize?: number } = {}
): Promise<{ entries: AuditEntry[]; total: number }> {
  const { userId, page = 1, pageSize = 50 } = opts;
  const skip = (page - 1) * pageSize;

  // Fetch all transaction IDs for this agency
  const txIds = (
    await prisma.propertyTransaction.findMany({
      where: { agencyId },
      select: { id: true, propertyAddress: true },
    })
  );
  const txMap = new Map(txIds.map((t) => [t.id, t.propertyAddress]));
  const allTxIds = txIds.map((t) => t.id);

  if (allTxIds.length === 0) return { entries: [], total: 0 };

  // Cap at 3000 per source table — prevents memory blowup while covering any realistic agency.
  // In-memory sort+slice remains correct within this window.
  const FETCH_LIMIT = 3000;

  const [comms, completions] = await Promise.all([
    prisma.communicationRecord.findMany({
      where: {
        transactionId: { in: allTxIds },
        ...(userId ? { createdById: userId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: FETCH_LIMIT,
      select: {
        id: true,
        createdAt: true,
        content: true,
        type: true,
        transactionId: true,
        createdBy: { select: { name: true } },
      },
    }),
    prisma.milestoneCompletion.findMany({
      where: {
        transactionId: { in: allTxIds },
        isActive: true,
        ...(userId ? { completedById: userId } : {}),
      },
      orderBy: { completedAt: "desc" },
      take: FETCH_LIMIT,
      select: {
        id: true,
        completedAt: true,
        isNotRequired: true,
        statusReason: true,
        transactionId: true,
        completedBy: { select: { name: true } },
        milestoneDefinition: { select: { name: true } },
      },
    }),
  ]);

  const entries: AuditEntry[] = [];

  for (const c of comms) {
    const address = txMap.get(c.transactionId) ?? c.transactionId;
    const isStatusChange = c.content.includes("changed status from");
    entries.push({
      id: `comm-${c.id}`,
      at: c.createdAt,
      actorName: c.createdBy?.name ?? "System",
      transactionId: c.transactionId,
      address,
      kind: isStatusChange ? "status" : c.type === "internal_note" ? "note" : "comm",
      detail: c.content,
    });
  }

  for (const m of completions) {
    const address = txMap.get(m.transactionId) ?? m.transactionId;
    const isClientConfirm = m.statusReason === "Confirmed by client via portal";
    const actor = isClientConfirm ? "Client (portal)" : (m.completedBy?.name ?? "System");
    const action = m.isNotRequired ? `Marked N/A: ${m.milestoneDefinition.name}` : `Completed: ${m.milestoneDefinition.name}`;
    entries.push({
      id: `mc-${m.id}`,
      at: m.completedAt,
      actorName: actor,
      transactionId: m.transactionId,
      address,
      kind: "milestone",
      detail: action,
    });
  }

  entries.sort((a, b) => b.at.getTime() - a.at.getTime());

  return {
    total: entries.length,
    entries: entries.slice(skip, skip + pageSize),
  };
}

export async function getAuditUsers(agencyId: string) {
  return prisma.user.findMany({
    where: { agencyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
