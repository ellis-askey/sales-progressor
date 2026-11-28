"use server";

import { revalidatePath } from "next/cache";

function revalidateTx(id: string) {
  revalidatePath(`/transactions/${id}`, "page");
  revalidatePath(`/agent/transactions/${id}`, "page");
}
import { requireSession } from "@/lib/session";
import {
  createCommunicationRecord,
  deleteCommunicationRecord,
  updateCommunicationRecord,
  addNoteReply,
  logPortalLinkCopied,
  importWhatsAppChat,
  undoWhatsAppImport,
  toggleCommReaction,
  type SenderMapping,
  type ImportMessageInput,
  type ImportResult,
} from "@/lib/services/comms";
import type { CommType, CommMethod } from "@prisma/client";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { prisma } from "@/lib/prisma";
import { hasAdminPowers } from "@/lib/agent-session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { getSignedUrl } from "@/lib/supabase-storage";
import { splitComposeAddress } from "@/lib/services/compose-recipients";

// Everything the "Log an update" surface needs for a sale, loaded for the
// standalone "Add note" launcher (critique #275) where there's no file context
// to hand it down. Mirrors what ActivityPanel resolves server-side on the file.
// Scope-guarded (Law 7): only a sale in the caller's scope resolves.
export type NoteContext = {
  property: { line1: string; location: string; photoUrl: string | null };
  contacts: { id: string; name: string; roleType: string; phone: string | null }[];
  solicitors: { id: string; name: string; role: string; phone: string | null }[];
  canPasteChat: boolean;
  emailConnected: boolean;
  canMarkPrivate: boolean;
};

export async function getNoteContextAction(transactionId: string): Promise<NoteContext | null> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: {
      propertyAddress: true,
      photoStoragePath: true,
      contacts: { select: { id: true, name: true, roleType: true, phone: true } },
      vendorSolicitorContact: { select: { id: true, name: true, phone: true } },
      purchaserSolicitorContact: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!tx) return null;

  const emailConn = await prisma.imapConnection
    .findFirst({ where: { userId: session.user.id }, select: { id: true } })
    .catch(() => null);
  const canPasteChat = session.user.role === "sales_progressor" || hasAdminPowers(session);
  const canMarkPrivate = progressionBusinessesEnabled() && !!session.user.progressionBusinessId;
  const photoUrl = tx.photoStoragePath ? await getSignedUrl(tx.photoStoragePath).catch(() => null) : null;
  const { line1, location } = splitComposeAddress(tx.propertyAddress);

  return {
    property: { line1, location, photoUrl },
    contacts: tx.contacts.map((c) => ({ id: c.id, name: c.name, roleType: c.roleType ?? "", phone: c.phone ?? null })),
    solicitors: [
      ...(tx.vendorSolicitorContact ? [{ id: tx.vendorSolicitorContact.id, name: tx.vendorSolicitorContact.name, role: "Vendor solicitor", phone: tx.vendorSolicitorContact.phone ?? null }] : []),
      ...(tx.purchaserSolicitorContact ? [{ id: tx.purchaserSolicitorContact.id, name: tx.purchaserSolicitorContact.name, role: "Purchaser solicitor", phone: tx.purchaserSolicitorContact.phone ?? null }] : []),
    ],
    canPasteChat,
    emailConnected: !!emailConn,
    canMarkPrivate,
  };
}

export async function addNoteAction(transactionId: string, content: string) {
  const session = await requireSession();
  await createCommunicationRecord({
    transactionId,
    type: "internal_note",
    contactIds: [],
    content,
    createdById: session.user.id,
    createdByRole: session.user.role,
    scope: getAccessScope(session),
  });
  void trackServerEvent(session.user.id, ANALYTICS_EVENTS.NOTE_ADDED, {
    transactionId,
    agencyId: session.user.agencyId || undefined,
  });
  revalidateTx(transactionId);
}

// Replies to an activity note (internal-only, one level deep). Mirrors
// addNoteAction's session handling + revalidate. Returns the resolved reply so
// the client can optimistically render it with the right author + avatar.
//
// `notify` (optional, default off): when the replier ticks "Let {author} know"
// on the composer, ping the ORIGINAL note author — a real in-app bell + a device
// push. Only fires when the author is known and isn't the replier themselves.
// Fire-and-forget: a bell/push failure never fails the reply.
export async function replyToNoteAction(input: {
  transactionId: string;
  parentNoteId: string;
  content: string;
  notify?: boolean;
  // Internal users @mentioned in the body — each is pinged (bell + push),
  // never the mentioner themselves. Resolved client-side from the file's team.
  mentionedUserIds?: string[];
}) {
  const session = await requireSession();
  const { reply, noteAuthorId, notePreview, propertyAddress } = await addNoteReply({
    transactionId: input.transactionId,
    parentNoteId: input.parentNoteId,
    content: input.content,
    userId: session.user.id,
    userRole: session.user.role,
    scope: getAccessScope(session),
  });

  // Opt-in notify to the note's author (never the replier). Fired the way the
  // relist flow fires its bell + push: each wrapped so a throw is swallowed +
  // logged, never bubbling up to fail the reply the agent just wrote.
  if (input.notify && noteAuthorId && noteAuthorId !== session.user.id) {
    const replierName = session.user.name ?? "A colleague";
    void (async () => {
      try {
        const { notifyNoteReply } = await import("@/lib/services/notifications");
        await notifyNoteReply({
          userId: noteAuthorId,
          transactionId: input.transactionId,
          replierName,
          notePreview,
          propertyAddress,
        });
      } catch (err) {
        console.error("[replyToNoteAction] bell notification failed", err);
      }
    })();
    void (async () => {
      try {
        const { pushNoteReply } = await import("@/lib/agent/push-events");
        await pushNoteReply({
          userId: noteAuthorId,
          transactionId: input.transactionId,
          replierName,
          propertyAddress,
        });
      } catch (err) {
        console.error("[replyToNoteAction] web push failed", err);
      }
    })();
  }

  // @mention pings: every mentioned internal user (never the mentioner), a bell
  // + device push, fire-and-forget so a notify failure never fails the reply.
  const mentioned = [...new Set(input.mentionedUserIds ?? [])].filter((uid) => uid && uid !== session.user.id);
  if (mentioned.length) {
    const mentionerName = session.user.name ?? "A colleague";
    for (const uid of mentioned) {
      void (async () => {
        try {
          const { notifyNoteMention } = await import("@/lib/services/notifications");
          await notifyNoteMention({ userId: uid, transactionId: input.transactionId, mentionerName, notePreview, propertyAddress });
        } catch (err) {
          console.error("[replyToNoteAction] mention bell failed", err);
        }
      })();
      void (async () => {
        try {
          const { pushNoteMention } = await import("@/lib/agent/push-events");
          await pushNoteMention({ userId: uid, transactionId: input.transactionId, mentionerName, propertyAddress });
        } catch (err) {
          console.error("[replyToNoteAction] mention push failed", err);
        }
      })();
    }
  }

  revalidateTx(input.transactionId);
  return reply;
}

// Fired (fire-and-forget) when an agent or SP copies a client's portal link
// from the contact card, so the manual share leaves a trace on the file.
// Internal-only note; see logPortalLinkCopied for the throttle + rationale.
export async function logPortalLinkCopiedAction(transactionId: string, contactId: string) {
  const session = await requireSession();
  await logPortalLinkCopied({
    transactionId,
    contactId,
    createdById: session.user.id,
    createdByRole: session.user.role,
    scope: getAccessScope(session),
  });
  revalidateTx(transactionId);
}

export async function deleteCommAction(id: string, transactionId: string) {
  const session = await requireSession();
  await deleteCommunicationRecord(id, getAccessScope(session), session.user.id);
  revalidateTx(transactionId);
}

// Edit a manually-logged comms entry (phone / WhatsApp / note). Scope
// gating mirrors deleteCommAction — anyone who can access the file can
// edit any manual entry on it, regardless of who originally created it.
// Automated entries reject inside the service layer.
export async function editCommAction(input: {
  id: string;
  transactionId: string;
  content: string;
  contactIds: string[];
  visibleToClient: boolean;
}) {
  const session = await requireSession();
  await updateCommunicationRecord({
    id: input.id,
    content: input.content,
    contactIds: input.contactIds,
    visibleToClient: input.visibleToClient,
    scope: getAccessScope(session),
    userId: session.user.id,
  });
  revalidateTx(input.transactionId);
}

// Toggle the current user's emoji reaction on a note or reply (Activity comment
// thread). Anyone who can access the file can react; the row must be in scope
// (same scope guard as edit/delete). Returns the next reactions array so the
// client can reconcile optimistically.
export async function reactToCommAction(input: { id: string; transactionId: string; emoji: string }) {
  const session = await requireSession();
  const reactions = await toggleCommReaction(input.id, input.emoji, session.user.id, getAccessScope(session));
  revalidateTx(input.transactionId);
  return reactions;
}

export async function logCommAction(input: {
  transactionId: string;
  type: CommType;
  method: CommMethod | null;
  contactIds: string[];
  content: string;
  visibleToClient: boolean;
  // Explicit "who sees this" audience (contact ids), decoupled from contactIds.
  // Only meaningful when visibleToClient is true; empty = legacy side scoping.
  sharedWithContactIds?: string[];
  // Progression-business private note. Only honoured for a business-scope author
  // (enforced in createCommunicationRecord); ignored otherwise.
  businessOnly?: boolean;
}) {
  const session = await requireSession();
  await createCommunicationRecord({
    transactionId: input.transactionId,
    type: input.type,
    method: input.method,
    contactIds: input.contactIds,
    content: input.content,
    visibleToClient: input.visibleToClient,
    sharedWithContactIds: input.visibleToClient ? (input.sharedWithContactIds ?? []) : [],
    businessOnly: input.businessOnly ?? false,
    createdById: session.user.id,
    createdByRole: session.user.role,
    scope: getAccessScope(session),
  });
  revalidateTx(input.transactionId);
}

// Bulk WhatsApp chat import is internal-staff-only for now (admin / sales_progressor).
// UI hides the entry point too; this is defence-in-depth.
const PASTE_CHAT_ALLOWED_ROLES = new Set(["admin", "sales_progressor", "superadmin"]);

export async function importWhatsAppChatAction(input: {
  transactionId: string;
  messages: ImportMessageInput[];
  mapping: SenderMapping;
}): Promise<ImportResult> {
  const session = await requireSession();
  if (!PASTE_CHAT_ALLOWED_ROLES.has(session.user.role)) {
    throw new Error("Not available for this role");
  }
  try {
    const result = await importWhatsAppChat(
      input.transactionId,
      input.messages,
      input.mapping,
      session.user.id,
      session.user.role,
      getAccessScope(session),
    );
    revalidateTx(input.transactionId);
    return result;
  } catch (err) {
    // Surface the failure to Vercel logs so the Next.js production
    // "Server Components render" digest can be matched to an actual
    // error message. The PasteWhatsAppPanel still catches and toasts.
    console.error("[importWhatsAppChatAction] failed", {
      transactionId: input.transactionId,
      messageCount: input.messages.length,
      userId: session.user.id,
      err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    throw err;
  }
}

export async function undoWhatsAppImportAction(
  importBatchId: string,
  transactionId: string,
): Promise<{ deleted: number }> {
  const session = await requireSession();
  if (!PASTE_CHAT_ALLOWED_ROLES.has(session.user.role)) {
    throw new Error("Not available for this role");
  }
  const result = await undoWhatsAppImport(importBatchId, getAccessScope(session));
  revalidateTx(transactionId);
  return result;
}
