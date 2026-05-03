import Link from "next/link";
import type { DraftPost } from "@prisma/client";
import { CHANNELS } from "@/lib/command/content/channels";
import { TONES } from "@/lib/command/content/tones";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

interface Props {
  drafts: DraftPost[];
  engagedDraftIds: Set<string>;
}

export function DraftHistory({ drafts, engagedDraftIds }: Props) {
  if (drafts.length === 0) return null;

  const now = Date.now();

  return (
    <section className="space-y-4 max-w-2xl pt-4 border-t border-neutral-800">
      <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
        Draft history
      </h2>

      <div className="space-y-3">
        {drafts.map((d) => {
          const channelLabel =
            CHANNELS.find((c) => c.id === d.channel)?.label ?? d.channel;
          const toneLabel = TONES.find((t) => t.id === d.tone)?.label ?? d.tone ?? "—";
          const displayText = d.editedText ?? d.variant1;
          const preview = displayText.slice(0, 120) + (displayText.length > 120 ? "…" : "");

          const isOldEnough =
            d.posted &&
            d.postedAt &&
            now - new Date(d.postedAt).getTime() >= FOURTEEN_DAYS_MS;
          const needsEngagement = isOldEnough && !engagedDraftIds.has(d.id);
          const hasEngagement = d.posted && engagedDraftIds.has(d.id);

          return (
            <div
              key={d.id}
              className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-semibold bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded">
                  {channelLabel}
                </span>
                <span className="text-[10px] font-semibold bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded">
                  {toneLabel}
                </span>
                {d.posted && (
                  <span className="text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-900 px-1.5 py-0.5 rounded">
                    posted
                  </span>
                )}
                {hasEngagement && (
                  <span className="text-[10px] font-semibold bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded">
                    engagement ✓
                  </span>
                )}
                {d.regenerationCount > 0 && (
                  <span className="text-[10px] text-neutral-600">
                    {d.regenerationCount}× regenerated
                  </span>
                )}
                <span className="text-[10px] text-neutral-700 ml-auto">
                  {new Date(d.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 leading-relaxed mb-1 line-clamp-1">
                Topic: {d.topicSeed}
              </p>
              <p className="text-xs text-neutral-400 leading-relaxed line-clamp-3">{preview}</p>

              {needsEngagement && (
                <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center justify-between">
                  <p className="text-[11px] text-neutral-600">
                    14 days since posting — how did it perform?
                  </p>
                  <Link
                    href={`/command/content/engagement/${d.id}`}
                    className="text-[11px] text-orange-400 hover:text-orange-300 transition-colors font-medium"
                  >
                    Log engagement →
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
