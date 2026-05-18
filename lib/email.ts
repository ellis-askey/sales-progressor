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
