"use server";

import { revalidatePath } from "next/cache";
import { portalCompleteMilestone, portalMarkNotRequired } from "@/lib/services/portal";

export async function portalConfirmMilestoneAction(input: {
  token: string;
  milestoneDefinitionId: string;
  eventDate?: string | null;
}) {
  const completion = await portalCompleteMilestone(input);

  revalidatePath(`/portal/${input.token}`, "page");
  revalidatePath(`/portal/${input.token}/progress`, "page");
  revalidatePath(`/portal/${input.token}/updates`, "page");

  return completion;
}

export async function portalMarkNotRequiredAction(input: {
  token: string;
  milestoneDefinitionId: string;
}) {
  await portalMarkNotRequired(input);

  revalidatePath(`/portal/${input.token}`, "page");
  revalidatePath(`/portal/${input.token}/progress`, "page");
  revalidatePath(`/portal/${input.token}/updates`, "page");
}
