"use server";

import { requireSession } from "@/lib/session";
import { createContactAction } from "@/app/actions/contacts";
import { sendPortalInviteByToken } from "@/lib/services/portal-invite";
import type { ContactRole } from "@prisma/client";

// One action behind the Client-portal tab's invite card: add the client to the
// file (name, email, which side they're on) and send them their portal link in
// a single press. It's the normal add-contact-and-invite flow, surfaced where
// the agent can see the portal — not a separate record. Creating the contact
// mints the portalToken (createContact); sendPortalInviteByToken emails it.
export async function inviteNewClientToPortalAction(input: {
  transactionId: string;
  name: string;
  email: string;
  role: "seller" | "buyer";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const name = input.name.trim();
  const email = input.email.trim();
  if (!name) return { ok: false, error: "Please enter the client's name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Please enter a valid email address." };

  const roleType: ContactRole = input.role === "seller" ? "vendor" : "purchaser";

  let contact: Awaited<ReturnType<typeof createContactAction>>;
  try {
    // createContactAction handles scope/ownership, dedupe, active-round stamping
    // and the activity-log entry. Principal => portalEligible + portalToken.
    contact = await createContactAction({
      propertyTransactionId: input.transactionId,
      name,
      phone: null,
      email,
      roleType,
      isPrincipal: true,
      portalEligible: true,
    });
  } catch (err) {
    const message = (err as Error).message;
    if (message === "DUPLICATE_CONTACT_FIELD") {
      const withName = (err as { withName?: string }).withName;
      return {
        ok: false,
        error: `That email is already on this file${withName ? ` (${withName})` : ""}. Resend their link from the client list instead.`,
      };
    }
    return { ok: false, error: "Couldn't add the client. Try again." };
  }

  if (!contact.portalToken) {
    return { ok: false, error: "Client added, but their portal link couldn't be generated. Try resending it." };
  }

  const origin = process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";
  const sent = await sendPortalInviteByToken(contact.portalToken, {
    origin,
    actingUserId: session.user.id,
    actingUserRole: session.user.role,
  });
  if (!sent.ok) {
    return { ok: false, error: `Client added, but the invite email didn't send (${sent.error}). Try resending from the client list.` };
  }

  return { ok: true };
}

// Resend an already-added client their portal link (the "resend" affordance on
// an existing contact). Scope is enforced by the card only showing tokens for
// clients on a file the agent can see.
export async function resendPortalInviteAction(token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const origin = process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";
  return sendPortalInviteByToken(token, {
    origin,
    actingUserId: session.user.id,
    actingUserRole: session.user.role,
  });
}
