// The experiment send-state lifecycle (Build Order H). Reuses the existing
// SendGrid transport (sendProspectOutreach) but wraps it in a strict state machine
// so no experiment email can be sent twice, and an ambiguous outcome is never
// blindly retried.
//
// sendState on ProspectEmail:
//   pending                    row created, NOT yet dispatched (safe to send)
//   sending                    committed immediately before the SendGrid call
//                              (the point of no certainty)
//   accepted                   SendGrid returned 2xx (or resolved by event webhook)
//   failed_before_acceptance   SendGrid errored BEFORE accepting (safe to retry)
//   uncertain                  a `sending` row whose outcome we never recorded
//                              (crash/timeout after dispatch). NEVER auto-retried.
//   skipped_suppressed         assigned prospect became ineligible at send time;
//                              skipped, NOT replaced.
//
// Idempotency: sendDedupeKey = "<experimentId>:<prospectId>:<stepIndex>" is @unique,
// so the DB physically refuses a duplicate. We prefer a missed email over a
// possible duplicate.

import { commandDb } from "@/lib/command/prisma";
import { randomUUID } from "crypto";
import { extractFirstName } from "@/lib/contacts/displayName";
import { advanceFlowAfterSend } from "@/lib/prospects/flow-ops";
import { sendProspectOutreach } from "@/lib/prospects/send";
import { aiOutreachSender, OUTREACH_SEND_LIMITS } from "./send-limits";

export class AISenderMissingError extends Error {
  constructor() {
    super("AI_OUTREACH_FROM_EMAIL is not set or invalid; experiment sends are blocked (no fallback to the manual sender).");
    this.name = "AISenderMissingError";
  }
}

// Injectable transport (tests pass a mock; production uses SendGrid).
export type SendTransport = (args: {
  to: string;
  subject: string;
  text: string;
  replyToken: string;
  prospectEmailId: string;
  from: { email: string; name: string };
}) => Promise<{ sgMessageId: string | null }>;

const defaultTransport: SendTransport = (a) => sendProspectOutreach(a);

export type StepSendOutcome =
  | "accepted"
  | "failed_before_acceptance"
  | "skipped_suppressed"
  | "in_flight"
  | "already_terminal";

function personalise(text: string, firstName: string, agencyName: string): string {
  return text
    .replace(/\{\{\s*firstName\s*\}\}/g, firstName || "there")
    .replace(/\{\{\s*agencyName\s*\}\}/g, agencyName || "your agency");
}

// Send ONE due step of an experiment flow through the lifecycle. Idempotent and
// crash-safe: safe to call repeatedly for the same step.
export async function sendExperimentStep(params: {
  stepId: string;
  transport?: SendTransport;
  now?: Date;
}): Promise<StepSendOutcome> {
  const transport = params.transport ?? defaultTransport;
  const now = params.now ?? new Date();

  const step = await commandDb.prospectFlowStep.findUnique({
    where: { id: params.stepId },
    include: { flow: true },
  });
  if (!step || !step.flow.experimentId || step.flow.status !== "active") return "already_terminal";
  if (step.status === "sent" || step.status === "skipped") return "already_terminal";
  if (!step.toEmail || !step.subject || !step.body) return "already_terminal";

  const experimentId = step.flow.experimentId;
  const prospectId = step.flow.prospectId;
  const dedupeKey = `${experimentId}:${prospectId}:${step.stepIndex}`;

  // Sender: HARD requirement; no fallback to the manual identity.
  const sender = aiOutreachSender();
  if (!sender) throw new AISenderMissingError();

  // Send-time suppression re-check (cohort freeze: skip, never replace).
  const prospect = await commandDb.prospect.findUnique({
    where: { id: prospectId },
    select: { optedOutAt: true, bouncedAt: true, agencyName: true, contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1, select: { name: true } } },
  });
  const suppressed = !prospect || prospect.optedOutAt || prospect.bouncedAt;

  // Locate or create the dedupe-keyed ProspectEmail.
  const existing = await commandDb.prospectEmail.findUnique({ where: { sendDedupeKey: dedupeKey } });
  if (existing) {
    if (["accepted", "uncertain", "skipped_suppressed"].includes(existing.sendState ?? "")) return "already_terminal";
    if (existing.sendState === "sending") return "in_flight";
  }

  if (suppressed) {
    // Record a terminal skipped_suppressed row (or flip an existing pending one).
    const pe = existing
      ? await commandDb.prospectEmail.update({ where: { id: existing.id }, data: { sendState: "skipped_suppressed", failReason: "suppressed at send time" } })
      : await commandDb.prospectEmail.create({
          data: {
            prospectId, toEmail: step.toEmail, subject: step.subject, body: step.body,
            experimentId, variantId: step.flow.variantId, contactId: step.contactId,
            sendDedupeKey: dedupeKey, sendState: "skipped_suppressed", failReason: "suppressed at send time",
            replyToken: randomUUID().replace(/-/g, ""),
          },
        });
    await commandDb.prospectFlowStep.update({ where: { id: step.id }, data: { status: "skipped", skippedAt: now, prospectEmailId: pe.id } });
    await advanceFlowAfterSend(step.flowId, step.stepIndex);
    return "skipped_suppressed";
  }

  const firstName = prospect.contacts[0]?.name ? extractFirstName(prospect.contacts[0].name) : "";
  const subject = personalise(step.subject, firstName, prospect.agencyName);
  const body = personalise(step.body, firstName, prospect.agencyName);

  // Create (pending) or reuse a retryable ProspectEmail.
  const pe =
    existing ??
    (await commandDb.prospectEmail.create({
      data: {
        prospectId, toEmail: step.toEmail, subject, body,
        experimentId, variantId: step.flow.variantId, contactId: step.contactId,
        sendDedupeKey: dedupeKey, sendState: "pending", replyToken: randomUUID().replace(/-/g, ""),
      },
    }));

  // Atomic claim pending|failed_before_acceptance -> sending. dispatchStartedAt is
  // the point of no certainty. Only the winner proceeds (concurrency guard).
  const claim = await commandDb.prospectEmail.updateMany({
    where: { id: pe.id, sendState: { in: ["pending", "failed_before_acceptance"] } },
    data: { sendState: "sending", dispatchStartedAt: now, attemptCount: { increment: 1 } },
  });
  if (claim.count === 0) return "in_flight"; // someone else claimed it

  try {
    const { sgMessageId } = await transport({ to: step.toEmail, subject, text: body, replyToken: pe.replyToken!, prospectEmailId: pe.id, from: sender });
    await commandDb.prospectEmail.update({ where: { id: pe.id }, data: { sendState: "accepted", acceptedAt: new Date(), sgMessageId } });
    await commandDb.prospectFlowStep.update({ where: { id: step.id }, data: { status: "sent", sentAt: new Date(), prospectEmailId: pe.id } });
    await advanceFlowAfterSend(step.flowId, step.stepIndex);
    return "accepted";
  } catch (e) {
    // The transport threw BEFORE acceptance -> known-not-sent -> safe to retry.
    await commandDb.prospectEmail.update({
      where: { id: pe.id },
      data: { sendState: "failed_before_acceptance", failReason: e instanceof Error ? e.message.slice(0, 200) : "send failed" },
    });
    return "failed_before_acceptance";
  }
}

// Crash recovery: a `sending` row older than the uncertain threshold with no
// acceptance recorded is marked `uncertain` (potentially dispatched). NEVER
// auto-retried. Returns how many rows were marked. A row still `pending` is
// definitely-never-dispatched and is left retryable.
export async function recoverStaleSending(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - OUTREACH_SEND_LIMITS.UNCERTAIN_THRESHOLD_MS);
  const res = await commandDb.prospectEmail.updateMany({
    where: { sendState: "sending", dispatchStartedAt: { lt: cutoff }, acceptedAt: null },
    data: { sendState: "uncertain" },
  });
  return res.count;
}
