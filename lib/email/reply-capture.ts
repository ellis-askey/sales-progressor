// Reply-capture: make replies to the per-file emails we send reliably land on
// the file, WITHOUT reading the agent's mailbox.
//
// Why: an agent on a connected mailbox (e.g. eXp UK on Zoho) can send through
// their own address, but their domain can't be SendGrid-verified and their
// inbox can't be reliably read over IMAP (the provider throttles a server
// reading alongside the agent's own mail app). So replies to our chases/updates
// weren't being captured.
//
// How: for those files we set Reply-To to reply+<token>@<REPLY_CAPTURE_DOMAIN>.
// That subdomain's MX points at SendGrid; a reply hits the Inbound Parse webhook
// (app/api/webhooks/sendgrid-inbound), which maps the token back to the file and
// files the reply exactly like an ingested inbound email. The token is an
// unguessable 32-hex string minted lazily on the first such send — that
// unguessability is the auth on the webhook (same model as prospect replies).
//
// Gated by env: when REPLY_CAPTURE_DOMAIN is unset, nothing changes — Reply-To
// stays the agent's own address, as before. Set it to a subdomain whose MX is
// mx.sendgrid.net and that is registered as an Inbound Parse host (today the
// already-live reply.salesprogressorapp.co.uk can be reused). See
// docs/active/ELLIS_MANUAL_TODO.md.

import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

/** The configured reply-capture subdomain, or null when the feature is off. */
export function replyCaptureDomain(): string | null {
  const d = process.env.REPLY_CAPTURE_DOMAIN?.trim();
  return d && d.includes(".") ? d.toLowerCase() : null;
}

export function isReplyCaptureEnabled(): boolean {
  return replyCaptureDomain() !== null;
}

/** reply+<token>@<domain> for a given token (assumes capture is enabled). */
export function replyCaptureAddress(token: string, domain: string): string {
  return `reply+${token}@${domain}`;
}

/**
 * Get the file's reply token, minting one if it has none. Lazy + idempotent:
 * concurrent sends converge on a single token via the updateMany guard + re-read.
 */
export async function getOrCreateTransactionReplyToken(transactionId: string): Promise<string> {
  const existing = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { replyToken: true },
  });
  if (existing?.replyToken) return existing.replyToken;

  const token = randomBytes(16).toString("hex"); // 32 hex chars, matches the webhook regex
  // Only writes when still null, so two racing sends can't overwrite each other.
  await prisma.propertyTransaction.updateMany({
    where: { id: transactionId, replyToken: null },
    data: { replyToken: token },
  });
  const after = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { replyToken: true },
  });
  return after?.replyToken ?? token;
}

/**
 * The Reply-To address that captures replies onto this file, or null when
 * reply-capture is disabled (caller then keeps the agent's own address).
 */
export async function resolveReplyCaptureAddress(transactionId: string): Promise<string | null> {
  const domain = replyCaptureDomain();
  if (!domain) return null;
  const token = await getOrCreateTransactionReplyToken(transactionId);
  return replyCaptureAddress(token, domain);
}
