"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

function revalidateTx(id: string) {
  revalidatePath(`/transactions/${id}`, "page");
  revalidatePath(`/agent/transactions/${id}`, "page");
}
import { requireSession } from "@/lib/session";
import { createContact, deleteContact } from "@/lib/services/contacts";
import { prisma } from "@/lib/prisma";
import type { ContactRole } from "@prisma/client";

export async function createContactAction(input: {
  propertyTransactionId: string;
  name: string;
  phone: string | null;
  email: string | null;
  roleType: ContactRole;
}) {
  const session = await requireSession();
  const contact = await createContact(input, session.user.agencyId);
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
  const existing = await prisma.contact.findFirst({
    where: { id: input.id, transaction: { agencyId: session.user.agencyId } },
    select: { id: true },
  });
  if (!existing) throw new Error("Contact not found");

  await prisma.contact.update({
    where: { id: input.id },
    data: { name: input.name.trim(), phone: input.phone?.trim() || null, email: input.email?.trim() || null },
  });
  revalidateTx(input.transactionId);
}

export async function deleteContactAction(contactId: string, transactionId: string) {
  const session = await requireSession();
  await deleteContact(contactId, session.user.agencyId);
  revalidateTx(transactionId);
}

export async function generatePortalTokenAction(contactId: string, transactionId: string) {
  const session = await requireSession();
  const existing = await prisma.contact.findFirst({
    where: { id: contactId, transaction: { agencyId: session.user.agencyId } },
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
