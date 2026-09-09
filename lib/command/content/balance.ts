import { commandDb } from "@/lib/command/prisma";
import { PILLARS } from "@/lib/command/content/pillars";

// Content balance (docs/active/content-brand/SPEC.md, Phase 2.2). Looks at the
// recent published mix across pillars and warns when it's becoming repetitive.
// Optimises for variety of substance, not a rigid weekly calendar. Superadmin
// gating lives in the caller. Every number is real; if there aren't enough
// posts yet it says so rather than inventing a chart.

export type BalanceSlice = { pillarId: string; label: string; count: number };

export type ContentBalance = {
  enoughData: boolean;
  consideredCount: number;
  window: BalanceSlice[]; // every pillar, count in the recent window, most first
  warning: string | null;
  underused: string[]; // pillar labels absent from the recent window
};

// How many recent published posts we weigh for balance.
const WINDOW = 8;
// Below this we don't draw conclusions.
const MIN_FOR_SIGNAL = 3;

export async function getBalance(): Promise<ContentBalance> {
  const recent = await commandDb.draftPost.findMany({
    where: { posted: true, pillar: { not: null } },
    orderBy: { postedAt: "desc" },
    take: WINDOW,
    select: { pillar: true },
  });

  const consideredCount = recent.length;
  const counts = new Map<string, number>();
  for (const r of recent) {
    if (r.pillar) counts.set(r.pillar, (counts.get(r.pillar) ?? 0) + 1);
  }

  const window: BalanceSlice[] = PILLARS.map((p) => ({
    pillarId: p.id,
    label: p.label,
    count: counts.get(p.id) ?? 0,
  })).sort((a, b) => b.count - a.count);

  const enoughData = consideredCount >= MIN_FOR_SIGNAL;

  let warning: string | null = null;
  const underused: string[] = [];

  if (enoughData) {
    const top = window[0];
    const half = Math.ceil(consideredCount / 2);

    // Direct promotion gets its own, sharper nudge.
    const promo = counts.get("direct_promo") ?? 0;
    if (promo >= 2 && promo >= Math.ceil(consideredCount / 3)) {
      warning = `${promo} of your last ${consideredCount} posts were direct promotion. Publish something genuinely useful with no product mention next.`;
    } else if (top.count >= 3 && top.count >= half) {
      warning = `${top.count} of your last ${consideredCount} posts were ${top.label.toLowerCase()}. Something from a different pillar would give the feed more balance.`;
    }

    for (const s of window) {
      if (s.count === 0) underused.push(s.label);
    }
  }

  return { enoughData, consideredCount, window, warning, underused };
}
