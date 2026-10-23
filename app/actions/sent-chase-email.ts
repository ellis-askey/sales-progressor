"use server";

// Fetch one sent email (the stored OutboundMessage) so a surface can open a
// true-to-inbox copy. Read-only + access-scoped: the message's file must be in
// the viewer's scope (Law 7) — that scope check is the real guard. Any real sent
// message is returnable (chase, milestone update, etc.); internal notes are not.
//
// Newer sends store the exact rendered HTML (sentEmailHtml) and we return it
// verbatim. Older sends (pre-capture) have only the plain text — for those we
// re-render the branded chase shell around the stored text via the same renderer
// the edit path uses, resolving the file's brand (self / outsourced business /
// TSP) through resolveAgencySenderForTransaction. That is faithful to the brand
// but not byte-identical (e.g. a bulleted list reflows as text), so we flag it
// `reconstructed` and let the viewer say so.

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { renderEditedChaseEmailHtml } from "@/lib/email/client-chase-digest";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";

export type SentChaseEmail = {
  subject: string;
  html: string | null;   // the rendered HTML we show in the iframe; null only if reconstruction fails
  reconstructed: boolean; // true = rebuilt from the sent text (no stored bytes)
  text: string;          // plain-text fallback
  recipientName: string | null;
  recipientEmail: string | null;
  fromEmail: string | null;  // the real From at send time; null (then resolved) on pre-capture rows
  sentAt: string | null; // ISO
  delivery: "sent" | "delivered" | "opened";
};

export async function getSentChaseEmailAction(id: string): Promise<SentChaseEmail> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const msg = await prisma.outboundMessage.findUnique({
    where: { id },
    select: {
      transactionId: true, type: true, subject: true, content: true, sentEmailHtml: true, sentFromEmail: true,
      recipientName: true, recipientEmail: true, sentAt: true, deliveredAt: true, openedAt: true,
    },
  });
  if (!msg || !msg.transactionId || msg.type === "internal_note") throw new Error("Email not found");
  const transactionId = msg.transactionId;

  // The message's file must be in scope for this viewer.
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Email not found");

  let html = msg.sentEmailHtml ?? null;
  let reconstructed = false;
  // The real From at send time. Stored on newer rows; for pre-capture rows it
  // stays null here and is backfilled from the resolved sender below so the
  // viewer still shows a sender (today's, flagged alongside `reconstructed`).
  let fromEmail = msg.sentFromEmail ?? null;

  // Legacy send — no stored HTML. Re-render the branded shell from the text.
  if (!html && (msg.content ?? "").trim()) {
    try {
      const sender = await resolveAgencySenderForTransaction(transactionId, { persona: "personal" });
      if (!fromEmail) fromEmail = sender.from ?? null;
      const text = msg.content;
      // Pull the respond + unsubscribe URLs out of the sent text so the shell can
      // strip those raw lines from the body and wire the CTA / footer links.
      const respondUrl = text.match(/https?:\/\/\S+\/respond\S*/)?.[0] ?? "";
      const unsubscribeUrl = text.match(/https?:\/\/\S+\/unsubscribe\S*/)?.[0] ?? "";
      // Trim the trailing sign-off + unsubscribe footer from the stored text: the
      // shell re-adds its own agency eyebrow, CTA and compliance footer, so leaving
      // them in the body would double up.
      let body = text;
      const signoff = body.search(/\n+Thanks,\s*\n/i);
      if (signoff !== -1) body = body.slice(0, signoff);

      html = renderEditedChaseEmailHtml({
        agencyName: sender.brandName ?? "Your agent",
        subject: msg.subject ?? "",
        text: body,
        respondUrl,
        pauseUrl: "",
        unsubscribeUrl,
        theme: sender.theme,
        supportEmail: sender.canReply ? sender.replyTo : undefined,
        studioTheme: sender.studioTheme,
        identityName: sender.brandName ?? undefined,
        logoUrl: sender.logoUrl,
        tileColor: sender.tileColor,
      });
      reconstructed = true;
    } catch {
      html = null; // reconstruction failed — the viewer shows the plain-text fallback
    }
  }

  return {
    subject: msg.subject ?? "",
    html,
    reconstructed,
    text: msg.content ?? "",
    recipientName: msg.recipientName ?? null,
    recipientEmail: msg.recipientEmail ?? null,
    fromEmail,
    sentAt: msg.sentAt ? msg.sentAt.toISOString() : null,
    delivery: msg.openedAt ? "opened" : msg.deliveredAt ? "delivered" : "sent",
  };
}
