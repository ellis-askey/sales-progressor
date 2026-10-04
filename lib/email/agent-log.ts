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

import { sendEmail, isSuppressed, type EmailAttachment } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { type AudienceBucket } from "@/lib/email/audience-buckets";
import { resolveFileBucketByTransaction } from "@/lib/email/bucket-toggles";

export type AgentEmailKind =
  | "weekly_brief"
  | "morning_digest"
  | "retention"
  // Booking reminders (survey / lender valuation): the day-of-booking "put it
  // in your diary" email, and the 7am morning-of nudge. See
  // docs/active/booking-reminders/00-plan.md.
  | "booking_diary"
  | "booking_morning"
  | "welcome"
  | "claim_welcome"
  | "team_invite"
  | "team_accepted"
  | "portal_message"
  | "domain_auth"
  | "verified_email"
  | "chain_invite"
  | "chain_invite_nudge"
  | "chain_neighbour_update"
  | "chain_neighbour_chase"
  | "milestone_agent"
  | "milestone_progressor"
  | "password_reset"
  // Onboarding email for a progression business's newly-added client agent:
  // carries a live set-password link (so it's redacted like password_reset).
  | "client_agent_setup"
  // Onboarding email for a progression business's newly-added TEAM member
  // (a progressor colleague): also carries a live set-password link.
  | "teammate_setup";

// Kinds whose rendered body must not be stored (contains a live secret link).
const REDACTED_KINDS: ReadonlySet<AgentEmailKind> = new Set<AgentEmailKind>(["password_reset", "client_agent_setup", "teammate_setup"]);

// Fixed audience bucket per kind, for the platform on/off switches. Kinds NOT
// listed are FILE-DRIVEN (milestone_agent / milestone_progressor / portal_message)
// and resolve their bucket from the transaction at send time. See
// lib/email/audience-buckets.ts.
const FIXED_BUCKET: Partial<Record<AgentEmailKind, AudienceBucket>> = {
  password_reset: "platform_admin",
  verified_email: "platform_admin",
  domain_auth: "platform_admin",
  client_agent_setup: "progression_invite",
  teammate_setup: "progression_invite",
  weekly_brief: "free_agency",
  morning_digest: "free_agency",
  retention: "free_agency",
  welcome: "free_agency",
  claim_welcome: "free_agency",
  team_invite: "free_agency",
  team_accepted: "free_agency",
  booking_diary: "free_agency",
  booking_morning: "free_agency",
  chain_invite: "free_agency",
  chain_invite_nudge: "free_agency",
  chain_neighbour_update: "free_agency",
  chain_neighbour_chase: "free_agency",
};

async function resolveBucketForKind(kind: AgentEmailKind, transactionId: string | null): Promise<AudienceBucket> {
  const fixed = FIXED_BUCKET[kind];
  if (fixed) return fixed;
  return transactionId ? resolveFileBucketByTransaction(transactionId) : "free_agency";
}

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
  attachments?: EmailAttachment[];
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
    attachments,
    kind,
    userId,
    agencyId,
    transactionId,
    meta,
  } = params;

  // Resolve this send's audience bucket so the platform kill switch applies.
  // Fixed-bucket kinds map directly; the file-driven ones (milestone / portal
  // message) follow who runs the file.
  const bucket = await resolveBucketForKind(kind, transactionId ?? null);

  // Send first; a send failure propagates exactly as with a bare sendEmail.
  const result = await sendEmail({ to, subject, text, html, from, replyTo, cc, emailType, templateVersion, attachments, audienceBucket: bucket });

  // If the bucket is switched off the send was skipped; don't log it as sent.
  if (isSuppressed(result)) return result;

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
