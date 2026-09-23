"use server";

// Phase E2b — file a pending inbound email onto a property (reusing the normal
// file-to-property path) or dismiss it. Scoped to the caller's own mailbox rows
// and to a transaction they can access.

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { revalidatePath } from "next/cache";
import { logSingleIngestMessage } from "@/lib/integrations/mail/ingest";
import { logSingleMessageToFile } from "@/lib/integrations/outlook/sync";
import type { IngestMessage } from "@/lib/integrations/mail/types";

// The single-email core, shared by the one-tap action and the file-thread
// batch. Scope rules identical: the caller's own mailbox row + a transaction
// they can access. No revalidate here — callers revalidate once.
async function fileOnePending(
  session: Awaited<ReturnType<typeof requireSession>>,
  input: { pendingId: string; transactionId: string },
): Promise<boolean> {
  const scope = getAccessScope(session);

  // Own mailbox row + a transaction the caller can access.
  const pending = await prisma.pendingInboundEmail.findFirst({
    where: { id: input.pendingId, userId: session.user.id, status: "open" },
  });
  if (!pending) return false;
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) return false;

  // Direction carries through so a filed SENT email lands as our side, attributed
  // to the mailbox owner (who — because the tray is owner-scoped — is the caller).
  const outbound = pending.direction === "outbound";
  const attribution = { mailboxUserId: session.user.id, mailboxUserRole: session.user.role };

  // Prefer re-fetching the original from the provider so attachments (Phase F1),
  // the full body and threading headers all come across — the stored pending row
  // only kept the text. Outlook supports a by-id re-fetch; if it fails (mailbox
  // disconnected, message moved) we fall back to reconstructing from what we saved.
  let filed = false;
  if (pending.source === "outlook") {
    const conn = await prisma.outlookConnection.findFirst({
      where: { userId: session.user.id },
      select: { id: true, email: true, accessToken: true, refreshToken: true, tokenExpiresAt: true, scope: true },
    });
    if (conn) {
      try {
        await logSingleMessageToFile(conn, input.transactionId, pending.providerMessageId, { outbound, ...attribution });
        filed = true;
      } catch {
        filed = false; // fall through to the reconstruct path below
      }
    }
  }

  if (!filed) {
    // Reconstruct the message from what we stored and file it via the shared
    // ingest path (dedup + clean + activity write all happen there). rawBody as
    // the body so it re-cleans and keeps the original for "show original".
    const msg: IngestMessage = {
      id: pending.providerMessageId,
      subject: pending.subject,
      from: pending.fromEmail,
      fromName: pending.fromName,
      to: outbound && pending.toEmail ? [pending.toEmail] : [],
      cc: [],
      receivedDateTime: pending.receivedAt.toISOString(),
      bodyPreview: (pending.body ?? "").slice(0, 255),
      body: pending.rawBody || pending.body,
      folder: pending.folder,
      webLink: null,
      conversationId: null,
      internetMessageId: null,
      inReplyTo: null,
      references: null,
      outbound,
    };
    await logSingleIngestMessage(input.transactionId, msg, pending.source, attribution);
  }

  await prisma.pendingInboundEmail.update({
    where: { id: pending.id },
    data: { status: "filed", resolvedTransactionId: input.transactionId, resolvedById: session.user.id, resolvedAt: new Date() },
  });
  return true;
}

export async function filePendingEmailAction(input: {
  pendingId: string;
  transactionId: string;
}): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const ok = await fileOnePending(session, input);
  if (ok) {
    revalidatePath("/agent/hub");
    revalidatePath(`/agent/transactions/${input.transactionId}`);
  }
  return { ok };
}

// File a whole thread in one tap (the 34-identical-cards report, 2026-09-23).
// Each email runs the same single-email core; one bad row never aborts the
// rest, and failed ids are returned so the UI can restore exactly those rows.
export async function filePendingEmailsAction(input: {
  pendingIds: string[];
  transactionId: string;
}): Promise<{ ok: boolean; filed: number; failedIds: string[] }> {
  const session = await requireSession();
  const failedIds: string[] = [];
  let filed = 0;
  for (const pendingId of input.pendingIds) {
    try {
      const ok = await fileOnePending(session, { pendingId, transactionId: input.transactionId });
      if (ok) filed++;
      else failedIds.push(pendingId);
    } catch {
      failedIds.push(pendingId);
    }
  }
  if (filed > 0) {
    revalidatePath("/agent/hub");
    revalidatePath(`/agent/transactions/${input.transactionId}`);
  }
  return { ok: failedIds.length === 0, filed, failedIds };
}

export async function dismissPendingEmailAction(input: { pendingId: string }): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const res = await prisma.pendingInboundEmail.updateMany({
    where: { id: input.pendingId, userId: session.user.id, status: "open" },
    data: { status: "dismissed", resolvedById: session.user.id, resolvedAt: new Date() },
  });
  revalidatePath("/agent/hub");
  return { ok: res.count > 0 };
}

// Dismiss a whole thread in one tap. Same ownership scope as the single
// dismiss; one guarded updateMany.
export async function dismissPendingEmailsAction(input: { pendingIds: string[] }): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const res = await prisma.pendingInboundEmail.updateMany({
    where: { id: { in: input.pendingIds }, userId: session.user.id, status: "open" },
    data: { status: "dismissed", resolvedById: session.user.id, resolvedAt: new Date() },
  });
  revalidatePath("/agent/hub");
  return { ok: res.count > 0 };
}
