"use server";

// Native messaging — staff server actions (Phase 1).
//
// Every action goes through guard(), which enforces THREE independent checks,
// server-side, before anything else:
//   1. canUseMessages(session)        — the pilot staff allowlist (fail-closed).
//   2. fileInMessagesPilot(txId)      — the pilot FILE allowlist (fail-closed).
//   3. scopeOwnershipWhere(...)       — the normal tenant access boundary (Law 7).
// A failure of any one returns a benign forbidden result; the UI never renders
// for non-pilot staff/files anyway, but these are the real enforcement.
//
// NO client messaging, NO notifications (push/email), NO real-time, NO chasing/
// milestone side-effects. Messages are written through this path ONLY — never
// through createCommunicationRecord (which advances chases + fires client sends).

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { canUseMessages, fileInMessagesPilot } from "@/lib/agency-features/messages";
import { getOrCreateConversation } from "@/lib/services/messaging/conversation";
import {
  getStaffFileMessaging,
  markConversationReadForUser,
} from "@/lib/services/messaging/read";
import type { MessagingSide } from "@/lib/services/messaging/side";
import type { StaffMessageView, StaffSideData } from "@/lib/services/messaging/types";

type GuardOk = {
  session: Awaited<ReturnType<typeof requireSession>>;
  tx: { id: string; activeBuyerRoundId: string | null };
};

async function guard(transactionId: string): Promise<GuardOk | null> {
  const session = await requireSession();
  if (!canUseMessages(session)) return null;
  if (!fileInMessagesPilot(transactionId)) return null;
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(getAccessScope(session), transactionId),
    select: { id: true, activeBuyerRoundId: true },
  });
  if (!tx) return null;
  return { session, tx };
}

function isSide(s: string): s is MessagingSide {
  return s === "buyer" || s === "seller";
}

const SEND_SELECT = {
  id: true,
  clientMsgId: true,
  body: true,
  senderKind: true,
  createdAt: true,
  senderUser: { select: { name: true } },
} as const;

export async function sendStaffMessageAction(input: {
  transactionId: string;
  side: string;
  body: string;
  clientMsgId: string;
}): Promise<{ ok: true; message: StaffMessageView } | { ok: false; error: string }> {
  const g = await guard(input.transactionId);
  if (!g) return { ok: false, error: "forbidden" };
  if (!isSide(input.side)) return { ok: false, error: "bad_side" };
  const body = input.body.trim();
  if (!body) return { ok: false, error: "empty" };
  if (body.length > 5000) return { ok: false, error: "too_long" };
  if (!input.clientMsgId) return { ok: false, error: "bad_request" };

  const conv = await getOrCreateConversation({
    transactionId: g.tx.id,
    side: input.side,
    activeBuyerRoundId: g.tx.activeBuyerRoundId,
  });

  // Idempotent on (conversationId, clientMsgId) — a retried send returns the
  // existing message rather than duplicating it.
  const created = await prisma.message.upsert({
    where: { conversationId_clientMsgId: { conversationId: conv.id, clientMsgId: input.clientMsgId } },
    create: {
      conversationId: conv.id,
      senderKind: "staff",
      senderUserId: g.session.user.id,
      body,
      clientMsgId: input.clientMsgId,
    },
    update: {},
    select: SEND_SELECT,
  });

  await prisma.conversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: created.createdAt, lastPreview: body.slice(0, 140) },
    select: { id: true },
  });
  await markConversationReadForUser(conv.id, g.session.user.id).catch(() => {});

  revalidatePath(`/agent/transactions/${g.tx.id}/messages`);

  return {
    ok: true,
    message: {
      id: created.id,
      clientMsgId: created.clientMsgId,
      body: created.body,
      senderKind: "staff",
      senderName: created.senderUser?.name ?? null,
      mine: true,
      createdAt: created.createdAt.toISOString(),
    },
  };
}

export async function markStaffConversationReadAction(input: {
  transactionId: string;
  side: string;
}): Promise<void> {
  const g = await guard(input.transactionId);
  if (!g || !isSide(input.side)) return;
  const buyerRoundId = input.side === "buyer" ? g.tx.activeBuyerRoundId : null;
  const conv = await prisma.conversation.findFirst({
    where: { transactionId: g.tx.id, side: input.side, buyerRoundId },
    select: { id: true },
  });
  if (conv) await markConversationReadForUser(conv.id, g.session.user.id).catch(() => {});
}

export async function fetchStaffSideAction(input: {
  transactionId: string;
  side: string;
}): Promise<{ ok: true; side: StaffSideData } | { ok: false; error: string }> {
  const g = await guard(input.transactionId);
  if (!g) return { ok: false, error: "forbidden" };
  if (!isSide(input.side)) return { ok: false, error: "bad_side" };
  const data = await getStaffFileMessaging(g.tx.id, g.session.user.id);
  const side = data.sides.find((s) => s.side === input.side);
  if (!side) return { ok: false, error: "bad_side" };
  return { ok: true, side };
}
