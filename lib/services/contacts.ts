// lib/services/contacts.ts
// Contact database access.
// Contacts are always validated against the parent transaction's agencyId
// to prevent cross-agency writes.

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type { ContactRole } from "@prisma/client";
import { scopeOwnershipWhere, type AccessScope } from "@/lib/security/access-scope";

export type CreateContactInput = {
  propertyTransactionId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  roleType: ContactRole;
  // Pass 3 B1: when creating a purchaser contact on a live file, the
  // action layer passes the active round's id so the new row is round-
  // attributed from birth. NULL-stamped purchaser rows are hidden by
  // scopeContactsToActiveRound on a relisted file (NULL ≠ activeRoundId),
  // which used to make purchaser contacts added via the file's Contacts
  // panel "vanish" the moment they were saved. Vendor / solicitor / broker
  // rows stay NULL — they're file-level by design.
  buyerRoundId?: string | null;
  // Note B: false = a helper/representative on the side (not the real client),
  // kept out of confirmation names. portalEligible drives portal + client
  // emails; principals default eligible, helpers only when a director opts in.
  isPrincipal?: boolean;
  portalEligible?: boolean;
};

/**
 * Add a contact to a transaction.
 * scope enforces ownership: assignedUserId for SP, agencyId for agents, bare id for admin.
 */
export async function createContact(input: CreateContactInput, scope: AccessScope) {
  const transaction = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.propertyTransactionId),
    select: { id: true },
  });

  if (!transaction) {
    throw new Error("Transaction not found or access denied");
  }

  const isPrincipal = input.isPrincipal ?? true;
  return prisma.contact.create({
    data: {
      propertyTransactionId: input.propertyTransactionId,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      roleType: input.roleType,
      isPrincipal,
      // A principal is always portal-eligible; a helper only when opted in.
      portalEligible: isPrincipal ? true : (input.portalEligible ?? false),
      portalToken: randomUUID(),
      buyerRoundId: input.buyerRoundId ?? null,
    },
  });
}

/** Delete a contact (scope-verified via transaction join) */
export async function deleteContact(contactId: string, scope: AccessScope) {
  const where =
    scope.kind === "all"      ? { id: contactId } :
    scope.kind === "assigned" ? { id: contactId, transaction: { assignedUserId: scope.userId } } :
                                { id: contactId, transaction: { agencyId: scope.agencyIds[0] } };
  const contact = await prisma.contact.findFirst({ where, select: { id: true } });

  if (!contact) {
    throw new Error("Contact not found or access denied");
  }

  return prisma.contact.delete({ where: { id: contactId } });
}
