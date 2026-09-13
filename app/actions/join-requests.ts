"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { approveJoinRequest, rejectJoinRequest } from "@/lib/services/agency-join-requests";
import type { UserRole } from "@prisma/client";

// Director-only, agency-scoped (the service double-checks request.agencyId === the
// approver's agency). See docs/active/signup-request-to-join/SPEC.md.

export async function approveJoinRequestAction(
  requestId: string,
  role: "director" | "negotiator",
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  if (session.user.role !== "director" || !session.user.agencyId) {
    return { ok: false, error: "Only a director can approve join requests." };
  }
  const res = await approveJoinRequest({
    requestId,
    decidedByUserId: session.user.id,
    agencyId: session.user.agencyId,
    role: (role === "director" ? "director" : "negotiator") as UserRole,
  });
  revalidatePath("/agent/account/team");
  return res;
}

export async function rejectJoinRequestAction(
  requestId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  if (session.user.role !== "director" || !session.user.agencyId) {
    return { ok: false, error: "Only a director can decline join requests." };
  }
  const res = await rejectJoinRequest({
    requestId,
    decidedByUserId: session.user.id,
    agencyId: session.user.agencyId,
  });
  revalidatePath("/agent/account/team");
  return res;
}
