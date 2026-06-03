// "Getting your sale moving" — white-labelled intro to buyer + seller on
// outsourced (managed-tier) sale creation. Fire-and-forget from
// createTransactionAction; never blocks the action's response.
//
// Shape mirrors lib/emails/send-welcome.ts: atomic check-and-stamp guard
// so each contact receives the email at most once per sale, no matter how
// many callers fire concurrently or how often the action retries.
//
// Delivery path:
//   1. Resolve the FROM address. Verified agency domain plus a verified
//      agent email at that domain → send as the agent on a clean agency
//      address. Otherwise → updates@thesalesprogressor.co.uk. The display
//      NAME is "{agentFirstName} {agentLastName}, {agencyName}" in both
//      cases — the white-label requirement is on the display name, which
//      we always control.
//   2. Compute the deliver-at instant. Inside working hours (Mon–Fri 09–17
//      London, non-bank-holiday) → send immediately on the next hourly
//      drain. Outside → schedule for the next working day 09:00.
//   3. Enqueue one OutboundEmailQueue row per recipient (de-duped by email
//      within the sale, so a buyer and seller sharing an address get one
//      message; both contacts are still stamped).
//
// One-send guard:
//   - Atomic stamp Contact.outsourceIntroSentAt = now() via updateMany
//     WHERE id = contactId AND outsourceIntroSentAt IS NULL. Only the
//     winner of the race proceeds to enqueue.
//   - If the enqueue throws, the stamp is rolled back so a future retry
//     can pick the contact up. If the enqueue succeeds but the drain
//     later fails to send, the row's errorAt/errorMessage records the
//     reason; the contact stays stamped (we've made a durable try).

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/lib/email/outboundQueue";
import { buildOutsourceIntroEmail } from "@/lib/emails/outsource-intro-template";
import { deliverAtInsideWorkingWindow } from "@/lib/emails/working-hours";

const DEFAULT_FROM_ADDRESS = "updates@thesalesprogressor.co.uk";

/**
 * Resolve the From address (the email envelope) for a given agent on a
 * given agency. Returns the verified address when both the agency domain
 * AND the agent's email at that domain are verified. Otherwise returns
 * the platform default — the display name is set separately by the
 * caller, so the agency / agent branding holds even in the fallback.
 */
async function resolveAgentSenderAddress(
  agentUserId: string,
  agencyId: string,
): Promise<string> {
  const domain = await prisma.verifiedDomain.findFirst({
    where: { agencyId, status: "verified" },
    select: { id: true },
  });
  if (!domain) return DEFAULT_FROM_ADDRESS;

  const userEmail = await prisma.userVerifiedEmail.findFirst({
    where: {
      userId: agentUserId,
      verifiedDomainId: domain.id,
      status: { in: ["verified", "legacy_single_sender"] },
    },
    select: { email: true },
  });
  return userEmail?.email ?? DEFAULT_FROM_ADDRESS;
}

// Split a single User.name into first/last for the email body's sign-off
// and from-name. "Taylor Kay" → first="Taylor", last="Kay". "Taylor" →
// first="Taylor", last="". Empty/null name → first="Your agent", last="".
function splitAgentName(name: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return { firstName: "Your agent", lastName: "" };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

// First name from a contact's "name" field. Same shape as splitAgentName
// but only returns the first token (or null when nothing usable is left).
function firstNameOf(name: string | null | undefined): string | null {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

export async function sendOutsourceIntroForTransaction(
  transactionId: string,
  creatorUserId: string,
): Promise<void> {
  try {
    const tx = await prisma.propertyTransaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        propertyAddress: true,
        agencyId: true,
        agency: { select: { name: true } },
        serviceType: true,
        contacts: {
          where: { roleType: { in: ["vendor", "purchaser"] } },
          select: {
            id: true,
            name: true,
            email: true,
            roleType: true,
            outsourceIntroSentAt: true,
            unsubscribedAt: true,
          },
        },
      },
    });
    if (!tx) {
      console.error(`[outsourceIntro] tx ${transactionId} not found — skipping`);
      return;
    }

    // Defensive — the action should only call us on outsourced sales, but
    // belt-and-braces against future callers / refactors. The trigger is
    // wired against resolvedProgressedBy, which maps to serviceType
    // === "outsourced" via createTransaction.
    if (tx.serviceType !== "outsourced") {
      console.log(`[outsourceIntro] tx ${transactionId} serviceType=${tx.serviceType} — skipping (self_managed)`);
      return;
    }

    const creator = await prisma.user.findUnique({
      where: { id: creatorUserId },
      select: { id: true, name: true, email: true },
    });
    if (!creator) {
      console.error(`[outsourceIntro] creator user ${creatorUserId} not found — skipping tx ${transactionId}`);
      return;
    }

    const { firstName: agentFirstName, lastName: agentLastName } = splitAgentName(creator.name);
    const agencyName = tx.agency?.name ?? "your agent";

    const fromAddress = await resolveAgentSenderAddress(creatorUserId, tx.agencyId);
    const fromName = `${agentFirstName}${agentLastName ? " " + agentLastName : ""}, ${agencyName}`;
    const fromHeader = `${fromName} <${fromAddress}>`;
    const replyTo = creator.email ?? DEFAULT_FROM_ADDRESS;

    const deliverAt = deliverAtInsideWorkingWindow(new Date());

    // Within-sale dedupe by lowercased email. A vendor + purchaser
    // sharing an address (rare but possible — internal sales, family
    // arrangements) get one message between them; both contacts are
    // still stamped so the guard fires uniformly.
    const emailedThisRun = new Set<string>();

    for (const contact of tx.contacts) {
      if (!contact.email) continue;
      if (contact.outsourceIntroSentAt) continue; // pre-existing stamp from an earlier run
      if (contact.unsubscribedAt) continue;       // contact opted out — respect even on first send

      // Atomic stamp. updateMany returns count=1 only if the row matched
      // the WHERE clause at the moment of the UPDATE — concurrent callers
      // can't both win this. The DB serialises the write.
      const claim = await prisma.contact.updateMany({
        where: { id: contact.id, outsourceIntroSentAt: null },
        data: { outsourceIntroSentAt: new Date() },
      });
      if (claim.count === 0) continue; // someone else won the race

      const emailKey = contact.email.trim().toLowerCase();
      const alreadyEmailedInThisRun = emailedThisRun.has(emailKey);

      // If we've already enqueued for this address in this batch, the
      // stamp stays (we made the formal "sent" decision for this contact)
      // but we skip the actual enqueue — no double send.
      if (alreadyEmailedInThisRun) {
        console.log(`[outsourceIntro] tx ${transactionId} contact ${contact.id} stamped (within-sale dedupe — ${emailKey} already enqueued this run)`);
        continue;
      }

      const built = buildOutsourceIntroEmail({
        clientFirstName: firstNameOf(contact.name),
        address: tx.propertyAddress || null,
        agentFirstName,
        agentLastName,
        agencyName,
      });

      try {
        await enqueueEmail({
          emailType: "OUTSOURCE_INTRO",
          // sourceId = transactionId + contactId — sourceId is the dedup
          // axis on OutboundEmailQueue's unique constraint when paired with
          // recipientContactId / emailType. Two enqueue attempts for the
          // same (tx, contact) silently no-op via P2002.
          sourceId: `${transactionId}:${contact.id}`,
          recipientEmail: contact.email,
          recipientContactId: contact.id,
          payload: {
            subject: built.subject,
            text: built.text,
            html: built.html,
            from: fromHeader,
            replyTo,
          },
          scheduledFor: deliverAt,
        });
        emailedThisRun.add(emailKey);
        console.log(`[outsourceIntro] enqueued tx=${transactionId} contact=${contact.id} role=${contact.roleType} deliverAt=${deliverAt.toISOString()}`);
      } catch (enqueueErr) {
        // Roll back the stamp so a future call can retry. Errors from
        // enqueueEmail are infrastructure-level (DB unreachable etc.),
        // not "this email shouldn't be sent" decisions.
        console.error(`[outsourceIntro] enqueue failed for tx=${transactionId} contact=${contact.id}, rolling back stamp:`, enqueueErr);
        await prisma.contact.updateMany({
          where: { id: contact.id, outsourceIntroSentAt: { not: null } },
          data: { outsourceIntroSentAt: null },
        }).catch((rollbackErr) => {
          console.error(`[outsourceIntro] stamp rollback ALSO failed for contact=${contact.id}:`, rollbackErr);
        });
      }
    }
  } catch (err) {
    // Fire-and-forget — never throw back to createTransactionAction.
    console.error(`[outsourceIntro] failed for tx ${transactionId}:`, err);
  }
}
