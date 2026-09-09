import { commandDb } from "@/lib/command/prisma";

// Read helpers for brand positioning + memory (docs/active/content-brand/
// SPEC.md, Phase 1.2). Superadmin gating lives in the callers.

export type BrandProfile = {
  id: string;
  updatedAt: Date;
  primaryIdentity: string;
  credibility: string;
  personality: string;
  associations: string;
  desiredReputation: string;
  targetAudiences: string[];
  quarterFocus: string;
};

export type MemoryEntry = {
  id: string;
  createdAt: Date;
  kind: string;
  body: string;
  claimClass: string;
  status: string;
  source: string;
};

// The single active positioning row, or null if it hasn't been set yet.
export async function getBrandProfile(): Promise<BrandProfile | null> {
  const row = await commandDb.brandProfile.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!row) return null;
  return {
    id: row.id,
    updatedAt: row.updatedAt,
    primaryIdentity: row.primaryIdentity,
    credibility: row.credibility,
    personality: row.personality,
    associations: row.associations,
    desiredReputation: row.desiredReputation,
    targetAudiences: Array.isArray(row.targetAudiences) ? (row.targetAudiences as string[]) : [],
    quarterFocus: row.quarterFocus,
  };
}

// All non-noise memory, newest first. Rejected rows are kept (soft state) so the
// client can offer a "Rejected" tab, but the caller filters as needed.
export async function getBrandMemory(): Promise<MemoryEntry[]> {
  const rows = await commandDb.brandMemory.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, createdAt: true, kind: true, body: true, claimClass: true, status: true, source: true },
  });
  return rows;
}

// Only approved memory, for the generation prompts (later phases pull this so
// the drafter never leans on an unapproved, possibly-invented row).
export async function getApprovedBrandMemory(): Promise<MemoryEntry[]> {
  return commandDb.brandMemory.findMany({
    where: { status: "approved" },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, createdAt: true, kind: true, body: true, claimClass: true, status: true, source: true },
  });
}
