import { commandDb } from "@/lib/command/prisma";

// Content overview figures (docs/active/content-brand/SPEC.md, Phase 1.5). Every
// number here is real. Scheduling/publishing figures are deliberately absent
// until that integration exists (the Overview shows an honest "not set up yet"
// state instead of a fake zero). Superadmin gating lives in the caller.

export type Opportunity = { id: string; observation: string; whyInteresting: string };

export type ContentOverview = {
  inbox: { fresh: number; saved: number };
  thoughtsOpen: number;
  published: { thisWeek: number; last28: number };
  readyToSend: number;
  lastPostedAt: Date | null;
  opportunities: Opportunity[];
};

export async function getContentOverview(now: Date): Promise<ContentOverview> {
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const fourWeeksAgo = new Date(now.getTime() - 28 * 86_400_000);

  const [inboxFresh, inboxSaved, thoughtsOpen, publishedThisWeek, publishedLast28, readyToSend, lastPosted, opportunities] =
    await Promise.all([
      commandDb.contentInboxItem.count({ where: { status: "new" } }),
      commandDb.contentInboxItem.count({ where: { status: "saved" } }),
      commandDb.ellisThought.count({ where: { status: "open" } }),
      commandDb.draftPost.count({ where: { posted: true, postedAt: { gte: weekAgo } } }),
      commandDb.draftPost.count({ where: { posted: true, postedAt: { gte: fourWeeksAgo } } }),
      commandDb.draftPost.count({ where: { approvedForBatch: true, posted: false } }),
      commandDb.draftPost.findFirst({ where: { posted: true }, orderBy: { postedAt: "desc" }, select: { postedAt: true } }),
      commandDb.contentInboxItem.findMany({
        where: { status: "new" },
        orderBy: { freshnessAt: "desc" },
        take: 3,
        select: { id: true, observation: true, whyInteresting: true },
      }),
    ]);

  return {
    inbox: { fresh: inboxFresh, saved: inboxSaved },
    thoughtsOpen,
    published: { thisWeek: publishedThisWeek, last28: publishedLast28 },
    readyToSend,
    lastPostedAt: lastPosted?.postedAt ?? null,
    opportunities,
  };
}
