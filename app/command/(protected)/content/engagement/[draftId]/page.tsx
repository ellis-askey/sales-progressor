import { notFound } from "next/navigation";
import Link from "next/link";
import { commandDb } from "@/lib/command/prisma";
import { EngagementForm } from "@/components/command/content/EngagementForm";
import { CHANNELS } from "@/lib/command/content/channels";

const CHANNEL_METRIC_LABELS: Record<string, { label: string; name: string }[]> = {
  linkedin: [
    { label: "Impressions", name: "impressions" },
    { label: "Likes / Reactions", name: "likes" },
    { label: "Comments", name: "comments" },
    { label: "Shares / Reposts", name: "shares" },
    { label: "Clicks", name: "clicks" },
  ],
  twitter: [
    { label: "Impressions", name: "impressions" },
    { label: "Likes", name: "likes" },
    { label: "Replies", name: "comments" },
    { label: "Retweets / Reposts", name: "shares" },
    { label: "Link clicks", name: "clicks" },
  ],
  tiktok_script: [
    { label: "Views", name: "impressions" },
    { label: "Likes", name: "likes" },
    { label: "Comments", name: "comments" },
    { label: "Shares", name: "shares" },
  ],
  instagram_caption: [
    { label: "Reach", name: "impressions" },
    { label: "Likes", name: "likes" },
    { label: "Comments", name: "comments" },
    { label: "Shares / Sends", name: "shares" },
    { label: "Saves", name: "clicks" },
  ],
  instagram_reel_script: [
    { label: "Views", name: "impressions" },
    { label: "Likes", name: "likes" },
    { label: "Comments", name: "comments" },
    { label: "Shares", name: "shares" },
    { label: "Saves", name: "clicks" },
  ],
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

  const metricFields =
    CHANNEL_METRIC_LABELS[draft.channel] ?? [
      { label: "Impressions", name: "impressions" },
      { label: "Likes", name: "likes" },
      { label: "Comments", name: "comments" },
      { label: "Shares", name: "shares" },
    ];

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
          {draft.postedUrl && (
            <>
              {" · "}
              <a
                href={draft.postedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-400 hover:text-neutral-200 underline underline-offset-2"
              >
                View post →
              </a>
            </>
          )}
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

      <EngagementForm
        draftPostId={draftId}
        metricFields={metricFields}
        defaults={{
          likes: existing?.likes,
          comments: existing?.comments,
          shares: existing?.shares,
          impressions: existing?.impressions,
          clicks: existing?.clicks,
          notes: existing?.notes,
        }}
        isUpdate={!!existing}
      />
    </div>
  );
}
