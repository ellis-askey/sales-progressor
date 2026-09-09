import { Prisma } from "@prisma/client";
import { commandDb } from "@/lib/command/prisma";
import { getBrandProfile, getBrandMemory } from "@/lib/command/content/brand";
import { gatherCandidates } from "@/lib/command/content/inbox-sources";
import { buildEnrichmentSystemPrompt, enrichCandidate, type Angle } from "@/lib/command/content/inbox-enrich";

// Content inbox read service + builder (docs/active/content-brand/SPEC.md,
// Phase 1.3). Superadmin gating lives in the callers.

export type InboxItem = {
  id: string;
  createdAt: Date;
  sourceType: string;
  observation: string;
  whyInteresting: string;
  brandFit: string | null;
  reachReason: string | null;
  claimClass: string;
  likelyAudience: string[];
  suggestedAngles: Angle[];
  evidence: Record<string, unknown> | null;
  freshnessAt: Date;
  status: string;
};

function shape(row: {
  id: string; createdAt: Date; sourceType: string; observation: string; whyInteresting: string;
  brandFit: string | null; reachReason: string | null; claimClass: string;
  likelyAudience: unknown; suggestedAngles: unknown; evidence: unknown; freshnessAt: Date; status: string;
}): InboxItem {
  return {
    id: row.id,
    createdAt: row.createdAt,
    sourceType: row.sourceType,
    observation: row.observation,
    whyInteresting: row.whyInteresting,
    brandFit: row.brandFit,
    reachReason: row.reachReason,
    claimClass: row.claimClass,
    likelyAudience: Array.isArray(row.likelyAudience) ? (row.likelyAudience as string[]) : [],
    suggestedAngles: Array.isArray(row.suggestedAngles) ? (row.suggestedAngles as Angle[]) : [],
    evidence: row.evidence && typeof row.evidence === "object" ? (row.evidence as Record<string, unknown>) : null,
    freshnessAt: row.freshnessAt,
    status: row.status,
  };
}

// The active inbox (new + saved), freshest first, plus counts for the tabs.
export async function getInboxBoard(): Promise<{
  fresh: InboxItem[];
  saved: InboxItem[];
  counts: { fresh: number; saved: number };
}> {
  const [fresh, saved] = await Promise.all([
    commandDb.contentInboxItem.findMany({ where: { status: "new" }, orderBy: { freshnessAt: "desc" }, take: 100 }),
    commandDb.contentInboxItem.findMany({ where: { status: "saved" }, orderBy: { freshnessAt: "desc" }, take: 100 }),
  ]);
  return { fresh: fresh.map(shape), saved: saved.map(shape), counts: { fresh: fresh.length, saved: saved.length } };
}

// How many candidates we AI-enrich per refresh. Kept modest so a refresh is
// cheap and quick; the rest surface on the next run. Never silently drops work —
// refreshInbox reports what was left for next time.
const ENRICH_PER_RUN = 8;

export type RefreshResult = { added: number; skippedExisting: number; deferred: number };

export async function refreshInbox(now: Date): Promise<RefreshResult> {
  const candidates = await gatherCandidates(now);
  if (candidates.length === 0) return { added: 0, skippedExisting: 0, deferred: 0 };

  // Dedupe against everything we've ever seen (including dismissed items) so a
  // rejected idea never comes back.
  const keys = candidates.map((c) => c.dedupeKey);
  const existing = await commandDb.contentInboxItem.findMany({ where: { dedupeKey: { in: keys } }, select: { dedupeKey: true } });
  const seen = new Set(existing.map((e) => e.dedupeKey));
  const fresh = candidates.filter((c) => !seen.has(c.dedupeKey));
  if (fresh.length === 0) return { added: 0, skippedExisting: candidates.length, deferred: 0 };

  const toEnrich = fresh.slice(0, ENRICH_PER_RUN);
  const deferred = fresh.length - toEnrich.length;

  const [profile, memory] = await Promise.all([getBrandProfile(), getBrandMemory()]);
  const systemPrompt = buildEnrichmentSystemPrompt(profile, memory);

  let added = 0;
  for (const c of toEnrich) {
    const e = await enrichCandidate(c, systemPrompt);
    // A create can still race another refresh on the unique dedupeKey; swallow
    // the conflict rather than fail the whole run.
    try {
      await commandDb.contentInboxItem.create({
        data: {
          sourceType: c.sourceType,
          dedupeKey: c.dedupeKey,
          observation: c.observation,
          whyInteresting: e.whyInteresting,
          brandFit: e.brandFit,
          reachReason: e.reachReason,
          claimClass: e.claimClass,
          likelyAudience: e.likelyAudience,
          suggestedAngles: e.suggestedAngles as unknown as Prisma.InputJsonValue,
          evidence: c.evidence ? (c.evidence as Prisma.InputJsonValue) : undefined,
          freshnessAt: c.freshnessAt,
          sourceSignalId: c.sourceSignalId,
          sourceThoughtId: c.sourceThoughtId,
        },
      });
      added++;
    } catch {
      // duplicate dedupeKey — already added by a concurrent run
    }
  }

  return { added, skippedExisting: candidates.length - fresh.length, deferred };
}
