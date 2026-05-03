import { removeFromBatchAction } from "@/app/actions/draft-posts";

interface BatchItem {
  id: string;
  channel: string;
  topicSeed: string;
  editedText: string | null;
  variant1: string;
  chosenVariant: number | null;
  createdAt: Date;
}

interface Props {
  items: BatchItem[];
}

const CHANNEL_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
  tiktok_script: "TikTok",
  instagram_caption: "Instagram",
  instagram_reel_script: "Reel script",
};

export function BatchQueue({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="border border-orange-900/40 bg-orange-950/20 rounded-xl px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider">
          Today&apos;s batch — {items.length} post{items.length !== 1 ? "s" : ""} queued
        </p>
        <p className="text-[11px] text-neutral-600">
          Email digest sends at 06:30 UTC
        </p>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const displayText =
            item.editedText ||
            (item.chosenVariant === 2 ? item.variant1 : item.variant1);
          const preview = displayText.slice(0, 160) + (displayText.length > 160 ? "…" : "");
          return (
            <div
              key={item.id}
              className="flex items-start gap-3 bg-neutral-900/60 rounded-lg px-4 py-3"
            >
              <span className="text-[10px] font-medium text-orange-400 border border-orange-900/50 rounded px-1.5 py-0.5 mt-0.5 shrink-0">
                {CHANNEL_LABELS[item.channel] ?? item.channel}
              </span>
              <p className="text-xs text-neutral-400 flex-1 leading-relaxed line-clamp-3">
                {preview}
              </p>
              <form action={removeFromBatchAction}>
                <input type="hidden" name="draftId" value={item.id} />
                <button
                  type="submit"
                  className="text-[11px] text-neutral-700 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                >
                  Remove
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
