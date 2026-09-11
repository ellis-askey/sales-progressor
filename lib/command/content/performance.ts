import { commandDb } from "@/lib/command/prisma";
import { PILLARS, pillarLabel } from "@/lib/command/content/pillars";

// Content performance (docs/active/content-brand/SPEC.md, Phase 6.2). Real
// numbers only, from logged ContentEngagement. Attribution to website behaviour
// is gated on PostHog + posting actually happening, so the page shows honest
// empty states until data exists. Superadmin gating lives in the caller.

export type PostPerf = {
  id: string;
  channel: string;
  pillar: string | null;
  text: string;
  postedAt: string | null;
  engagement: { likes: number; comments: number; shares: number; impressions: number | null; clicks: number | null; total: number } | null;
};

export type PillarPerf = { pillar: string; label: string; posts: number; engagement: number };

export type Performance = {
  posts: PostPerf[];
  totals: { published: number; withEngagement: number; totalEngagement: number };
  byPillar: PillarPerf[];
};

function textOf(d: { editedText: string | null; variant1: string; variant2: string; chosenVariant: number | null }): string {
  return (d.editedText || (d.chosenVariant === 2 ? d.variant2 : d.variant1) || "").trim();
}

export async function getPerformance(): Promise<Performance> {
  const [published, engagementRows] = await Promise.all([
    commandDb.draftPost.findMany({
      where: { posted: true },
      orderBy: { postedAt: "desc" },
      take: 50,
      select: { id: true, channel: true, pillar: true, editedText: true, variant1: true, variant2: true, chosenVariant: true, postedAt: true },
    }),
    commandDb.contentEngagement.findMany({
      select: { draftPostId: true, likes: true, comments: true, shares: true, impressions: true, clicks: true },
    }),
  ]);

  const engByDraft = new Map(engagementRows.map((e) => [e.draftPostId, e]));

  const posts: PostPerf[] = published.map((d) => {
    const e = engByDraft.get(d.id);
    return {
      id: d.id,
      channel: d.channel,
      pillar: d.pillar,
      text: textOf(d).slice(0, 200),
      postedAt: d.postedAt ? d.postedAt.toISOString() : null,
      engagement: e ? { likes: e.likes, comments: e.comments, shares: e.shares, impressions: e.impressions, clicks: e.clicks, total: e.likes + e.comments + e.shares } : null,
    };
  });

  const withEngagement = posts.filter((p) => p.engagement).length;
  const totalEngagement = posts.reduce((sum, p) => sum + (p.engagement?.total ?? 0), 0);

  // Per-pillar: posts + engagement, only for pillars that appear.
  const byPillarMap = new Map<string, { posts: number; engagement: number }>();
  for (const p of posts) {
    if (!p.pillar) continue;
    const cur = byPillarMap.get(p.pillar) ?? { posts: 0, engagement: 0 };
    cur.posts += 1;
    cur.engagement += p.engagement?.total ?? 0;
    byPillarMap.set(p.pillar, cur);
  }
  const byPillar: PillarPerf[] = PILLARS.filter((pl) => byPillarMap.has(pl.id))
    .map((pl) => ({ pillar: pl.id, label: pillarLabel(pl.id), ...byPillarMap.get(pl.id)! }))
    .sort((a, b) => b.engagement - a.engagement);

  return {
    posts,
    totals: { published: published.length, withEngagement, totalEngagement },
    byPillar,
  };
}
