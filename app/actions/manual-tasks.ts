"use server";

// Manual-task mutations (the /agent/to-do surface and the property-file To-Do
// tab). Moved off the old /api/manual-tasks route handlers so the mutation
// itself owns revalidation: a route handler cannot refresh the caller, and the
// old ones revalidated nothing, so the sidebar To-Do badge and the To-Do page
// header pills stayed stale until a hard reload (the reported bug). See
// docs/UI_STATE_SYNCHRONISATION_AUDIT.md, root cause RC1/RC2.
//
// Auth branching (internal self-assigned vs agent vs progressor) and the Law 7
// ownership guard are ported verbatim from the old routes — behaviour is
// unchanged; only the freshness of derived UI is fixed.

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toUKDateStr } from "@/lib/utils";
import {
  createManualTask,
  updateManualTask,
  updateManualTaskAsProgressor,
  updateInternalManualTask,
  deleteManualTask,
  deleteInternalManualTask,
  type ManualTaskWithRelations,
} from "@/lib/services/manual-tasks";

function isInternalRole(role: string | undefined | null): boolean {
  return role === "sales_progressor" || role === "admin" || role === "superadmin";
}

// Revalidate the /agent LAYOUT, not just the page. The sidebar To-Do badge
// (todoDueCount) and the To-Do page header stat pills are computed in
// app/agent/layout.tsx, so a page-only revalidate leaves them stale. This
// mirrors updateBrandColor in app/actions/agent-preferences.ts.
function revalidateTodos() {
  revalidatePath("/agent", "layout");
}

export interface CreateManualTaskInput {
  title: string;
  notes?: string;
  transactionId?: string;
  assignedToId?: string;
  dueDate?: string;
  isAgentRequest?: boolean;
  isInternalSelfAssigned?: boolean;
  isReview?: boolean;
}

export async function createManualTaskAction(
  input: CreateManualTaskInput,
): Promise<ManualTaskWithRelations> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorised");

  const { title, notes, transactionId, assignedToId, dueDate, isAgentRequest, isInternalSelfAssigned, isReview } = input;

  if (!title?.trim()) throw new Error("Title is required");

  if (dueDate) {
    const dStr = toUKDateStr(new Date(dueDate));
    const todayStr = toUKDateStr(new Date());
    if (dStr < todayStr) throw new Error("Due date cannot be in the past");
  }

  // Internal self-assigned to-dos: SP/admin/superadmin only. agencyId is null
  // for the unlinked case; if a transaction is linked, the task's agencyId
  // mirrors the transaction's.
  if (isInternalSelfAssigned === true) {
    if (!isInternalRole(session.user.role)) {
      throw new Error("Forbidden: internal staff only");
    }
    let resolvedAgencyId: string | null = null;
    if (transactionId) {
      const tx = await prisma.propertyTransaction.findUnique({
        where: { id: transactionId },
        select: { agencyId: true },
      });
      resolvedAgencyId = tx?.agencyId ?? null;
    }
    const task = await createManualTask({
      agencyId: resolvedAgencyId,
      createdById: session.user.id,
      title: title.trim(),
      notes,
      transactionId,
      assignedToId,
      dueDate,
      isInternalSelfAssigned: true,
      isReview: isReview === true,
    });
    revalidateTodos();
    return task as ManualTaskWithRelations;
  }

  // Legacy agent path: requires agencyId (customer agency users).
  if (!session.user.agencyId) {
    throw new Error("Cannot create agent task without an agency");
  }

  // Guard (Law 7): a linked transaction must belong to the caller's agency.
  // Without this a crafted transactionId would attach another agency's file to
  // this to-do and leak its property address into the caller's list.
  if (transactionId) {
    const owned = await prisma.propertyTransaction.findFirst({
      where: { id: transactionId, agencyId: session.user.agencyId },
      select: { id: true },
    });
    if (!owned) throw new Error("Transaction not found");
  }

  const task = await createManualTask({
    agencyId: session.user.agencyId,
    createdById: session.user.id,
    title: title.trim(),
    notes,
    transactionId,
    assignedToId,
    dueDate,
    isAgentRequest: isAgentRequest === true,
    isReview: isReview === true,
  });
  revalidateTodos();
  return task as ManualTaskWithRelations;
}

export type UpdateManualTaskData = Partial<{
  title: string;
  notes: string | null;
  progressorNote: string | null;
  status: "open" | "done";
  assignedToId: string;
  dueDate: string | null;
}>;

export async function updateManualTaskAction(
  id: string,
  data: UpdateManualTaskData,
): Promise<ManualTaskWithRelations> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorised");

  // Internal self-assigned tasks branch: role-gated, agencyId-agnostic.
  const target = await prisma.manualTask.findUnique({
    where: { id },
    select: { isInternalSelfAssigned: true },
  });
  if (target?.isInternalSelfAssigned) {
    if (!isInternalRole(session.user.role)) {
      throw new Error("Forbidden");
    }
    const task = await updateInternalManualTask(id, data);
    revalidateTodos();
    return task as ManualTaskWithRelations;
  }

  const task = session.user.role === "sales_progressor"
    ? await updateManualTaskAsProgressor(id, session.user.id, data)
    : await updateManualTask(id, session.user.agencyId, data);
  revalidateTodos();
  return task as ManualTaskWithRelations;
}

export async function deleteManualTaskAction(id: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorised");

  const target = await prisma.manualTask.findUnique({
    where: { id },
    select: { isInternalSelfAssigned: true },
  });
  if (target?.isInternalSelfAssigned) {
    if (!isInternalRole(session.user.role)) {
      throw new Error("Forbidden");
    }
    await deleteInternalManualTask(id);
    revalidateTodos();
    return;
  }

  await deleteManualTask(id, session.user.agencyId);
  revalidateTodos();
}
