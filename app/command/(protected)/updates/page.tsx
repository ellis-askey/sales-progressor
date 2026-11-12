import { commandDb } from "@/lib/command/prisma";
import { getPlatformUpdateSignedUrl } from "@/lib/command/platform-update-storage";
import { PlatformUpdatesManager, type ManagedUpdate } from "@/components/command/platform-updates/PlatformUpdatesManager";

// Founder Platform Updates management (Phase 1). Every entry, newest-first, with
// create / edit / publish / hide / delete. Superadmin gating is handled by
// app/command/(protected)/layout.tsx; the actions re-assert it. Nothing here is
// reachable by ordinary agents — the agent-facing "What's new" page is Phase 2.

export const dynamic = "force-dynamic";

export default async function PlatformUpdatesPage() {
  const updates = await commandDb.platformUpdate.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Platform updates</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-neutral-500">
          Your private “What’s new” feed. Write an entry, choose who it’s for, then publish when it’s ready. Every entry
          starts <span className="text-neutral-300">Hidden</span> and nothing reaches users until you publish it. Agents
          won’t see the feature at all until at least one update is published (that lands in the next phase).
        </p>
        <p className="mt-2 text-[12px] text-neutral-600">
          {rows.length} total · <span className="text-emerald-400">{publishedCount} published</span> ·{" "}
          {rows.length - publishedCount} hidden
        </p>
      </div>

      <PlatformUpdatesManager updates={rows} />
    </div>
  );
}
