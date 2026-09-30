"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner, addClientAgency } from "@/lib/services/progression-clients";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AddClientResult = { ok: true } | { ok: false; error: string };

/**
 * Add an estate agent as a client of the acting user's progression business.
 * Flag-gated (this is a new external-facing entry point) and owner-gated. The
 * client link grants NO transaction access — see lib/services/progression-clients.
 */
export async function addClientAgencyAction(formData: FormData): Promise<AddClientResult> {
  if (!progressionBusinessesEnabled()) {
    return { ok: false, error: "This feature isn't enabled yet." };
  }

  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) {
    return { ok: false, error: "Only a progression-business owner can add clients." };
  }

  const agentName = (formData.get("agentName") as string | null)?.trim() ?? "";
  const agentEmail = (formData.get("agentEmail") as string | null)?.trim() ?? "";
  const agencyName = (formData.get("agencyName") as string | null)?.trim() ?? "";

  if (!agentName || agentName.length > 100) {
    return { ok: false, error: "Please enter the agent's name." };
  }
  if (!agentEmail || agentEmail.length > 255 || !EMAIL_RE.test(agentEmail)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (!agencyName || agencyName.length > 120) {
    return { ok: false, error: "Please enter the agency name." };
  }

  const result = await addClientAgency({ owner, agentName, agentEmail, agencyName });
  if (!result.ok) return result;

  revalidatePath("/agent/clients");
  return { ok: true };
}
