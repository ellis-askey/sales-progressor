"use server";

// Agent-facing read of the surveyor directory for the survey confirm (critique
// #211, phase 5). ProviderFirm is a shared, non-tenant directory — the public
// quote route (/quote/[token]) already reads it via the normal `prisma` client —
// so any authenticated agent may list surveyors to reuse one on a file. The
// write side is a quiet upsert inside confirmMilestoneAction (unlisted firm, so
// it never appears on the buyer quote picker). No commandDb / admin audit here;
// that path is for the Command Centre directory CRUD.

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export type SavedSurveyor = { id: string; name: string; email: string };

export async function getSavedSurveyors(): Promise<SavedSurveyor[]> {
  await requireSession();
  return prisma.providerFirm.findMany({
    where: { kind: "surveyor", active: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}
