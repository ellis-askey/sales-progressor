// sendAgentEmail — sendEmail plus a best-effort AgentEmailLog write.
//
// Emails to CLIENTS already leave a trail (OutboundEmailQueue + file activity).
// Emails to AGENCY USERS (and external agents) fired straight through sendEmail
// with no record, so there was no way to answer "what did we send this agency,
// and when". This wrapper records each one for the Command Centre surface at
// /command/agent-emails.
//
// Guarantees:
//   - The send happens exactly as before: we call sendEmail with the same args
//     and propagate any send error to the caller.
//   - The log is best-effort: a logging failure is swallowed (and console'd) so
//     it can NEVER block or fail a real send.
//
// Redaction: password_reset bodies carry a live reset link, so those rows store
// kind + subject + recipient only (text/html NULL). See REDACTED_KINDS.

import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type AgentEmailKind =
  | "weekly_brief"
  | "morning_digest"
  | "retention"
  | "welcome"
  | "claim_welcome"
  | "team_invite"
  | "team_accepted"
  | "portal_message"
  | "domain_auth"
  | "verified_email"
  | "chain_invite"
  | "password_reset";

// Kinds whose rendered body must not be stored (contains a live secret link).
const REDACTED_KINDS: ReadonlySet<AgentEmailKind> = new Set<AgentEmailKind>(["password_reset"]);

type SendAgentEmailParams = {
  // Passthrough to sendEmail.
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  emailType?: string;
  templateVersion?: string;
  // Logging context + taxonomy.
  kind: AgentEmailKind;
  userId?: string | null;
  agencyId?: string | null;
  transactionId?: string | null;
  meta?: Prisma.InputJsonValue | null;
};

export async function sendAgentEmail(params: SendAgentEmailParams) {
  const {
    to,
    subject,
    text,
    html,
    from,
    replyTo,
    cc,
    emailType,
    templateVersion,
    kind,
    userId,
    agencyId,
    transactionId,
    meta,
  } = params;

  // Send first; a send failure propagates exactly as with a bare sendEmail.
  const result = await sendEmail({ to, subject, text, html, from, replyTo, cc, emailType, templateVersion });

  // Then log, best-effort. Never let a logging failure surface to the caller.
  try {
    const redacted = REDACTED_KINDS.has(kind);
    await prisma.agentEmailLog.create({
      data: {
        toEmail: to,
        userId: userId ?? null,
        agencyId: agencyId ?? null,
        transactionId: transactionId ?? null,
        kind,
        subject,
        text: redacted ? null : text,
        html: redacted ? null : html ?? null,
        meta: meta ?? undefined,
      },
    });
  } catch (err) {
    console.error(`[agent-email-log] failed to log ${kind} to ${to}:`, err);
  }

  return result;
}
