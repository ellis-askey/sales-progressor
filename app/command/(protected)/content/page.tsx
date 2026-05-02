import Link from "next/link";
import { commandDb } from "@/lib/command/prisma";
import { CHANNELS } from "@/lib/command/content/channels";
import { TONES } from "@/lib/command/content/tones";
import { DraftComposer } from "@/components/command/content/DraftComposer";
import { DraftHistory } from "@/components/command/content/DraftHistory";
import { VoiceIntakePanel } from "@/components/command/content/VoiceIntakePanel";

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  const [qaSampleCount, recentDrafts] = await Promise.all([
    commandDb.voiceSample.count({ where: { sampleType: "qa_response" } }),
    commandDb.draftPost.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

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
        <Link
          href="/command/content/voice"
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Manage voice samples →
        </Link>
      </div>

      <DraftComposer channels={CHANNELS} tones={TONES} />

      <DraftHistory drafts={recentDrafts} />
    </div>
  );
}
