import sgMail from "@sendgrid/mail";
import { prisma } from "@/lib/prisma";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const DEFAULT_FROM = "Sales Progressor <updates@thesalesprogressor.co.uk>";

export async function sendEmail({
  to,
  cc,
  subject,
  text,
  html,
  from,
  replyTo,
}: {
  to: string;
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
}) {
  return sgMail.send({
    to,
    cc: cc && cc.length ? cc : undefined,
    from: from ?? DEFAULT_FROM,
    replyTo: replyTo,
    subject,
    text,
    html: html ?? text.replace(/\n/g, "<br>"),
  });
}

// Platform-level chain notification emails (withdrawal, exchange, completion, celebration).
// From: Sales Progressor <updates@thesalesprogressor.co.uk>
// Reply-To: support@thesalesprogressor.co.uk
// ASM unsubscribe group included when SENDGRID_UNSUBSCRIBE_GROUP_ID is set.
// Set EMAIL_SANDBOX_MODE=true on staging to validate without delivering.
export async function sendChainEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const isSandbox = process.env.EMAIL_SANDBOX_MODE === "true";
  const asmGroupId = process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID
    ? parseInt(process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID, 10)
    : undefined;

  if (isSandbox) {
    console.log(`[EMAIL_SANDBOX] to=${to} subject="${subject}"`);
  }

  await sgMail.send({
    to,
    from: DEFAULT_FROM,
    replyTo: "support@thesalesprogressor.co.uk",
    subject,
    text,
    html: html ?? text.replace(/\n/g, "<br>"),
    ...(asmGroupId ? { asm: { groupId: asmGroupId } } : {}),
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
  const fallback = {
    from: DEFAULT_FROM,
    replyTo: sessionUser.email ?? "updates@thesalesprogressor.co.uk",
  };

  const isInternalStaff =
    sessionUser.role === "sales_progressor" || sessionUser.role === "admin";

  if (isInternalStaff) {
    const tx = await prisma.propertyTransaction.findFirst({
      where: { id: transactionId },
      select: { agencyId: true },
    });
    if (!tx?.agencyId) return fallback;

    const domain = await prisma.verifiedDomain.findFirst({
      where: { agencyId: tx.agencyId, status: "verified" },
      select: { id: true },
    });
    if (!domain) return fallback;

    const userEmail = await prisma.userVerifiedEmail.findFirst({
      where: {
        userId: sessionUser.id,
        verifiedDomainId: domain.id,
        status: { in: ["verified", "legacy_single_sender"] },
      },
      select: { email: true },
    });
    if (!userEmail) return fallback;

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
  if (!userEmail) return fallback;

  return {
    from: `${sessionUser.name ?? "Agent"} <${userEmail.email}>`,
    replyTo: userEmail.email,
  };
}
