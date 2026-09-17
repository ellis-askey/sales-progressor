import sgMail from "@sendgrid/mail";
import { prisma } from "@/lib/prisma";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { buildFrom, stripAgencyLegalSuffix } from "@/lib/email/from-name";
import { extractFirstName } from "@/lib/contacts/displayName";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const DEFAULT_FROM = "Sales Progressor <updates@thesalesprogressor.co.uk>";

// Reserved / non-deliverable recipient guard (2026-09). Demo showcase files
// seed every contact with an @example.com address precisely "so nothing sends"
// (docs/active/demo-sale/SPEC.md). But the send layer never honoured that
// intent — a demo milestone confirm still handed the address to SendGrid,
// which processed and BOUNCED it, harming sender reputation and burning quota.
// This is the universal backstop: RFC 2606 / RFC 6761 reserve these domains and
// TLDs for documentation/testing, so no real recipient ever has one. Any send
// to a reserved address is dropped before it reaches SendGrid, on EVERY path
// (confirm, reverse, claim wizard, chase crons, queue drains). The isDemo
// guards in the confirm/reverse actions + chase crons stop most demo sends
// upstream; this catches anything they miss.
const RESERVED_EMAIL_DOMAINS = new Set(["example.com", "example.net", "example.org"]);
const RESERVED_EMAIL_TLDS = [".example", ".test", ".invalid", ".localhost"];

export function isNonDeliverableRecipient(to: string): boolean {
  const addr = to.trim().toLowerCase();
  const at = addr.lastIndexOf("@");
  if (at === -1) return false;
  const domain = addr.slice(at + 1);
  if (RESERVED_EMAIL_DOMAINS.has(domain)) return true;
  return RESERVED_EMAIL_TLDS.some((tld) => domain === tld.slice(1) || domain.endsWith(tld));
}

// SendGrid analytics tagging (audit #17 — "start measuring email performance
// properly"). `categories` is SendGrid's built-in aggregation dimension: the
// dashboard breaks opens / clicks / bounces down by category. We stamp:
//   - the email TYPE (e.g. "CLIENT_CHASE") so you can compare opens per type,
//   - a VERSION category ("<type>:<version>") when a template carries one, so
//     subject / copy experiments (audit #12) can be compared head to head,
//   - an "env:<vercel-env>" tag so staging traffic never pollutes prod's
//     numbers.
// The same labels are mirrored into customArgs, which ride on every Event
// Webhook event, in case we ever want the breakdown in our own DB too.
function analyticsTags(
  emailType?: string,
  templateVersion?: string,
): { categories?: string[]; customArgs: Record<string, string> } {
  const customArgs: Record<string, string> = {};
  if (!emailType) return { customArgs };
  const env = (process.env.VERCEL_ENV || process.env.NODE_ENV || "development").toLowerCase();
  const categories = [emailType, `env:${env}`];
  customArgs.emailType = emailType;
  if (templateVersion) {
    categories.push(`${emailType}:${templateVersion}`);
    customArgs.templateVersion = templateVersion;
  }
  return { categories, customArgs };
}

// Local-dev safety net. When DEV_EMAIL_REDIRECT is set (ONLY ever in .env.local,
// NEVER in a deployed Vercel env), every outbound email is rewritten to that one
// address and all cc/bcc are dropped, so testing on localhost can never reach a
// real client or solicitor. The intended recipient is preserved in the subject so
// you can still see who it would have gone to. No-op when the var is unset, so
// staging and production are completely unaffected.
export function applyDevEmailRedirect<T extends { to: string | string[]; subject?: string }>(msg: T): T {
  const redirect = process.env.DEV_EMAIL_REDIRECT?.trim();
  if (!redirect) return msg;
  const original = Array.isArray(msg.to) ? msg.to.join(", ") : msg.to;
  const clone: Record<string, unknown> = { ...msg, to: redirect };
  if (msg.subject) clone.subject = `[DEV → ${original}] ${msg.subject}`;
  delete clone.cc;
  delete clone.bcc;
  console.log(`[DEV_EMAIL_REDIRECT] rerouted to=${original} -> ${redirect} subject="${msg.subject ?? ""}"`);
  return clone as T;
}

// A file attached to an outbound email. `content` is base64-encoded. Used for
// the "add to calendar" .ics on booking-diary emails; kept generic.
export type EmailAttachment = {
  content: string;
  filename: string;
  type: string;
  disposition?: string;
};

// Deterministic RFC5322 Message-ID for an outbound email, derived from a stable
// row/queue id so the value we store on OutboundMessage.internetMessageId is the
// exact one placed on the wire — the key an inbound reply's In-Reply-To echoes
// back. Capture-only: no send behaviour depends on it. (Reply-matching relies on
// SendGrid honouring the custom Message-ID header; validate with a real send.)
export function buildOutboundMessageId(seed: string): string {
  return `<sp-${seed}@thesalesprogressor.co.uk>`;
}

// ─── Send-failure classification + retry bound (P3) ─────────────────────────
//
// A queued email that fails to send used to be marked errored forever and
// never retried. That silently dropped client emails on a brief SendGrid
// hiccup. We now distinguish a TRANSIENT failure (provider overloaded, rate
// limited, network blip — worth retrying) from a PERMANENT one (bad address,
// rejected payload — retrying can't help). The drains retry transient failures
// on their next run and dead-letter permanent ones immediately.

// After this long spent retrying a transient failure, a queue row is
// dead-lettered (a visible errorAt) rather than retried forever or dropped in
// silence — the daily alert then surfaces it.
export const MAX_SEND_RETRY_MS = 24 * 60 * 60 * 1000;

// True when a send error is worth retrying. The @sendgrid/mail SDK throws an
// error carrying a numeric HTTP `code`; network/timeout errors have none.
//   - no code            → network/timeout → transient (retry)
//   - 429                → rate limited     → transient (retry)
//   - >= 500             → provider-side    → transient (retry)
//   - other 4xx          → bad request/addr → permanent (dead-letter)
export function isTransientSendError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code !== "number") return true;
  if (code === 429) return true;
  if (code >= 500) return true;
  return false;
}

// ─── Mailbox routing (agent-connected SMTP) ──────────────────────────────────
//
// When the resolved From address belongs to a send-enabled connected mailbox
// (ImapConnection.sendEnabled — e.g. an eXp UK agent whose domain can never be
// SendGrid-verified because their IT won't touch DNS), the email goes out
// through that mailbox's own SMTP server instead of SendGrid: genuinely from
// the agent's account, DKIM-signed by their real mail host, with a copy filed
// to their Sent folder. On ANY mailbox failure we fall back to SendGrid from
// our shared address (reply-to the agent's own) in the same call, so a client
// email never dies on a mailbox hiccup — the bulletproof-sender promise.
//
// Deliberate trade-offs for mailbox sends: no SendGrid categories/customArgs
// (no open/bounce analytics), no ASM unsubscribe group, no open tracking.
// The transport chain is lazy-imported so scripts/tests that never hit a
// mailbox route don't load nodemailer/imapflow.

function bareEmailAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

function swapAddress(from: string, newAddress: string): string {
  // Keep the display name, swap the address: "Danny at eXp <a@b>" → "<a@c>".
  const m = from.match(/^(.*)<[^>]+>\s*$/);
  return m && m[1].trim() ? `${m[1].trim()} <${newAddress}>` : newAddress;
}

type MailboxRouteAttempt =
  | { routed: false }
  | { routed: true; sent: true }
  | { routed: true; sent: false; fallbackFrom: string; fallbackReplyTo: string };

async function tryMailboxRoute(msg: {
  to: string;
  cc?: string[];
  bcc?: string;
  subject: string;
  text: string;
  html?: string;
  from: string;
  replyTo?: string;
  messageId?: string;
  attachments?: EmailAttachment[];
}): Promise<MailboxRouteAttempt> {
  const addr = bareEmailAddress(msg.from);
  if (!addr.includes("@")) return { routed: false };

  // Lookup failures (DB blip, module load) mean NO routing — the send proceeds
  // exactly as today, with its original From. Only a failure after a mailbox
  // was actually found may rewrite the sender for the fallback.
  let mailbox: Awaited<ReturnType<typeof import("@/lib/integrations/smtp/mailbox-lookup").findSendMailboxForAddress>>;
  try {
    const { findSendMailboxForAddress } = await import("@/lib/integrations/smtp/mailbox-lookup");
    mailbox = await findSendMailboxForAddress(addr);
  } catch {
    return { routed: false };
  }
  if (!mailbox) return { routed: false };

  try {
    const { sendViaMailboxConnection } = await import("@/lib/integrations/smtp/send");
    const outcome = await sendViaMailboxConnection(mailbox, {
      from: msg.from,
      to: msg.to,
      cc: msg.cc,
      bcc: msg.bcc,
      replyTo: msg.replyTo,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      messageId: msg.messageId,
      attachments: msg.attachments,
    });
    if (outcome.ok) return { routed: true, sent: true };
    console.warn(`[email] mailbox send failed for ${addr} (${outcome.error}) — falling back to SendGrid`);
  } catch (err) {
    console.warn(`[email] mailbox route errored for ${addr} — falling back to SendGrid`, err);
  }
  // Fallback: our shared verified address keeps the display name; replies still
  // reach the agent's own inbox. Mirrors the unverified-domain tier in
  // lib/email/agency-sender.ts.
  return {
    routed: true,
    sent: false,
    fallbackFrom: swapAddress(msg.from, "updates@thesalesprogressor.co.uk"),
    fallbackReplyTo: msg.replyTo ?? addr,
  };
}

export async function sendEmail({
  to,
  cc,
  subject,
  text,
  html,
  from,
  replyTo,
  queueId,
  emailType,
  templateVersion,
  attachments,
  messageId,
}: {
  to: string;
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  // Echoes back on every SendGrid Event Webhook event for this message
  // via customArgs. /api/webhooks/sendgrid-bounce uses it to join events
  // to the originating OutboundEmailQueue row for delivery-status writes.
  // Omit for direct/non-queued sends; the webhook just skips them.
  queueId?: string;
  // Analytics tags (audit #17). emailType → a SendGrid category so opens /
  // clicks aggregate per type; templateVersion → a second category for A/B
  // comparison. Both optional and backward-compatible; untagged sends behave
  // exactly as before.
  emailType?: string;
  templateVersion?: string;
  // Deterministic RFC Message-ID (see buildOutboundMessageId). When provided we
  // set it as the message's Message-ID header so an inbound reply can be matched
  // to this send. Omit → no header set, behaviour identical to before.
  messageId?: string;
}) {
  if (isNonDeliverableRecipient(to)) {
    console.log(`[email] skipped reserved recipient to=${to} subject="${subject}"`);
    return;
  }
  const tags = analyticsTags(emailType, templateVersion);
  const customArgs = { ...(queueId ? { queueId } : {}), ...tags.customArgs };

  // Dev-redirect first so a mailbox route can never reach a real recipient
  // from localhost either; then try the agent's own mailbox before SendGrid.
  const msg = applyDevEmailRedirect({
    to,
    cc: cc && cc.length ? cc : undefined,
    from: from ?? DEFAULT_FROM,
    replyTo: replyTo,
    subject,
    text,
    html: html ?? text.replace(/\n/g, "<br>"),
  });
  const route = await tryMailboxRoute({ ...msg, messageId, attachments });
  if (route.routed && route.sent) return;
  const sendFrom = route.routed && !route.sent ? route.fallbackFrom : msg.from;
  const sendReplyTo = route.routed && !route.sent ? route.fallbackReplyTo : msg.replyTo;

  return sgMail.send({
    ...msg,
    from: sendFrom,
    replyTo: sendReplyTo,
    ...(attachments && attachments.length ? { attachments } : {}),
    ...(tags.categories ? { categories: tags.categories } : {}),
    ...(Object.keys(customArgs).length ? { customArgs } : {}),
    ...(messageId ? { headers: { "Message-ID": messageId } } : {}),
  });
}

// Platform-level chain notification emails (withdrawal, exchange, completion, celebration).
// Defaults:
//   From: Sales Progressor <updates@thesalesprogressor.co.uk>
//   Reply-To: support@thesalesprogressor.co.uk
// White-label override: callers can pass `from` and `replyTo` to send as a
// specific agency / agent (used by the outsource-intro email, which must
// not display "Sales Progressor" as the sender name). When omitted the
// chain-notification defaults apply — all existing call sites keep their
// SP-branded behaviour unchanged.
// ASM unsubscribe group included when SENDGRID_UNSUBSCRIBE_GROUP_ID is set.
// Set EMAIL_SANDBOX_MODE=true on staging to validate without delivering.
export async function sendChainEmail({
  to,
  cc,
  subject,
  text,
  html,
  queueId,
  from,
  replyTo,
  emailType,
  templateVersion,
  trackOpens,
  messageId,
}: {
  to: string;
  // Optional CC — used to copy a solicitor handler's assistant/secretary on
  // comms addressed to them. Empty/undefined sends with no CC as before.
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
  // Same purpose as sendEmail.queueId — see comment there. Drain functions
  // pass the OutboundEmailQueue row id; the webhook joins events back.
  queueId?: string;
  from?: string;
  replyTo?: string;
  // Analytics tags (audit #17) — see sendEmail for the full note.
  emailType?: string;
  templateVersion?: string;
  // Per-send open tracking. When true, SendGrid embeds a tracking pixel and
  // fires "open" events to the webhook (which stamps OutboundEmailQueue.openedAt).
  // Scoped deliberately (client chase only) rather than enabled account-wide, to
  // keep the tracking footprint small. Open-tracking is a privacy choice + an
  // unreliable signal; see the Chasing hub notes.
  trackOpens?: boolean;
  // Deterministic RFC Message-ID (see sendEmail.messageId). Omit → no header,
  // behaviour identical to before.
  messageId?: string;
}): Promise<void> {
  if (isNonDeliverableRecipient(to)) {
    console.log(`[chain-email] skipped reserved recipient to=${to} subject="${subject}"`);
    return;
  }
  const isSandbox = process.env.EMAIL_SANDBOX_MODE === "true";
  const asmGroupId = process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID
    ? parseInt(process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID, 10)
    : undefined;

  if (isSandbox) {
    console.log(`[EMAIL_SANDBOX] to=${to} subject="${subject}"`);
  }

  // Staging-only BCC: when CHAIN_EMAIL_BCC is set (e.g. ellisaskey@googlemail.com
  // on the staging Vercel env), every chain email is BCC'd to that address so
  // the closed-loop arc walkthrough can review the actual sent copy without
  // logging into each neighbour agent's inbox. Prod doesn't set this var.
  const chainBcc = process.env.CHAIN_EMAIL_BCC?.trim();

  const tags = analyticsTags(emailType, templateVersion);
  const customArgs = { ...(queueId ? { queueId } : {}), ...tags.customArgs };

  // Dev-redirect first (as in sendEmail), then try the agent's own mailbox.
  // Sandbox mode stays on the SendGrid path — validate-without-delivering is a
  // SendGrid feature with no SMTP equivalent.
  const msg = applyDevEmailRedirect({
    to,
    ...(cc && cc.length ? { cc } : {}),
    from: from ?? DEFAULT_FROM,
    replyTo: replyTo ?? "support@thesalesprogressor.co.uk",
    ...(chainBcc ? { bcc: chainBcc } : {}),
    subject,
    text,
    html: html ?? text.replace(/\n/g, "<br>"),
  });
  let sendFrom = msg.from;
  let sendReplyTo = msg.replyTo;
  if (!isSandbox) {
    const route = await tryMailboxRoute({ ...msg, messageId });
    if (route.routed && route.sent) return;
    if (route.routed && !route.sent) {
      sendFrom = route.fallbackFrom;
      sendReplyTo = route.fallbackReplyTo;
    }
  }

  await sgMail.send({
    ...msg,
    from: sendFrom,
    replyTo: sendReplyTo,
    ...(asmGroupId ? { asm: { groupId: asmGroupId } } : {}),
    ...(tags.categories ? { categories: tags.categories } : {}),
    ...(Object.keys(customArgs).length ? { customArgs } : {}),
    ...(trackOpens ? { trackingSettings: { openTracking: { enable: true } } } : {}),
    ...(messageId ? { headers: { "Message-ID": messageId } } : {}),
    mailSettings: { sandboxMode: { enable: isSandbox } },
  });
}

// Returns true if this user has globally unsubscribed from all platform emails.
export async function isUserEmailSuppressed(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailUnsubscribedAt: true },
  });
  return user?.emailUnsubscribedAt != null;
}

// Returns true if this contact has unsubscribed from all platform emails
// addressed to them. Mirrors isUserEmailSuppressed for client recipients
// (vendor / purchaser / solicitor / broker Contacts). Sub-arc A — A2 commit
// of the client-chase arc; the actual suppression check at queue-drain time
// is wired in A5 (extending OutboundEmailQueue for Contact recipients).
// No callers yet — pure infrastructure.
export async function isContactEmailSuppressed(contactId: string): Promise<boolean> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { unsubscribedAt: true },
  });
  return contact?.unsubscribedAt != null;
}

// Returns true if this chain link's invite has been unsubscribed (unclaimed agents only).
export async function isInviteEmailSuppressed(chainLinkId: string): Promise<boolean> {
  const link = await prisma.chainLink.findUnique({
    where: { id: chainLinkId },
    select: { inviteUnsubscribedAt: true },
  });
  return link?.inviteUnsubscribedAt != null;
}

// The assistant/secretary CC for a solicitor handler. Returns a one-element
// array when the handler has an assistant email on file, else undefined — so
// every solicitor send can uniformly pass `cc: solicitorCc(contact)`.
export function solicitorCc(
  contact: { secondaryEmail?: string | null } | null | undefined,
): string[] | undefined {
  const email = contact?.secondaryEmail?.trim();
  return email ? [email] : undefined;
}

export function parseEmailMessage(raw: string): { subject: string; body: string } {
  const lines = raw.trim().split("\n");
  const subjectLine = lines.find((l) => l.toLowerCase().startsWith("subject:"));
  if (subjectLine) {
    const subject = subjectLine.replace(/^subject:\s*/i, "").trim();
    const bodyStart = lines.indexOf(subjectLine) + 1;
    const body = lines.slice(bodyStart).join("\n").trimStart();
    return { subject, body };
  }
  return { subject: "Chase: property transaction update", body: raw };
}

/**
 * Resolves the FROM address and Reply-To for an outbound email on a transaction.
 *
 * Agent path: picks the most-recently-used verified email for the sending user.
 * SP/admin path: looks up the user's verified email at the file's agency domain.
 * Fallback (no match either path): DEFAULT_FROM, Reply-To = session.user.email.
 *
 * Caller must have already verified transaction ownership before calling this.
 */
export async function resolveSenderForTransaction(
  transactionId: string,
  sessionUser: {
    id: string;
    email?: string | null;
    name?: string | null;
    role: string;
    agencyId?: string | null;
  }
): Promise<{ from: string; replyTo: string }> {
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId },
    select: { agencyId: true, agency: { select: { name: true } } },
  });

  // Manual sends brand like the automated rule: "{sender first name} at {Agency}"
  // — the person clicking send (an SP on outsourced files, the agent on their
  // own file), from their own verified address. Mirrors the display in
  // resolveAgencySenderForTransaction. Falls back to their full name (then SP)
  // only when there's no agency brand to use.
  const brand = tx?.agency?.name ? stripAgencyLegalSuffix(tx.agency.name) : null;
  const senderFirst = sessionUser.name ? extractFirstName(sessionUser.name) : undefined;
  const brandedDisplay = brand
    ? (senderFirst ? `${senderFirst} at ${brand}` : brand)
    : (sessionUser.name ?? "Sales Progressor");

  // Fallback when the sender has no verified sending address of their own: the
  // agency's authenticated address (Reply-To matching), or the SP default if the
  // agency has none. This keeps manual sends on the agent's own address when
  // they've set one, but agency-branded otherwise — never a bare SP send for a
  // file that belongs to an agency with an approved address.
  const fallback = () => resolveAgencySenderForTransaction(transactionId);

  const isInternalStaff =
    sessionUser.role === "sales_progressor" || sessionUser.role === "admin";

  if (isInternalStaff) {
    if (!tx?.agencyId) return fallback();

    const domain = await prisma.verifiedDomain.findFirst({
      where: { agencyId: tx.agencyId, status: "verified" },
      select: { id: true },
    });
    if (!domain) return fallback();

    const userEmail = await prisma.userVerifiedEmail.findFirst({
      where: {
        userId: sessionUser.id,
        verifiedDomainId: domain.id,
        status: { in: ["verified", "legacy_single_sender"] },
      },
      select: { email: true },
    });
    if (!userEmail) return fallback();

    return { from: buildFrom(brandedDisplay, userEmail.email), replyTo: userEmail.email };
  }

  // Agent path: auto-select their best verified email (most recently used).
  // For chase sends there is no picker — we pick on their behalf.
  const userEmail = await prisma.userVerifiedEmail.findFirst({
    where: {
      userId: sessionUser.id,
      OR: [
        { status: "legacy_single_sender" },
        { status: "verified", verifiedDomain: { status: "verified" } },
      ],
    },
    orderBy: { lastUsedAt: "desc" },
    select: { email: true },
  });

  // Sign-in first. A verified email is only auto-picked when it IS the agent's
  // sign-in address; otherwise a send-enabled connected mailbox matching the
  // sign-in wins. Without this, an agent who moved their sign-in to a mailbox
  // domain (e.g. eXp) would still have chases leak from their OLD verified
  // address, contradicting the "everything sends from your sign-in" rule the
  // Connections card states. A stale verified email that matches nothing still
  // beats the SP fallback (legacy behaviour, unchanged).
  const sessionEmail = sessionUser.email?.trim().toLowerCase() ?? null;
  if (userEmail && sessionEmail && userEmail.email.toLowerCase() === sessionEmail) {
    return { from: buildFrom(brandedDisplay, userEmail.email), replyTo: userEmail.email };
  }
  if (sessionEmail) {
    try {
      const { findSendMailboxForAddress } = await import("@/lib/integrations/smtp/mailbox-lookup");
      const mailbox = await findSendMailboxForAddress(sessionEmail);
      if (mailbox) return { from: buildFrom(brandedDisplay, sessionEmail), replyTo: sessionEmail };
    } catch {
      /* lookup failure → legacy behaviour below */
    }
  }
  if (!userEmail) return fallback();

  return { from: buildFrom(brandedDisplay, userEmail.email), replyTo: userEmail.email };
}
