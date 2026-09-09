"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { MEMORY_KINDS, CLAIM_CLASSES, MEMORY_STATUSES } from "@/lib/command/content/brand-taxonomy";

// Server actions for brand positioning + memory (docs/active/content-brand/
// SPEC.md, Phase 1.2). Superadmin-gated: commandDb is full-access, so the guard
// lives here.

async function assertSuperadmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    throw new Error("Unauthorised");
  }
}

function revalidate() {
  revalidatePath("/command/content/brand");
  revalidatePath("/command/content");
}

const KIND_IDS = new Set(MEMORY_KINDS.map((k) => k.id));
const CLAIM_IDS = new Set(CLAIM_CLASSES.map((c) => c.id));

// Upsert the single positioning row. targetAudiences arrives as a newline/comma
// list and is stored as a string[].
export async function saveBrandProfileAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();

  const str = (k: string) => ((formData.get(k) as string) ?? "").trim();
  const audiencesRaw = str("targetAudiences");
  const targetAudiences = audiencesRaw
    ? audiencesRaw.split(/[\n,]/).map((a) => a.trim()).filter(Boolean)
    : [];

  const data = {
    primaryIdentity: str("primaryIdentity"),
    credibility: str("credibility"),
    personality: str("personality"),
    associations: str("associations"),
    desiredReputation: str("desiredReputation"),
    targetAudiences,
  };

  const existing = await commandDb.brandProfile.findFirst({ orderBy: { updatedAt: "desc" } });
  if (existing) {
    await commandDb.brandProfile.update({ where: { id: existing.id }, data });
  } else {
    await commandDb.brandProfile.create({ data });
  }

  revalidate();
  return { ok: true };
}

export async function addMemoryAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();

  const body = ((formData.get("body") as string) ?? "").trim();
  const kind = (formData.get("kind") as string) ?? "";
  const claimClass = ((formData.get("claimClass") as string) ?? "ellis_opinion") || "ellis_opinion";
  if (!body || !KIND_IDS.has(kind as never) || !CLAIM_IDS.has(claimClass as never)) return { ok: false };

  // A manual entry is Ellis's own, so it's approved on the way in. AI-proposed
  // rows (later phases) will land as "suggested" and wait for approval.
  await commandDb.brandMemory.create({
    data: { body, kind, claimClass, status: "approved", source: "manual" },
  });

  revalidate();
  return { ok: true };
}

export async function editMemoryAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();

  const id = formData.get("id") as string;
  const body = ((formData.get("body") as string) ?? "").trim();
  const kind = (formData.get("kind") as string) ?? "";
  const claimClass = (formData.get("claimClass") as string) ?? "";
  if (!id || !body || !KIND_IDS.has(kind as never) || !CLAIM_IDS.has(claimClass as never)) return { ok: false };

  await commandDb.brandMemory.update({ where: { id }, data: { body, kind, claimClass } });
  revalidate();
  return { ok: true };
}

export async function setMemoryStatusAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();

  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  if (!id || !MEMORY_STATUSES.includes(status as never)) return { ok: false };

  await commandDb.brandMemory.update({ where: { id }, data: { status } });
  revalidate();
  return { ok: true };
}

export async function deleteMemoryAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();

  const id = formData.get("id") as string;
  if (!id) return { ok: false };

  await commandDb.brandMemory.delete({ where: { id } }).catch(() => {});
  revalidate();
  return { ok: true };
}
