// lib/services/contacts.ts
// Contact database access.
// Contacts are always validated against the parent transaction's agencyId
// to prevent cross-agency writes.

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type { ContactRole } from "@prisma/client";

export type CreateContactInput = {
  propertyTransactionId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  roleType: ContactRole;
};

/**
 * Add a contact to a transaction.
 * agencyId is used to verify the transaction belongs to the user's agency
 * before writing — never skip this check.
 */
export async function createContact(input: CreateContactInput, agencyId: string) {
  // Verify the transaction exists and belongs to this agency
  const transaction = await prisma.propertyTransaction.findFirst({
    where: { id: input.propertyTransactionId, agencyId },
    select: { id: true },
  });

  if (!transaction) {
    throw new Error("Transaction not found or access denied");
  }

  return prisma.contact.create({
    data: {
      propertyTransactionId: input.propertyTransactionId,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      roleType: input.roleType,
      portalToken: randomUUID(),
    },
  });
}

/** Delete a contact (agency-scoped via transaction join) */
export async function deleteContact(contactId: string, agencyId: string) {
  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      transaction: { agencyId },
    },
    select: { id: true },
  });

  if (!contact) {
    throw new Error("Contact not found or access denied");
  }

  return prisma.contact.delete({ where: { id: contactId } });
}
