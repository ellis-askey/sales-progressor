import sgMail from "@sendgrid/mail";
import { prisma } from "@/lib/prisma";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const DEFAULT_FROM = "Sales Progressor <updates@thesalesprogressor.co.uk>";

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
}: {
  to: string;
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
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
}) {
  const tags = analyticsTags(emailType, templateVersion);
  const customArgs = { ...(queueId ? { queueId } : {}), ...tags.customArgs };
  return sgMail.send({
    to,
    cc: cc && cc.length ? cc : undefined,
    from: from ?? DEFAULT_FROM,
    replyTo: replyTo,
    subject,
    text,
    html: html ?? text.replace(/\n/g, "<br>"),
    ...(tags.categories ? { categories: tags.categories } : {}),
    ...(Object.keys(customArgs).length ? { customArgs } : {}),
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
}): Promise<void> {
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

  await sgMail.send({
    to,
    ...(cc && cc.length ? { cc } : {}),
    from: from ?? DEFAULT_FROM,
    replyTo: replyTo ?? "support@thesalesprogressor.co.uk",
    ...(chainBcc ? { bcc: chainBcc } : {}),
    subject,
    text,
    html: html ?? text.replace(/\n/g, "<br>"),
    ...(asmGroupId ? { asm: { groupId: asmGroupId } } : {}),
    ...(tags.categories ? { categories: tags.categories } : {}),
    ...(Object.keys(customArgs).length ? { customArgs } : {}),
    ...(trackOpens ? { trackingSettings: { openTracking: { enable: true } } } : {}),
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
    select: { agencyId: true },
  });

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

    return {
      from: `${sessionUser.name ?? "Sales Progressor"} <${userEmail.email}>`,
      replyTo: userEmail.email,
    };
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
  if (!userEmail) return fallback();

  return {
    from: `${sessionUser.name ?? "Agent"} <${userEmail.email}>`,
    replyTo: userEmail.email,
  };
}
