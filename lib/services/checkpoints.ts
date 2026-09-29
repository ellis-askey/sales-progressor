import { prisma } from "@/lib/prisma";
import { pushToContact } from "@/lib/services/push";
import { createNotification } from "@/lib/services/notifications";
import { maybeUnlockExchangeGate, maybeLockExchangeGate } from "@/lib/services/milestones";
import { requiredParties } from "@/lib/checkpoints/blocking";
import type { CheckpointAudience, CheckpointParty } from "@prisma/client";

// Per-file "Checkpoints" (client-facing: "Things to confirm") — critique #21+#23.
// The team creates them; anyone can be confirmed by the team at any time, and a
// checkpoint can additionally be shown to a side's portal so that client can
// confirm it too. See the interactive prototype for the full UX.

export type CheckpointConfirmer =
  | { kind: "user"; id: string; name: string }
  | { kind: "contact"; id: string; name: string };

export type CheckpointConfirmationView = {
  party: string;
  byName: string;
  byKind: "user" | "contact";
  eventDate: string | null;
  at: string;
};

export type CheckpointView = {
  id: string;
  label: string;
  showTo: CheckpointAudience;
  targetDate: string | null;
  blocksExchange: boolean;
  lastNudgedAt: string | null;
  requiredParties: string[];
  confirmations: CheckpointConfirmationView[];
  isComplete: boolean;
  // Whether that side's client currently has push (drives whether Nudge shows).
  pushVendor: boolean;
  pushPurchaser: boolean;
};

// The overseer of a file (rings their bell on a client confirm): the assigned
// Sales Progressor when outsourced, otherwise the managing agent.
function overseerId(t: { serviceType: string | null; assignedUserId: string | null; agentUserId: string | null }): string | null {
  return t.serviceType === "outsourced" ? t.assignedUserId : t.agentUserId;
}

export async function listCheckpoints(transactionId: string): Promise<CheckpointView[]> {
  const rows = await prisma.checkpoint.findMany({
    where: { transactionId, archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: { confirmations: true },
  });

  // Push availability per side — a client can only be nudged if they have a live
  // portal subscription. A stale row can exist, but count > 0 is the gate.
  const contacts = await prisma.contact.findMany({
    where: { propertyTransactionId: transactionId, roleType: { in: ["vendor", "purchaser"] } },
    select: { roleType: true, _count: { select: { pushSubscriptions: true } } },
  });
  const pushBySide: Record<string, boolean> = { vendor: false, purchaser: false };
  for (const c of contacts) {
    if ((c._count.pushSubscriptions ?? 0) > 0) pushBySide[c.roleType] = true;
  }

  return rows.map((r) => {
    const req = requiredParties(r.showTo);
    const done = new Set<string>(r.confirmations.map((c) => c.party));
    return {
      id: r.id,
      label: r.label,
      showTo: r.showTo,
      targetDate: r.targetDate ? r.targetDate.toISOString() : null,
      blocksExchange: r.blocksExchange,
      lastNudgedAt: r.lastNudgedAt ? r.lastNudgedAt.toISOString() : null,
      requiredParties: req,
      confirmations: r.confirmations.map((c) => ({
        party: c.party,
        byName: c.confirmedByName,
        byKind: (c.confirmedByContactId ? "contact" : "user") as "contact" | "user",
        eventDate: c.eventDate ? c.eventDate.toISOString() : null,
        at: c.createdAt.toISOString(),
      })),
      isComplete: req.every((p) => done.has(p)),
      pushVendor: pushBySide.vendor,
      pushPurchaser: pushBySide.purchaser,
    };
  });
}

export async function createCheckpoint(input: {
  transactionId: string;
  label: string;
  showTo: CheckpointAudience;
  targetDate?: string | null;
  blocksExchange?: boolean;
  createdById: string | null;
}): Promise<{ id: string }> {
  const label = input.label.trim();
  if (!label) throw new Error("A checkpoint needs a label");
  const cp = await prisma.checkpoint.create({
    data: {
      transactionId: input.transactionId,
      label,
      showTo: input.showTo,
      targetDate: input.targetDate ? new Date(input.targetDate) : null,
      blocksExchange: input.blocksExchange ?? false,
      createdById: input.createdById,
    },
    select: { id: true, blocksExchange: true },
  });
  // A fresh "must be done before exchange" checkpoint can re-shut an open gate.
  if (cp.blocksExchange) {
    await maybeLockExchangeGate(input.transactionId, "vendor");
    await maybeLockExchangeGate(input.transactionId, "purchaser");
  }
  return { id: cp.id };
}

export async function confirmCheckpoint(input: {
  checkpointId: string;
  party: CheckpointParty;
  by: CheckpointConfirmer;
  eventDate?: string | null;
}): Promise<void> {
  const cp = await prisma.checkpoint.findUnique({
    where: { id: input.checkpointId },
    include: {
      confirmations: { select: { party: true } },
      transaction: { select: { id: true, serviceType: true, assignedUserId: true, agentUserId: true } },
    },
  });
  if (!cp || cp.archivedAt) return;
  // One confirmation per party — idempotent no-op if already there.
  if (cp.confirmations.some((c) => c.party === input.party)) return;

  await prisma.checkpointConfirmation.create({
    data: {
      checkpointId: cp.id,
      party: input.party,
      confirmedByUserId: input.by.kind === "user" ? input.by.id : null,
      confirmedByContactId: input.by.kind === "contact" ? input.by.id : null,
      confirmedByName: input.by.name,
      eventDate: input.eventDate ? new Date(input.eventDate) : null,
    },
  });

  const req = requiredParties(cp.showTo);
  const done = new Set<string>(cp.confirmations.map((c) => c.party));
  done.add(input.party);
  const nowComplete = req.every((p) => done.has(p));

  // Completing a blocking checkpoint may open the exchange gate.
  if (nowComplete && cp.blocksExchange) {
    const actor = input.by.kind === "user" ? input.by.id : null;
    await maybeUnlockExchangeGate(cp.transaction.id, "vendor", actor);
    await maybeUnlockExchangeGate(cp.transaction.id, "purchaser", actor);
  }

  // A client confirming rings the file overseer's bell.
  if (input.by.kind === "contact") {
    const uid = overseerId(cp.transaction);
    if (uid) {
      await createNotification({
        userId: uid,
        type: "checkpoint_confirmed",
        transactionId: cp.transaction.id,
        payload: { contactName: input.by.name, checkpointLabel: cp.label },
      });
    }
  }
}

export async function unconfirmCheckpoint(input: { checkpointId: string; party: CheckpointParty }): Promise<void> {
  const cp = await prisma.checkpoint.findUnique({
    where: { id: input.checkpointId },
    select: { transactionId: true, blocksExchange: true },
  });
  if (!cp) return;
  await prisma.checkpointConfirmation.deleteMany({ where: { checkpointId: input.checkpointId, party: input.party } });
  // Reopening a blocking checkpoint can re-lock the gate.
  if (cp.blocksExchange) {
    await maybeLockExchangeGate(cp.transactionId, "vendor");
    await maybeLockExchangeGate(cp.transactionId, "purchaser");
  }
}

export async function archiveCheckpoint(checkpointId: string): Promise<void> {
  const cp = await prisma.checkpoint.findUnique({
    where: { id: checkpointId },
    select: { transactionId: true, blocksExchange: true },
  });
  if (!cp) return;
  await prisma.checkpoint.update({ where: { id: checkpointId }, data: { archivedAt: new Date() } });
  // Removing a blocking checkpoint may unblock the gate.
  if (cp.blocksExchange) {
    await maybeUnlockExchangeGate(cp.transactionId, "vendor", null);
    await maybeUnlockExchangeGate(cp.transactionId, "purchaser", null);
  }
}

// Nudge a client to confirm — push only, for now. Returns delivered=0 when the
// client has no live subscription (the UI hides the option in that case, but we
// stay safe if it's called anyway). No email fallback yet (future).
export async function nudgeCheckpoint(input: {
  checkpointId: string;
  side: "vendor" | "purchaser";
}): Promise<{ delivered: number }> {
  const cp = await prisma.checkpoint.findUnique({
    where: { id: input.checkpointId },
    select: { id: true, label: true, transactionId: true },
  });
  if (!cp) return { delivered: 0 };
  const contact = await prisma.contact.findFirst({
    where: { propertyTransactionId: cp.transactionId, roleType: input.side, portalToken: { not: null } },
    select: { id: true, portalToken: true },
  });
  if (!contact?.portalToken) return { delivered: 0 };
  const res = await pushToContact(contact.id, {
    title: "A quick confirmation needed",
    body: cp.label,
    url: `/portal/${contact.portalToken}`,
  });
  await prisma.checkpoint.update({ where: { id: cp.id }, data: { lastNudgedAt: new Date() } });
  return { delivered: res.delivered };
}
