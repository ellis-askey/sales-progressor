import Link from "next/link";
import { commandDb } from "@/lib/command/prisma";
import { CHANNELS } from "@/lib/command/content/channels";
import { TONES } from "@/lib/command/content/tones";
import { DraftComposer } from "@/components/command/content/DraftComposer";
import { DraftHistory } from "@/components/command/content/DraftHistory";
import { VoiceIntakePanel } from "@/components/command/content/VoiceIntakePanel";
import { ImageGenerator } from "@/components/command/content/ImageGenerator";
import { BatchQueue } from "@/components/command/content/BatchQueue";

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  const [qaSampleCount, recentDrafts, pendingTopics, batchItems, engagementRecords] = await Promise.all([
    commandDb.voiceSample.count({ where: { sampleType: "qa_response" } }),
    commandDb.draftPost.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    commandDb.contentTopic.findMany({
      where: { status: "pending" },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
    commandDb.draftPost.findMany({
      where: { approvedForBatch: true, posted: false },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        channel: true,
        topicSeed: true,
        editedText: true,
        variant1: true,
        chosenVariant: true,
        createdAt: true,
      },
    }),
    commandDb.contentEngagement.findMany({
      select: { draftPostId: true },
    }),
  ]);

  const engagedDraftIds = new Set(engagementRecords.map((e) => e.draftPostId));

  if (qaSampleCount === 0) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold text-neutral-100">Content</h1>
        <VoiceIntakePanel error={sp.error} />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-100">Content</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/command/content/topics"
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Topic queue →
          </Link>
          <Link
            href="/command/content/voice"
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Voice samples →
          </Link>
        </div>
      </div>

      <BatchQueue items={batchItems} />

      <DraftComposer channels={CHANNELS} tones={TONES} pendingTopics={pendingTopics} />

      <DraftHistory drafts={recentDrafts} engagedDraftIds={engagedDraftIds} />

      <div className="border-t border-neutral-800 pt-10 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-neutral-200">Images</h2>
          <p className="text-xs text-neutral-600 mt-1">
            Branded cards for social posts — text cards, live chart snapshots, or AI-generated photography.
          </p>
        </div>
        <ImageGenerator />
      </div>
    </div>
  );
}
