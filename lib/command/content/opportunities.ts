import { Prisma } from "@prisma/client";
import { commandDb } from "@/lib/command/prisma";
import { callClaude } from "@/lib/anthropic";
import { getBrandProfile, getBrandMemory } from "@/lib/command/content/brand";
import {
  buildOpportunitiesSystemPrompt,
  buildOpportunitiesUserMessage,
  parseOpportunities,
} from "@/lib/command/content/prompts/opportunities-prompt";

// Brand-opportunities read service + builder (docs/active/content-brand/SPEC.md,
// Phase 2.1). Superadmin gating lives in the callers. Kind labels live in the
// client-safe opportunity-kinds.ts.

export type OpportunityItem = {
  id: string;
  createdAt: Date;
  kind: string;
  title: string;
  rationale: string;
  suggestedAction: string;
  audience: string[];
  effort: string | null;
  horizon: string | null;
  brandFit: string | null;
  claimClass: string;
  status: string;
};

function shape(row: {
  id: string; createdAt: Date; kind: string; title: string; rationale: string; suggestedAction: string;
  audience: unknown; effort: string | null; horizon: string | null; brandFit: string | null; claimClass: string; status: string;
}): OpportunityItem {
  return {
    id: row.id,
    createdAt: row.createdAt,
    kind: row.kind,
    title: row.title,
    rationale: row.rationale,
    suggestedAction: row.suggestedAction,
    audience: Array.isArray(row.audience) ? (row.audience as string[]) : [],
    effort: row.effort,
    horizon: row.horizon,
    brandFit: row.brandFit,
    claimClass: row.claimClass,
    status: row.status,
  };
}

export async function getOpportunitiesBoard(): Promise<{
  open: OpportunityItem[];
  pursuing: OpportunityItem[];
  counts: { open: number; pursuing: number };
}> {
  const [open, pursuing] = await Promise.all([
    commandDb.brandOpportunity.findMany({ where: { status: "new" }, orderBy: { createdAt: "desc" }, take: 60 }),
    commandDb.brandOpportunity.findMany({ where: { status: "pursuing" }, orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  return { open: open.map(shape), pursuing: pursuing.map(shape), counts: { open: open.length, pursuing: pursuing.length } };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export type OpportunityRefreshResult = { added: number; skippedExisting: number };

export async function refreshOpportunities(): Promise<OpportunityRefreshResult> {
  const [profile, memory, recentDrafts, thoughts] = await Promise.all([
    getBrandProfile(),
    getBrandMemory(),
    commandDb.draftPost.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { topicSeed: true } }),
    commandDb.ellisThought.findMany({ where: { status: "open" }, orderBy: { createdAt: "desc" }, take: 15, select: { body: true } }),
  ]);

  const systemPrompt = buildOpportunitiesSystemPrompt(profile, memory);
  const userMessage = buildOpportunitiesUserMessage(
    recentDrafts.map((d) => d.topicSeed).filter(Boolean),
    thoughts.map((t) => t.body),
  );

  let raw: string;
  try {
    raw = await callClaude(systemPrompt, userMessage, 1500);
  } catch {
    return { added: 0, skippedExisting: 0 };
  }

  const parsed = parseOpportunities(raw);
  if (parsed.length === 0) return { added: 0, skippedExisting: 0 };

  const withKeys = parsed.map((p) => ({ p, dedupeKey: `opp:${p.kind}:${slug(p.title)}` }));
  const existing = await commandDb.brandOpportunity.findMany({
    where: { dedupeKey: { in: withKeys.map((w) => w.dedupeKey) } },
    select: { dedupeKey: true },
  });
  const seen = new Set(existing.map((e) => e.dedupeKey));

  let added = 0;
  let skippedExisting = 0;
  for (const { p, dedupeKey } of withKeys) {
    if (seen.has(dedupeKey)) { skippedExisting++; continue; }
    try {
      await commandDb.brandOpportunity.create({
        data: {
          kind: p.kind,
          title: p.title,
          rationale: p.rationale,
          suggestedAction: p.suggestedAction,
          audience: p.audience as unknown as Prisma.InputJsonValue,
          effort: p.effort,
          horizon: p.horizon,
          brandFit: p.brandFit,
          claimClass: p.claimClass,
          dedupeKey,
        },
      });
      added++;
    } catch {
      skippedExisting++; // unique dedupeKey race
    }
  }

  return { added, skippedExisting };
}
