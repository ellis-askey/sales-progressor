import { commandDb } from "@/lib/command/prisma";
import { getPlatformUpdateSignedUrl } from "@/lib/platform-updates/storage";
import { PlatformUpdatesManager, type ManagedUpdate } from "@/components/command/platform-updates/PlatformUpdatesManager";

// System workspace → Updates tab ("Platform updates"). Verbatim from
// /command/updates (consolidation): the founder "What's new" feed with create /
// edit / publish / hide / delete. The PlatformUpdatesManager + its actions are
// unchanged; nothing reaches users until published. Loaders (incl. signed image
// URLs) identical. The former page <h1> is dropped (shell + tab strip label it).

export async function PlatformUpdatesView() {
  const updates = await commandDb.platformUpdate.findMany({
    // Dismissed auto-drafts drop out of the review list (kept in the DB for the
    // dedup trail, never regenerated).
    where: { dismissedAt: null },
    // Newest first, so freshly auto-drafted entries awaiting review sit at the top.
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const rows: ManagedUpdate[] = await Promise.all(
    updates.map(async (u) => ({
      id: u.id,
      title: u.title,
      body: u.body,
      category: u.category,
      status: u.status,
      audience: u.audience,
      origin: u.origin,
      sourceReleaseSha: u.sourceReleaseSha,
      publishedAt: u.publishedAt ? u.publishedAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
      linkUrl: u.linkUrl,
      technicalSummary: u.technicalSummary,
      hasImage: !!u.screenshotPath,
      // Signed, short-lived URL — the private image is never exposed publicly.
      screenshotUrl: u.screenshotPath ? await getPlatformUpdateSignedUrl(u.screenshotPath) : null,
    })),
  );

  const publishedCount = rows.filter((r) => r.status === "published").length;
  const awaitingReview = rows.filter((r) => r.origin === "auto" && r.status === "draft").length;

  return (
    <div className="space-y-6">
      <div>
        <p className="max-w-2xl text-[13px] text-neutral-500">
          Your private &ldquo;What&rsquo;s new&rdquo; feed. Write an entry, choose who it&rsquo;s for, then publish when it&rsquo;s ready. Every entry
          starts <span className="text-neutral-300">Hidden</span> and nothing reaches users until you publish it. Agents
          won&rsquo;t see the feature at all until at least one update is published (that lands in the next phase).
        </p>
        <p className="mt-2 text-[12px] text-neutral-600">
          {rows.length} total · <span className="text-emerald-400">{publishedCount} published</span> ·{" "}
          {rows.length - publishedCount} hidden
        </p>
      </div>

      {awaitingReview > 0 && (
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-[13px] text-violet-200">
          <span className="font-semibold">{awaitingReview}</span> auto-drafted{" "}
          {awaitingReview === 1 ? "update" : "updates"} from recent releases awaiting your review. Edit and publish the
          worthwhile ones, or dismiss the rest. Nothing is visible to users until you publish it.
        </div>
      )}

      <PlatformUpdatesManager updates={rows} />
    </div>
  );
}
