"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { performProspectSend } from "@/lib/prospects/perform-send";
import { renderProspectEmailHtml } from "@/lib/prospects/send";
import { DEFAULT_SEQUENCE } from "@/lib/prospects/flow";
import { queueFlowStep, advanceFlowAfterSend, haltActiveFlows, previewStep } from "@/lib/prospects/flow-ops";

// Command Centre → Prospects: the outreach flow actions. Superadmin-gated.
// Auto-queue, human-approve: starting a flow drafts the first email and holds it
// for approval; nothing sends until the operator approves a queued step.

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) redirect("/dashboard");
  return session;
}

type Ok = { ok: true };
type Err = { ok: false; error: string };

// Start the default sequence on a prospect: create the flow + its steps, then
// draft and queue the first email for approval. One active flow per prospect.
export async function startProspectFlowAction(prospectId: string): Promise<Ok | Err> {
  const session = await requireSuperAdmin();

  const p = await commandDb.prospect.findUnique({
    where: { id: prospectId },
    select: { optedOutAt: true, bouncedAt: true, flows: { where: { status: "active" }, select: { id: true } } },
  });
  if (!p) return { ok: false, error: "Prospect not found." };
  if (p.optedOutAt) return { ok: false, error: "This prospect has opted out of email." };
  if (p.bouncedAt) return { ok: false, error: "A previous email to this prospect bounced." };
  if (p.flows.length) return { ok: false, error: "A flow is already running for this prospect." };

  const now = new Date();
  const flow = await commandDb.prospectFlow.create({
    data: {
      prospectId,
      startedById: session.user.id,
      steps: {
        create: DEFAULT_SEQUENCE.map((def, i) => ({
          stepIndex: i,
          templateKey: def.templateKey,
          // The first step is due immediately; later steps are scheduled once the
          // previous one actually sends.
          scheduledFor: i === 0 ? now : null,
        })),
      },
    },
    include: { steps: { orderBy: { stepIndex: "asc" }, take: 1 } },
  });

  const first = flow.steps[0];
  if (first) await queueFlowStep(first.id);

  await commandDb.prospectActivity.create({
    data: { prospectId, actorUserId: session.user.id, type: "note", summary: "Started an outreach flow" },
  });
  revalidatePath("/command/prospects");
  return { ok: true };
}

// Approve a queued step: send it through the normal outreach path, link it to
// the ProspectEmail, then schedule the next step (or complete the flow).
export async function approveFlowStepAction(stepId: string): Promise<Ok | Err> {
  const session = await requireSuperAdmin();

  const step = await commandDb.prospectFlowStep.findUnique({ where: { id: stepId }, include: { flow: true } });
  if (!step) return { ok: false, error: "Step not found." };
  if (step.flow.status !== "active") return { ok: false, error: "This flow is no longer active." };
  if (step.status !== "queued") return { ok: false, error: "This step is not ready to send." };
  if (!step.toEmail || !step.subject || !step.body) return { ok: false, error: "This step has no draft to send." };

  const res = await performProspectSend({
    prospectId: step.flow.prospectId,
    actorUserId: session.user.id,
    contactId: step.contactId,
    to: step.toEmail,
    subject: step.subject,
    body: step.body,
  });
  if (!res.ok) return res;

  await commandDb.prospectFlowStep.update({
    where: { id: stepId },
    data: { status: "sent", sentAt: new Date(), prospectEmailId: res.prospectEmailId },
  });
  await advanceFlowAfterSend(step.flowId, step.stepIndex);

  revalidatePath("/command/prospects");
  return { ok: true };
}

// Edit a queued step's draft before approving it (per-prospect wording changes).
export async function updateFlowStepDraftAction(
  stepId: string,
  patch: { subject: string; body: string },
): Promise<Ok | Err> {
  await requireSuperAdmin();
  const step = await commandDb.prospectFlowStep.findUnique({ where: { id: stepId }, select: { status: true } });
  if (!step) return { ok: false, error: "Step not found." };
  if (step.status !== "queued") return { ok: false, error: "Only a step that is ready to approve can be edited." };
  const subject = patch.subject.trim();
  const body = patch.body.trim();
  if (!subject || !body) return { ok: false, error: "Subject and body are both required." };
  await commandDb.prospectFlowStep.update({ where: { id: stepId }, data: { subject, body } });
  revalidatePath("/command/prospects");
  return { ok: true };
}

// Skip a queued or scheduled step without sending, then advance the flow.
export async function skipFlowStepAction(stepId: string): Promise<Ok | Err> {
  await requireSuperAdmin();
  const step = await commandDb.prospectFlowStep.findUnique({ where: { id: stepId }, include: { flow: true } });
  if (!step) return { ok: false, error: "Step not found." };
  if (step.flow.status !== "active") return { ok: false, error: "This flow is no longer active." };
  if (step.status !== "queued" && step.status !== "scheduled") return { ok: false, error: "This step cannot be skipped." };
  await commandDb.prospectFlowStep.update({ where: { id: stepId }, data: { status: "skipped", skippedAt: new Date() } });
  await advanceFlowAfterSend(step.flowId, step.stepIndex);
  revalidatePath("/command/prospects");
  return { ok: true };
}

// Manually stop a prospect's flow and skip its remaining steps.
export async function cancelProspectFlowAction(prospectId: string): Promise<Ok | Err> {
  await requireSuperAdmin();
  await haltActiveFlows(prospectId, "manual");
  revalidatePath("/command/prospects");
  return { ok: true };
}

// Render a step's email exactly as the recipient would see it, for the drawer
// preview. Returns the subject + full HTML (same markup the send path produces).
export async function previewFlowStepAction(
  stepId: string,
): Promise<{ ok: true; subject: string; html: string; toEmail: string | null } | Err> {
  await requireSuperAdmin();
  const preview = await previewStep(stepId);
  if (!preview) return { ok: false, error: "Step not found." };
  return { ok: true, subject: preview.subject, html: renderProspectEmailHtml(preview.body), toEmail: preview.toEmail };
}
