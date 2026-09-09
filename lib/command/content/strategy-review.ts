import { Prisma } from "@prisma/client";
import { commandDb } from "@/lib/command/prisma";
import { callClaude } from "@/lib/anthropic";
import { getBrandProfile, getBrandMemory } from "@/lib/command/content/brand";
import { getBalance } from "@/lib/command/content/balance";
import {
  buildBrandReviewSystemPrompt,
  buildBrandReviewUserMessage,
  parseBrandReview,
} from "@/lib/command/content/prompts/brand-review-prompt";

// Rolling brand review (docs/active/content-brand/SPEC.md, Phase 2.3). Read
// service + AI builder. Superadmin gating lives in the callers.

export type BrandReviewData = {
  id: string;
  createdAt: Date;
  summary: string;
  leanInto: string[];
  overused: string[];
  breakout: string[];
  underusedExpertise: string[];
};

function shape(row: {
  id: string; createdAt: Date; summary: string;
  leanInto: unknown; overused: unknown; breakout: unknown; underusedExpertise: unknown;
}): BrandReviewData {
  const list = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
  return {
    id: row.id,
    createdAt: row.createdAt,
    summary: row.summary,
    leanInto: list(row.leanInto),
    overused: list(row.overused),
    breakout: list(row.breakout),
    underusedExpertise: list(row.underusedExpertise),
  };
}

export async function getLatestReview(): Promise<BrandReviewData | null> {
  const row = await commandDb.brandReview.findFirst({ orderBy: { createdAt: "desc" } });
  return row ? shape(row) : null;
}

function balanceSummary(window: Array<{ label: string; count: number }>, enough: boolean, considered: number): string {
  if (!enough) return `Not enough published posts yet to read balance (${considered} so far).`;
  const active = window.filter((s) => s.count > 0).map((s) => `${s.label}: ${s.count}`);
  return active.length ? `Last ${considered} posts: ${active.join(", ")}.` : `Last ${considered} posts, no pillar data.`;
}

export async function refreshBrandReview(): Promise<BrandReviewData | null> {
  const [profile, memory, recentDrafts, thoughts, balance] = await Promise.all([
    getBrandProfile(),
    getBrandMemory(),
    commandDb.draftPost.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { topicSeed: true, pillar: true } }),
    commandDb.ellisThought.findMany({ where: { status: "open" }, orderBy: { createdAt: "desc" }, take: 15, select: { body: true } }),
    getBalance(),
  ]);

  const systemPrompt = buildBrandReviewSystemPrompt(profile, memory);
  const userMessage = buildBrandReviewUserMessage(
    recentDrafts.map((d) => ({ topicSeed: d.topicSeed, pillar: d.pillar })),
    balanceSummary(balance.window, balance.enoughData, balance.consideredCount),
    thoughts.map((t) => t.body),
  );

  let raw: string;
  try {
    raw = await callClaude(systemPrompt, userMessage, 1200);
  } catch {
    return null;
  }

  const parsed = parseBrandReview(raw);
  if (!parsed) return null;

  const row = await commandDb.brandReview.create({
    data: {
      summary: parsed.summary,
      leanInto: parsed.leanInto as unknown as Prisma.InputJsonValue,
      overused: parsed.overused as unknown as Prisma.InputJsonValue,
      breakout: parsed.breakout as unknown as Prisma.InputJsonValue,
      underusedExpertise: parsed.underusedExpertise as unknown as Prisma.InputJsonValue,
    },
  });

  return shape(row);
}
