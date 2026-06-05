"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

function revalidateTx(id: string) {
  revalidatePath(`/transactions/${id}`, "page");
  revalidatePath(`/agent/transactions/${id}`, "page");
}
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { createContact, deleteContact } from "@/lib/services/contacts";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";
import { findContactConflict } from "@/lib/contacts/dedupe";
import type { ContactRole } from "@prisma/client";

// Structured error thrown when a contact write would create or update a
// row with a phone or email that already belongs to another contact on
// the same transaction. Surfaced inline by the file-detail Add/Edit
// forms and by the new-sale flow. Caller catches by message string.
function makeDuplicateContactError(
  kind: "phone" | "email",
  withName: string,
): Error {
  return Object.assign(new Error("DUPLICATE_CONTACT_FIELD"), {
    kind,
    withName,
  });
}

export async function createContactAction(input: {
  propertyTransactionId: string;
  name: string;
  phone: string | null;
  email: string | null;
  roleType: ContactRole;
}) {
  const session = await requireSession();
  const scope = getAccessScope(session);

  // Dedupe: refuse to insert if another contact on this transaction
  // already has the same phone (canonical digits) or email (lowercased).
  const others = await prisma.contact.findMany({
    where: {
      propertyTransactionId: input.propertyTransactionId,
      transaction: scopeOwnershipWhere(scope, input.propertyTransactionId),
    },
    select: { name: true, phone: true, email: true },
  });
  const conflict = findContactConflict(input, others);
  if (conflict) throw makeDuplicateContactError(conflict.kind, conflict.withName);

  // Pass 3 B1: stamp purchaser contacts to the active round at insert.
  // Vendor / solicitor / broker stay NULL (file-level). Mirrors the
  // pattern used by createTransactionAction when the buyer is seeded
  // alongside the file, and by relistTransactionImpl STEP 7 for the new
  // buyer on a relist.
  let buyerRoundId: string | null = null;
  if (input.roleType === "purchaser") {
    const tx = await prisma.propertyTransaction.findFirst({
      where: scopeOwnershipWhere(scope, input.propertyTransactionId),
      select: { activeBuyerRoundId: true },
    });
    buyerRoundId = tx?.activeBuyerRoundId ?? null;
  }

  const contact = await createContact({ ...input, buyerRoundId }, scope);
  await logActivity(
    input.propertyTransactionId,
    `${session.user.name} added contact: ${input.name} (${input.roleType.replace(/_/g, " ")})`,
    session.user.id
  );
  revalidateTx(input.propertyTransactionId);
  return contact;
}

export async function updateContactAction(input: {
  id: string;
  transactionId: string;
  name: string;
  phone: string | null;
  email: string | null;
}) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const txWhere = scopeOwnershipWhere(scope, input.transactionId);
  const existing = await prisma.contact.findFirst({
    where: { id: input.id, transaction: txWhere },
    select: { id: true },
  });
  if (!existing) throw new Error("Contact not found");

  // Dedupe: refuse if another contact (excluding self) already has the
  // same phone or email.
  const others = await prisma.contact.findMany({
    where: {
      propertyTransactionId: input.transactionId,
      transaction: txWhere,
      id: { not: input.id },
    },
    select: { name: true, phone: true, email: true },
  });
  const conflict = findContactConflict({ name: input.name, phone: input.phone, email: input.email }, others);
  if (conflict) throw makeDuplicateContactError(conflict.kind, conflict.withName);

  await prisma.contact.update({
    where: { id: input.id },
    data: { name: input.name.trim(), phone: input.phone?.trim() || null, email: input.email?.trim() || null },
  });
  await logActivity(
    input.transactionId,
    `${session.user.name} updated contact: ${input.name.trim()}`,
    session.user.id
  );
  revalidateTx(input.transactionId);
}

export async function deleteContactAction(contactId: string, transactionId: string) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const txWhere = scopeOwnershipWhere(scope, transactionId);
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, transaction: txWhere },
    select: { name: true },
  });
  await deleteContact(contactId, scope);
  if (contact) {
    await logActivity(transactionId, `${session.user.name} removed contact: ${contact.name}`, session.user.id);
  }
  revalidateTx(transactionId);
}

export async function generatePortalTokenAction(contactId: string, transactionId: string) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const txWhere = scopeOwnershipWhere(scope, transactionId);
  const existing = await prisma.contact.findFirst({
    where: { id: contactId, transaction: txWhere },
    select: { id: true, portalToken: true },
  });
  if (!existing) throw new Error("Contact not found");
  if (existing.portalToken) return; // already has one
  await prisma.contact.update({
    where: { id: contactId },
    data: { portalToken: randomUUID() },
  });
  revalidateTx(transactionId);
}
