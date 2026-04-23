"use server";

import { revalidatePath } from "next/cache";
import { portalCompleteMilestone } from "@/lib/services/portal";

export async function portalConfirmMilestoneAction(input: {
  token: string;
  milestoneDefinitionId: string;
  eventDate?: string | null;
}) {
  const completion = await portalCompleteMilestone(input);

  // Revalidate all portal pages for this token
  revalidatePath(`/portal/${input.token}`, "page");
  revalidatePath(`/portal/${input.token}/progress`, "page");
  revalidatePath(`/portal/${input.token}/updates`, "page");

  return completion;
}
