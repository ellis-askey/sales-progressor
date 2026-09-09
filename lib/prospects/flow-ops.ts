// Shared flow operations, used by the flow server actions, the reply/bounce
// webhooks, the opt-out path, and the due-step cron. No "use server" and no auth
// here: callers own authorisation. Pure DB orchestration over ProspectFlow /
// ProspectFlowStep, built on the fixed DEFAULT_SEQUENCE in ./flow.

import { commandDb } from "@/lib/command/prisma";
import { extractFirstName } from "@/lib/contacts/displayName";
import { DEFAULT_SEQUENCE, FLOW_SENDER_NAME, buildStepDraft, addDays } from "./flow";

// The recipient + template context for a prospect (primary contact first, then
// the general inbox). `to` is null when we have no address to send to.
async function resolveDraftContext(prospectId: string) {
  const p = await commandDb.prospect.findUnique({
    where: { id: prospectId },
    include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } },
  });
  if (!p) return null;
  const primary = p.contacts[0] ?? null;
  const to = primary?.email ?? p.generalEmail ?? null;
  const firstName = primary?.name?.trim() ? extractFirstName(primary.name) : "";
  return {
    to,
    contactId: primary?.id ?? null,
    ctx: { firstName, agencyName: p.agencyName, senderName: FLOW_SENDER_NAME },
  };
}

// Draft a scheduled step and flip it to `queued` (ready for approval). Only acts
// on a `scheduled` step of an `active` flow, so it is safe to call repeatedly.
// Returns true if it queued the step.
export async function queueFlowStep(stepId: string): Promise<boolean> {
  const step = await commandDb.prospectFlowStep.findUnique({ where: { id: stepId }, include: { flow: true } });
  if (!step || step.status !== "scheduled" || step.flow.status !== "active") return false;
  const resolved = await resolveDraftContext(step.flow.prospectId);
  if (!resolved) return false;
  const draft = buildStepDraft(step.templateKey, resolved.ctx);
  await commandDb.prospectFlowStep.update({
    where: { id: stepId },
    data: {
      status: "queued",
      queuedAt: new Date(),
      contactId: resolved.contactId,
      toEmail: resolved.to,
      subject: draft?.subject ?? null,
      body: draft?.body ?? null,
    },
  });
  return true;
}

// After a step sends, schedule the next still-scheduled step relative to now
// (its gap runs from the actual send), or complete the flow if none remain.
export async function advanceFlowAfterSend(flowId: string, sentStepIndex: number): Promise<void> {
  const next = await commandDb.prospectFlowStep.findFirst({
    where: { flowId, stepIndex: { gt: sentStepIndex }, status: "scheduled" },
    orderBy: { stepIndex: "asc" },
  });
  if (!next) {
    await commandDb.prospectFlow.update({ where: { id: flowId }, data: { status: "completed", completedAt: new Date() } });
    return;
  }
  const gap = DEFAULT_SEQUENCE[next.stepIndex]?.gapDays ?? 14;
  await commandDb.prospectFlowStep.update({ where: { id: next.id }, data: { scheduledFor: addDays(new Date(), gap) } });
}

// Stop a prospect's active flow(s) and skip every remaining step. Used when the
// prospect replies, opts out, or bounces, and by the manual "stop flow" action.
export async function haltActiveFlows(prospectId: string, reason: string): Promise<void> {
  const flows = await commandDb.prospectFlow.findMany({ where: { prospectId, status: "active" }, select: { id: true } });
  if (!flows.length) return;
  const ids = flows.map((f) => f.id);
  await commandDb.prospectFlow.updateMany({
    where: { id: { in: ids } },
    data: { status: "halted", haltedReason: reason, completedAt: new Date() },
  });
  await commandDb.prospectFlowStep.updateMany({
    where: { flowId: { in: ids }, status: { in: ["scheduled", "queued"] } },
    data: { status: "skipped", skippedAt: new Date() },
  });
}

// The subject/body a step will send: its saved draft if queued, otherwise built
// fresh from the template + current prospect context (so upcoming steps preview
// too). `toEmail` is who it would go to right now.
export async function previewStep(
  stepId: string,
): Promise<{ subject: string; body: string; toEmail: string | null } | null> {
  const step = await commandDb.prospectFlowStep.findUnique({ where: { id: stepId }, include: { flow: true } });
  if (!step) return null;
  if (step.subject && step.body) return { subject: step.subject, body: step.body, toEmail: step.toEmail };
  const resolved = await resolveDraftContext(step.flow.prospectId);
  const draft = buildStepDraft(
    step.templateKey,
    resolved?.ctx ?? { firstName: "", agencyName: "", senderName: FLOW_SENDER_NAME },
  );
  return { subject: draft?.subject ?? "", body: draft?.body ?? "", toEmail: resolved?.to ?? null };
}

// Queue every scheduled step that has fallen due. Returns how many were queued.
// Driven by the daily cron.
export async function queueDueSteps(now: Date = new Date()): Promise<number> {
  const due = await commandDb.prospectFlowStep.findMany({
    where: { status: "scheduled", scheduledFor: { lte: now }, flow: { status: "active" } },
    select: { id: true },
    take: 200,
  });
  let queued = 0;
  for (const s of due) {
    if (await queueFlowStep(s.id)) queued++;
  }
  return queued;
}
