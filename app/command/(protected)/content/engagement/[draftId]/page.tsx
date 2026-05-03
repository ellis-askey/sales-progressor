import { notFound } from "next/navigation";
import Link from "next/link";
import { commandDb } from "@/lib/command/prisma";
import { logEngagementAction } from "@/app/actions/content-engagement";
import { CHANNELS } from "@/lib/command/content/channels";

const CHANNEL_METRICS: Record<string, string[]> = {
  linkedin: ["Impressions", "Likes", "Comments", "Shares", "Clicks"],
  twitter: ["Impressions", "Likes", "Replies", "Reposts", "Clicks"],
  tiktok_script: ["Views", "Likes", "Comments", "Shares"],
  instagram_caption: ["Impressions", "Likes", "Comments", "Shares", "Saves"],
  instagram_reel_script: ["Views", "Likes", "Comments", "Shares", "Saves"],
};

export default async function EngagementPage({
  params,
}: {
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = await params;

  const [draft, existing] = await Promise.all([
    commandDb.draftPost.findUnique({ where: { id: draftId } }),
    commandDb.contentEngagement.findUnique({ where: { draftPostId: draftId } }),
  ]);

  if (!draft || !draft.posted) notFound();

  const channelLabel = CHANNELS.find((c) => c.id === draft.channel)?.label ?? draft.channel;
  const displayText = draft.editedText ?? draft.variant1;
  const preview = displayText.slice(0, 200) + (displayText.length > 200 ? "…" : "");
  const postedDate = draft.postedAt
    ? new Date(draft.postedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "unknown date";

  const metricNames = CHANNEL_METRICS[draft.channel] ?? ["Impressions", "Likes", "Comments", "Shares"];

  // Map metric names to form field names
  function fieldFor(metric: string): string {
    const m = metric.toLowerCase();
    if (m === "likes") return "likes";
    if (m === "comments" || m === "replies") return "comments";
    if (m === "shares" || m === "reposts") return "shares";
    if (m === "impressions" || m === "views") return "impressions";
    if (m === "clicks" || m === "saves") return "clicks";
    return "likes";
  }

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <Link
          href="/command/content"
          className="text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors"
        >
          ← Back to content
        </Link>
        <h1 className="text-2xl font-semibold text-neutral-100 mt-3">Log engagement</h1>
        <p className="text-xs text-neutral-500 mt-1">
          {channelLabel} · posted {postedDate}
        </p>
      </div>

      {/* Post preview */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
        <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-2">
          Post content
        </p>
        <p className="text-sm text-neutral-400 leading-relaxed">{preview}</p>
      </div>

      {existing && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3">
          <p className="text-xs text-neutral-500">
            Engagement already logged on{" "}
            {new Date(existing.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            })}
            . Submit below to update.
          </p>
        </div>
      )}

      {/* Engagement form */}
      <form action={logEngagementAction} className="space-y-5">
        <input type="hidden" name="draftPostId" value={draftId} />

        <div>
          <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-3">
            Metrics
          </p>
          <div className="grid grid-cols-2 gap-3">
            {metricNames.map((metric) => {
              const field = fieldFor(metric);
              const defaultVal =
                field === "likes"
                  ? existing?.likes
                  : field === "comments"
                  ? existing?.comments
                  : field === "shares"
                  ? existing?.shares
                  : field === "impressions"
                  ? existing?.impressions
                  : field === "clicks"
                  ? existing?.clicks
                  : undefined;

              return (
                <div key={metric}>
                  <label className="block text-xs text-neutral-500 mb-1">{metric}</label>
                  <input
                    type="number"
                    name={field}
                    min="0"
                    defaultValue={defaultVal ?? ""}
                    placeholder="0"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600 tabular-nums"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs text-neutral-500 mb-1">Notes (optional)</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={existing?.notes ?? ""}
            placeholder="e.g. boosted post, reshared by a partner, unusual topic…"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
          />
        </div>

        <button
          type="submit"
          className="text-sm px-5 py-2 bg-neutral-200 text-neutral-900 rounded-lg font-medium hover:bg-white transition-colors"
        >
          {existing ? "Update engagement" : "Save engagement"}
        </button>
      </form>
    </div>
  );
}
