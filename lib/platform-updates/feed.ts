import { prisma } from "@/lib/prisma";
import type { PlatformUpdateAudience, PlatformUpdateCategory } from "@prisma/client";
import { getPlatformUpdateSignedUrl } from "@/lib/platform-updates/storage";

// Agent-app read-path for Platform Updates (Phase 2). ALL visibility is enforced
// here, server-side: a viewer only ever sees PUBLISHED updates whose audience
// includes them. Hidden/draft rows and other audiences are filtered in the
// query — they are never fetched, so their copy and (private, signed) images are
// never exposed. Client portals and Boardwalk don't use this at all (separate
// surfaces), so "everyone" means every AGENT-APP user, never a buyer/seller.

export type ViewerAudience = "agency_staff" | "progression_business" | "tsp_internal";

export type ViewerContext = {
  // External progression-business member (progressor). Checked FIRST: a
  // sales_progressor attached to a business is a progressor, not TSP-internal.
  isBusinessMember: boolean;
  // TSP's own staff (admin / sales_progressor / superadmin / viewer).
  isInternalStaff: boolean;
};

// A viewer's single audience bucket.
export function viewerAudienceBucket(ctx: ViewerContext): ViewerAudience {
  if (ctx.isBusinessMember) return "progression_business";
  if (ctx.isInternalStaff) return "tsp_internal";
  return "agency_staff";
}

// Which audiences this viewer may see: the all-app-users catch-all plus their
// own bucket. "everyone" deliberately excludes portal clients because this feed
// is agent-app-only.
export function visibleAudiencesFor(ctx: ViewerContext): PlatformUpdateAudience[] {
  return ["everyone", viewerAudienceBucket(ctx)];
}

export type WhatsNewNavState = { visible: boolean; unread: boolean };

// Cheap nav-state query for the sidebar: the newest published update this viewer
// may see. `visible` drives whether the nav item + page exist at all; `unread`
// drives the dot. Both are false when there are zero relevant published updates,
// so the whole feature stays invisible until the founder publishes one. Drafts /
// other audiences can never flip either flag (filtered in the where).
export async function getWhatsNewNavState(
  ctx: ViewerContext,
  seenAt: string | null,
): Promise<WhatsNewNavState> {
  const latest = await prisma.platformUpdate.findFirst({
    where: { status: "published", audience: { in: visibleAudiencesFor(ctx) } },
    orderBy: { publishedAt: "desc" },
    select: { publishedAt: true },
  });
  if (!latest?.publishedAt) return { visible: false, unread: false };
  const unread = !seenAt || latest.publishedAt.getTime() > new Date(seenAt).getTime();
  return { visible: true, unread };
}

export type FeedUpdate = {
  id: string;
  title: string;
  body: string;
  category: PlatformUpdateCategory;
  publishedAt: string;
  linkUrl: string | null;
  imageUrl: string | null;
};

// The full feed for the What's New page: published + viewer-visible, newest
// first, with short-lived signed image URLs (private bucket). Only ever returns
// the viewer's own audiences.
export async function getVisibleUpdates(ctx: ViewerContext): Promise<FeedUpdate[]> {
  const rows = await prisma.platformUpdate.findMany({
    where: { status: "published", audience: { in: visibleAudiencesFor(ctx) } },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      body: true,
      category: true,
      publishedAt: true,
      createdAt: true,
      linkUrl: true,
      screenshotPath: true,
    },
  });
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      category: r.category,
      publishedAt: (r.publishedAt ?? r.createdAt).toISOString(),
      linkUrl: r.linkUrl,
      imageUrl: r.screenshotPath ? await getPlatformUpdateSignedUrl(r.screenshotPath) : null,
    })),
  );
}
