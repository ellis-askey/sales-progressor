"use server";

// Non-TSP survey path (temporary — real "add your own providers" lands in the new
// year). A buyer on a self-managed / in-house / external-business file can't reach
// TSP's vetted-surveyor network, so instead of a quote flow they tap "Ask for a
// recommendation" and we email their agent. The reply-to is the BUYER, so the
// agent hits reply and reaches them directly. The buyer is shown a confirmation
// that the agent has been asked. Idempotent: a second tap re-confirms without
// re-emailing.

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { extractFirstName } from "@/lib/contacts/displayName";
import { txOffersTspProviders, hasRequestedSurveyReco, SURVEY_RECO_REQUEST_SUBJECT } from "@/lib/services/survey-providers";

export type RequestSurveyRecommendationResult =
  | { ok: true; alreadyAsked: boolean }
  | { ok: false; error: string };

export async function requestSurveyRecommendationAction(
  token: string,
): Promise<RequestSurveyRecommendationResult> {
  if (!token || typeof token !== "string") return { ok: false, error: "Invalid token." };

  const contact = await prisma.contact.findFirst({
    where: { portalToken: token },
    select: { id: true, name: true, email: true, phone: true, propertyTransactionId: true },
  });
  if (!contact) return { ok: false, error: "We couldn't find your details." };

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: {
      id: true,
      propertyAddress: true,
      assignedUser: { select: { id: true, name: true, email: true } },
      agentUser: { select: { id: true, name: true, email: true } },
    },
  });
  if (!tx) return { ok: false, error: "We couldn't find your sale." };

  // Defence in depth: TSP-outsourced files use the real quote flow, never this.
  if (await txOffersTspProviders(tx.id)) return { ok: false, error: "Not applicable on this sale." };

  // Already asked — re-confirm without emailing the agent again.
  if (await hasRequestedSurveyReco(tx.id, contact.id)) return { ok: true, alreadyAsked: true };

  // Day-to-day owner: the assigned progressor if there is one, else the agent.
  const agent = tx.assignedUser ?? tx.agentUser;
  if (!agent?.email) return { ok: false, error: "We couldn't find your agent's contact details. Please message them directly." };

  const agentFirst = extractFirstName(agent.name) || "there";
  const buyerFirst = extractFirstName(contact.name) || "your buyer";
  const contactLine = [contact.email, contact.phone].filter(Boolean).join(" / ");

  const subject = `${buyerFirst} would like a surveyor recommendation: ${tx.propertyAddress}`;
  const text = `Hi ${agentFirst},

${contact.name} has asked whether you can recommend a surveyor for ${tx.propertyAddress}.

If you have someone you'd suggest, reply to this email to reach ${buyerFirst}${contactLine ? `, or contact them on ${contactLine}` : ""}.

Thanks,
Sales Progressor`;

  try {
    const { from } = await resolveAgencySenderForTransaction(tx.id, { persona: "personal" });
    await sendEmail({
      from,
      to: agent.email,
      subject,
      text,
      // Reply reaches the buyer who asked, not the platform.
      replyTo: contact.email ?? undefined,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "We couldn't send that just now. Please try again." };
  }

  // Record on the file timeline + mark the "asked" state so the card can't refire.
  await prisma.outboundMessage
    .create({
      data: {
        transactionId: tx.id,
        contactIds: [contact.id],
        type: "internal_note",
        method: "email",
        subject: SURVEY_RECO_REQUEST_SUBJECT,
        content: `${contact.name} asked for a surveyor recommendation. Their agent (${agent.email}) has been notified, with reply-to set to the buyer.`,
        createdById: agent.id ?? null,
      },
    })
    .catch(() => {});

  return { ok: true, alreadyAsked: false };
}
