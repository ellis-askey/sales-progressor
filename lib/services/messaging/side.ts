// Conversation-side resolution + participant membership for native messaging.
// Pure + dependency-light so it can be imported anywhere (actions, portal,
// notifications) without import-cycle risk.

import { isActiveRoundContact } from "@/lib/contacts/round-scope";

export type MessagingSide = "buyer" | "seller";

// Which conversation side a portal contact belongs to. EXPLICIT mapping — never
// the binary "anything-not-vendor = purchaser" fold used in some portal code
// (lib/services/portal.ts). Only genuine purchaser / vendor contacts are
// messaging participants; solicitors, brokers and "other" return null and never
// join a conversation, even if they somehow hold a portal token.
export function sideForRoleType(roleType: string): MessagingSide | null {
  if (roleType === "purchaser") return "buyer";
  if (roleType === "vendor") return "seller";
  return null;
}

// Whether a contact may participate in messaging: a genuine PRINCIPAL buyer or
// seller with portal access, on the ACTIVE round (purchasers only). Reuses the
// shared active-round predicate so a superseded/fallen-through buyer can never
// re-enter the live conversation.
export function isMessagingParticipant(
  contact: {
    roleType: string;
    isPrincipal: boolean;
    portalEligible: boolean;
    buyerRoundId: string | null;
  },
  activeBuyerRoundId: string | null,
): boolean {
  if (sideForRoleType(contact.roleType) === null) return false;
  if (!contact.portalEligible) return false;
  if (!contact.isPrincipal) return false;
  return isActiveRoundContact(contact, activeBuyerRoundId);
}
