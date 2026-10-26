"use server";

// Resend a single queued email that errored but never actually sent (e.g. the
// pre-2026-10-19 createdAt-based age-out dead-lettered deferred rows before a
// single send attempt — they're flagged "retry_age_exceeded" in Needs
// attention). Clears the error and re-schedules it into the next working
// window, so the (now-fixed) drain picks it up and sends it for real.
//
// Scoped via resolveEmailScope — the caller can only resend a row for a file in
// their own book (Law 7). Never touches an already-sent row.

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { resolveEmailScope, type EmailScopeInput } from "@/lib/services/automated-emails-scope";
import { deliverAtInsideWorkingWindow } from "@/lib/emails/working-hours";
import { revalidatePath } from "next/cache";

export async function resendQueuedEmailAction(emailId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  const input: EmailScopeInput = {
    role: session.user.role as EmailScopeInput["role"],
    userId: session.user.id,
    agencyId: session.user.agencyId || null,
    hasAdminPowers: hasAdminPowers(session),
  };
  const { queueScope } = await resolveEmailScope(input);

  // Must be in the caller's scope AND never sent — we re-fire failures, never
  // double-send something already delivered.
  const row = await prisma.outboundEmailQueue.findFirst({
    where: { id: emailId, ...queueScope, sentAt: null },
    select: { id: true },
  });
  if (!row) return { ok: false, error: "That email isn't available to resend." };

  await prisma.outboundEmailQueue.update({
    where: { id: emailId },
    data: { errorAt: null, errorMessage: null, scheduledFor: deliverAtInsideWorkingWindow(new Date()) },
  });

  revalidatePath("/agent/automated-emails");
  revalidatePath("/agent/hub");
  return { ok: true };
}
