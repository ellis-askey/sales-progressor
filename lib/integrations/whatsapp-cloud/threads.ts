import "server-only";
// The thread router (Phase 2, REBUILD_PLAN §G P2): turns stored raw webhook
// events into WhatsAppThread conversations with the transaction mapping.
// Runs inline after each webhook store (idempotent — events are consumed by
// processedAt, so a crash mid-batch just means the next run resumes).
//
// Messages themselves stay in the event store for now; Phase 3 writes them
// into the OutboundMessage ledger with real statuses. Because messages hang
// off the THREAD, reassignment is a one-field move at every phase.

import { prisma } from "@/lib/prisma";
import type { WhatsAppSide, TransactionStatus } from "@prisma/client";
import { threadKeyFromMessage, previewFromMessage, last9, chooseAssignment, type ContactMatch } from "./routing";
import { writeInboundLedgerRow, backfillThreadLedger, moveThreadLedger } from "./ledger";

const LIVE_STATUSES: TransactionStatus[] = ["draft", "active", "on_hold"];

// Live-sale contacts sharing the sender's phone core. Loads candidate contacts
// once per routed message; volumes here are tiny (one sender at a time).
async function matchContactsByPhone(waId: string): Promise<ContactMatch[]> {
  const core = last9(waId);
  if (!core) return [];
  const contacts = await prisma.contact.findMany({
    where: {
      phone: { not: null },
      transaction: { status: { in: LIVE_STATUSES } },
    },
    select: { id: true, phone: true, roleType: true, propertyTransactionId: true },
  });
  return contacts
    .filter((c) => last9(c.phone) === core)
    .map((c) => ({ contactId: c.id, transactionId: c.propertyTransactionId, roleType: String(c.roleType) }));
}

// Route every unprocessed message event into a thread. Bounded batch; safe to
// call from the webhook hot path and from any future sweep.
export async function routeUnprocessedEvents(limit = 50): Promise<number> {
  const events = await prisma.whatsAppCloudEvent.findMany({
    where: { kind: "message", processedAt: null },
    orderBy: { receivedAt: "asc" },
    take: limit,
  });
  if (events.length === 0) return 0;

  // Business numbers involved (normally exactly one).
  const numbers = await prisma.whatsAppBusinessNumber.findMany({
    where: { phoneNumberId: { in: [...new Set(events.map((e) => e.phoneNumberId))] } },
    select: { id: true, phoneNumberId: true },
  });
  const numberByPnid = new Map(numbers.map((n) => [n.phoneNumberId, n.id]));

  let routed = 0;
  for (const event of events) {
    const businessNumberId = numberByPnid.get(event.phoneNumberId);
    const value = event.payload as unknown as Parameters<typeof threadKeyFromMessage>[0];
    const msg = (value.messages ?? []).find((m) => m.id === event.wamid) ?? (value.messages ?? [])[0];

    // Unknown number or unparseable payload: stamp processed so one bad event
    // can never wedge the queue; the raw payload stays for forensics.
    if (!businessNumberId || !msg) {
      await prisma.whatsAppCloudEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
      continue;
    }
    const key = threadKeyFromMessage(value, msg);
    if (!key) {
      await prisma.whatsAppCloudEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
      continue;
    }

    let thread = await prisma.whatsAppThread.findUnique({
      where: { businessNumberId_waId: { businessNumberId, waId: key.waId } },
    });

    if (!thread) {
      // New conversation → run the matching ladder (direct chats only; groups
      // are TSP-created from Phase 6 and arrive pre-mapped at creation).
      const matches = key.kind === "direct" ? await matchContactsByPhone(key.waId) : [];
      const decision = chooseAssignment(matches);
      thread = await prisma.whatsAppThread.create({
        data: {
          businessNumberId,
          kind: key.kind,
          waId: key.waId,
          displayName: key.displayName,
          transactionId: decision.transactionId,
          side: null,
          contactIds: decision.contactIds,
          assignmentState: decision.state,
          candidateTransactionIds: decision.candidates,
          ...(decision.state === "auto" && decision.side ? { side: decision.side as WhatsAppSide } : {}),
        },
      });
    }

    const at = event.receivedAt;
    await prisma.$transaction([
      prisma.whatsAppThread.update({
        where: { id: thread.id },
        data: {
          lastInboundAt: at,
          lastPreview: previewFromMessage(msg),
          unreadCount: { increment: 1 },
          ...(key.displayName && !thread.displayName ? { displayName: key.displayName } : {}),
        },
      }),
      prisma.whatsAppCloudEvent.update({
        where: { id: event.id },
        data: { threadId: thread.id, processedAt: new Date() },
      }),
    ]);
    // Phase 3: assigned threads write straight into the comms ledger (idempotent).
    await writeInboundLedgerRow(
      { id: thread.id, waId: thread.waId, displayName: key.displayName ?? thread.displayName, transactionId: thread.transactionId, contactIds: thread.contactIds },
      msg,
      at,
    );
    routed += 1;
  }
  return routed;
}

// Manual assignment / correction. Works for first assignment AND reassignment:
// the thread owns the mapping, so moving a conversation (and, from Phase 3,
// every ledger message carrying its threadId) is this one update. Any ledger
// rows that exist already are repointed here too, so history moves with it.
export async function assignCloudThread(threadId: string, transactionId: string, side: WhatsAppSide | null) {
  const thread = await prisma.whatsAppThread.findUnique({ where: { id: threadId }, select: { id: true } });
  if (!thread) throw new Error("Conversation not found");
  const tx = await prisma.propertyTransaction.findUnique({ where: { id: transactionId }, select: { id: true } });
  if (!tx) throw new Error("Sale not found");
  await prisma.whatsAppThread.update({
    where: { id: threadId },
    data: { transactionId, side, assignmentState: "manual", candidateTransactionIds: [] },
  });
  // Phase 3: history moves with the mapping — existing ledger rows repoint to
  // the new sale, and any not-yet-written messages backfill onto it.
  await moveThreadLedger(threadId, transactionId);
  await backfillThreadLedger(threadId);
}

// Dismiss a conversation that isn't sales traffic (wrong number, spam). The
// thread keeps accumulating messages but stays out of every queue; reversible
// by assigning it later.
export async function ignoreCloudThread(threadId: string) {
  await prisma.whatsAppThread.update({
    where: { id: threadId },
    data: { assignmentState: "ignored", transactionId: null, side: null, candidateTransactionIds: [] },
  });
  // Detach any ledger rows a previous (wrong) assignment created, so a
  // dismissed conversation never lingers on a file's timeline.
  await moveThreadLedger(threadId, null);
}
