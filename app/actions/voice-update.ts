"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { completeMilestone } from "@/lib/services/milestones";
import { createManualTaskAction } from "@/app/actions/manual-tasks";
import { sendDraftClientUpdateAction, saveDraftNoteAction } from "@/app/actions/draft-update";
import { logEnquiryMovementAction } from "@/app/actions/enquiries";

// Applies an approved voice-note plan by calling the SAME actions an agent uses
// by hand, so it behaves identically for every context (TSP outsourced, free +
// invited agencies, progression businesses). completeMilestone has no auth of its
// own, so we scope-guard the file here; the others self-guard. Nothing here is
// irreversible beyond what the agent explicitly approved.

export type ApplyVoiceInput = {
  transactionId: string;
  milestones: { code: string; eventDate?: string | null }[];
  enquiry: { flipsCourtTo: "seller_solicitor" | "buyer_solicitor" } | null;
  todos: { title: string; dueDate?: string | null }[];
  sends: { contactIds: string[]; content: string; generatedText?: string }[];
  note?: string | null;
  transcript?: string | null;
};

export type ApplyVoiceResult =
  | { ok: true; summary: { milestones: number; todos: number; sends: number; enquiry: boolean } }
  | { ok: false; error: string };

const INTERNAL_ROLES = new Set(["sales_progressor", "admin", "superadmin"]);

export async function applyVoiceUpdateAction(input: ApplyVoiceInput): Promise<ApplyVoiceResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  // Guard access to the file (completeMilestone does not self-check).
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) return { ok: false, error: "File not found" };

  const summary = { milestones: 0, todos: 0, sends: 0, enquiry: false };
  const confirmer = { kind: "user" as const, id: session.user.id, name: session.user.name ?? "" };

  // 1. Milestones (ordered prereqs-first by the planner). bypassPrereqs so a late
  //    step plus its back-filled prerequisites all complete regardless of order.
  if (input.milestones.length) {
    const codes = input.milestones.map((m) => m.code);
    const defs = await prisma.milestoneDefinition.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
    const idByCode = new Map(defs.map((d) => [d.code, d.id]));
    for (const m of input.milestones) {
      const id = idByCode.get(m.code);
      if (!id) continue;
      try {
        await completeMilestone({
          transactionId: input.transactionId,
          milestoneDefinitionId: id,
          confirmer,
          eventDate: m.eventDate ? new Date(m.eventDate) : undefined,
          bypassPrereqs: true,
        });
        summary.milestones++;
      } catch {
        // Already complete / gated — skip, keep applying the rest.
      }
    }
  }

  // 2. Enquiry hand-over.
  if (input.enquiry) {
    const kind = input.enquiry.flipsCourtTo === "seller_solicitor" ? "raised" : "replies_sent";
    try {
      const r = await logEnquiryMovementAction({ transactionId: input.transactionId, mode: "handover", flipsCourtTo: input.enquiry.flipsCourtTo, kind });
      summary.enquiry = r.ok;
    } catch {
      /* non-fatal */
    }
  }

  // 3. To-dos. Internal staff self-assign; agency agents use the agency path.
  const isInternal = INTERNAL_ROLES.has(session.user.role);
  for (const t of input.todos) {
    if (!t.title.trim()) continue;
    try {
      await createManualTaskAction({
        title: t.title.trim(),
        transactionId: input.transactionId,
        assignedToId: session.user.id,
        dueDate: t.dueDate ?? undefined,
        ...(isInternal ? { isInternalSelfAssigned: true } : {}),
      });
      summary.todos++;
    } catch {
      // Context can't hold a to-do (pre-existing limitation) — don't block the rest.
    }
  }

  // 4. Per-side client updates (push else email, stored as a PortalMessage).
  for (const s of input.sends) {
    if (!s.contactIds.length || !s.content.trim()) continue;
    try {
      const r = await sendDraftClientUpdateAction({ transactionId: input.transactionId, contactIds: s.contactIds, content: s.content.trim(), generatedText: s.generatedText });
      if ("ok" in r && r.ok) summary.sends += r.count;
    } catch {
      /* non-fatal */
    }
  }

  // 5. One file note: the internal note (if kept) + the raw transcript for the record.
  const notePieces = [input.note?.trim() || null, input.transcript?.trim() ? `Voice note: ${input.transcript.trim()}` : null].filter(Boolean) as string[];
  if (notePieces.length) {
    await saveDraftNoteAction({ transactionId: input.transactionId, content: notePieces.join("\n\n") }).catch(() => {});
  }

  return { ok: true, summary };
}
