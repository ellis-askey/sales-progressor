"use server";
// app/actions/property-extras.ts
//
// Small server actions for two 2026-07-08 additions on the transaction file:
//   1. WhatsApp group invite URL (whatsappGroupInviteUrl) — powers the
//      per-contact "send WhatsApp invite" flow in WhatsappGroupModal.
//   2. Property photo (photoStoragePath + photoUploadedAt) — displayed as
//      a hero image on the client portal. Upload itself goes through
//      /api/agent/upload-property-photo; this action just persists the
//      returned storage path back to the transaction row.
//
// Both actions scope by AccessScope so customer agency users can only
// touch their own files and internal staff can touch any active file.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { deleteFromStorage } from "@/lib/supabase-storage";

function isValidGroupUrl(url: string): boolean {
  // WhatsApp group invite links are of the form chat.whatsapp.com/<inviteCode>.
  // Accept both http/https variants and any inviteCode.
  return /^https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/.test(url.trim());
}

async function requireOwnership(transactionId: string): Promise<void> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");
}

export async function setWhatsappGroupInviteUrlAction(
  transactionId: string,
  url: string,
): Promise<{ ok: true }> {
  await requireOwnership(transactionId);
  const trimmed = url.trim();
  if (!isValidGroupUrl(trimmed)) {
    throw new Error("That doesn't look like a WhatsApp group invite link. It should start with https://chat.whatsapp.com/");
  }
  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { whatsappGroupInviteUrl: trimmed },
  });
  revalidatePath(`/agent/transactions/${transactionId}`, "page");
  return { ok: true };
}

export async function removeWhatsappGroupInviteUrlAction(
  transactionId: string,
): Promise<{ ok: true }> {
  await requireOwnership(transactionId);
  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { whatsappGroupInviteUrl: null },
  });
  revalidatePath(`/agent/transactions/${transactionId}`, "page");
  return { ok: true };
}

export async function setPropertyPhotoAction(
  transactionId: string,
  storagePath: string,
): Promise<{ ok: true }> {
  await requireOwnership(transactionId);
  // Purge any prior photo so the storage bucket doesn't accumulate orphans
  // across re-uploads. The new path is stored below.
  const existing = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { photoStoragePath: true },
  });
  if (existing?.photoStoragePath && existing.photoStoragePath !== storagePath) {
    await deleteFromStorage(existing.photoStoragePath).catch((err) => {
      console.warn("[property-photo] failed to purge previous photo", err);
    });
  }
  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: {
      photoStoragePath: storagePath,
      photoUploadedAt: new Date(),
    },
  });
  revalidatePath(`/agent/transactions/${transactionId}`, "page");
  return { ok: true };
}

export async function removePropertyPhotoAction(
  transactionId: string,
): Promise<{ ok: true }> {
  await requireOwnership(transactionId);
  const existing = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { photoStoragePath: true },
  });
  if (existing?.photoStoragePath) {
    await deleteFromStorage(existing.photoStoragePath).catch((err) => {
      console.warn("[property-photo] failed to purge photo on remove", err);
    });
  }
  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { photoStoragePath: null, photoUploadedAt: null },
  });
  revalidatePath(`/agent/transactions/${transactionId}`, "page");
  return { ok: true };
}
