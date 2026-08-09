"use server";

// Send the /quote/[token] link to the purchaser of a given transaction.
// Used from the AgentFileSidebar Quick links section so the agent can
// proactively nudge the buyer without them having to open the portal menu.
//
// Multi-tenant safety: any user who can already view the file can send this.
// The action re-verifies via getAccessScope + scopeOwnershipWhere.

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";

export type SendQuoteLinkResult =
  | { ok: true; recipientEmail: string }
  | { ok: false; error: string };

export async function sendQuoteLinkToBuyerAction(
  transactionId: string,
): Promise<SendQuoteLinkResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: "Not signed in." };

  const scope = getAccessScope(session);

  // Ownership guard — file must be in the caller's scope.
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: {
      id: true,
      propertyAddress: true,
      contacts: {
        where: { roleType: "purchaser" },
        select: {
          id: true,
          name: true,
          email: true,
          portalToken: true,
          unsubscribedAt: true,
        },
      },
    },
  });

  if (!tx) return { ok: false, error: "File not found or not in your scope." };

  const buyer = tx.contacts.find(
    (c) => c.email && c.portalToken && !c.unsubscribedAt,
  );
  if (!buyer) {
    return {
      ok: false,
      error: "No buyer with an email and portal link set up. Add contact details on the file first.",
    };
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.thesalesprogressor.co.uk";
  const link = `${origin}/quote/${buyer.portalToken}`;
  const firstName = buyer.name.split(/\s+/)[0] || buyer.name;

  const subject = `Get a survey quote for ${tx.propertyAddress}`;
  const text = `Hi ${firstName},

Most buyers arrange a survey before exchange. It's worth getting quotes from a couple of firms so you can compare.

We've put together a short form: pick the type of survey, pick from surveyors that cover your area, and they'll come back to you with a quote directly.

Get started here:
${link}

If you'd rather sort this yourself, no problem. Just wanted to make it easy.

${session.user.name ?? "Your agent"}
`;

  try {
    await sendEmail({
      to: buyer.email!,
      subject,
      text,
      replyTo: session.user.email ?? undefined,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Sending failed.",
    };
  }

  // Log an internal note so the timeline reflects it.
  await prisma.outboundMessage
    .create({
      data: {
        transactionId: tx.id,
        contactIds: [buyer.id],
        type: "internal_note",
        method: "email",
        subject: `Sent survey quote link`,
        content: `Sent survey quote link to ${buyer.email} (${firstName}). URL: ${link}`,
        createdById: session.user.id,
      },
    })
    .catch(() => {});

  return { ok: true, recipientEmail: buyer.email! };
}
