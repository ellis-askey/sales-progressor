"use server";

// Command Centre → Trial cockpit → Chains tab. Lets a superadmin fill in a
// neighbour chain stub's contact details (agency / agent name / email / phone)
// from the Command Centre, so TSP can help a trial agency populate their chains.
// commandDb is full-access, so the superadmin guard lives here (Law 8). (#299)

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";

async function assertSuperadmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) throw new Error("Unauthorised");
}

export type StubContactField = "agencyName" | "agentName" | "agentEmail" | "agentPhone";

export async function saveChainStubContactAction(input: {
  linkId: string;
  field: StubContactField;
  value: string;
}): Promise<{ ok: boolean }> {
  await assertSuperadmin();

  const v = input.value.trim() || null;
  const data =
    input.field === "agencyName" ? { stubAgencyName: v }
    : input.field === "agentName" ? { stubAgentName: v }
    : input.field === "agentEmail" ? { stubAgentEmail: v ? v.toLowerCase() : null }
    : { stubAgentPhone: v };

  // Only touch the one field; never clears the rest of the stub (it's live data
  // the chain drawer also edits).
  await commandDb.chainLink.update({ where: { id: input.linkId }, data });

  revalidatePath("/command/trials/boardwalk");
  return { ok: true };
}
