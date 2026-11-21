import Link from "next/link";
import { commandDb } from "@/lib/command/prisma";
import { ParamTabs } from "@/components/command/ui/primitives";
import { aiEnabled } from "@/lib/ai/enabled";
import { CHANNELS } from "@/lib/command/content/channels";
import { TONES } from "@/lib/command/content/tones";
import { CreateFlow } from "@/components/command/content/CreateFlow";
import { DraftComposer } from "@/components/command/content/DraftComposer";
import { DraftHistory } from "@/components/command/content/DraftHistory";
import { VoiceIntakePanel } from "@/components/command/content/VoiceIntakePanel";
import { ImageGenerator } from "@/components/command/content/ImageGenerator";
import { BatchQueue } from "@/components/command/content/BatchQueue";

// Content workspace → Create tab. Houses the TWO distinct, independent drafting
// systems plus the image studio as three addressable, clearly separated views:
//   • New    — the guided creation flow (CreateFlow → /compose). AI-gated. Seeded
//              by ?item / ?opp / ?thought. (verbatim from /content/create)
//   • Drafts — the batch drafter (BatchQueue + DraftComposer → /generate +
//              DraftHistory). Voice-gated (0 qa samples → VoiceIntakePanel).
//              (verbatim from /content/drafts, minus the Images block)
//   • Images — the standalone image studio (ImageGenerator). (moved out of Drafts
//              into its own view per the consolidation plan)
// Both drafters, their API routes, server actions, AI/voice gates and seed
// behaviour are preserved unchanged — this only relocates them under one tab.
// Only the active view's loaders run (lazy). See
// docs/active/admin-workspace/06-CONTENT-CONSOLIDATION.md.

const BUILD_VIEWS = [
  { key: "new", label: "New" },
  { key: "drafts", label: "Drafts" },
  { key: "images", label: "Images" },
] as const;
type BuildView = (typeof BUILD_VIEWS)[number]["key"];

type PresetAngle = { angle: string; point: string };

function summariseEvidence(evidence: unknown): string | null {
  if (!evidence || typeof evidence !== "object") return null;
  const e = evidence as Record<string, unknown>;
  const figures = e.figures && typeof e.figures === "object" ? (e.figures as Record<string, unknown>) : null;
  const parts: string[] = [];
  if (figures) parts.push(Object.entries(figures).map(([k, v]) => `${k}: ${v}`).join(", "));
  if (typeof e.detector === "string") parts.push(`from the ${e.detector.replace(/_/g, " ")} signal`);
  return parts.length ? parts.join(" · ") : null;
}

export async function CreateTab({
  view,
  seed,
}: {
  view?: string;
  seed: { item?: string; thought?: string; opp?: string; error?: string };
}) {
  const active: BuildView = (BUILD_VIEWS.some((v) => v.key === view) ? view : "new") as BuildView;
  const hrefFor = (v: string) => `/command/content?tab=create&build=${v}`;

  return (
    <div className="space-y-6">
      <ParamTabs options={[...BUILD_VIEWS]} active={active} hrefFor={hrefFor} />
      {active === "new" && <NewView seed={seed} />}
      {active === "drafts" && <DraftsView error={seed.error} />}
      {active === "images" && <ImagesView />}
    </div>
  );
}

// ── New: the guided creation flow (AI-gated, seedable) ───────────────────────
async function NewView({ seed }: { seed: { item?: string; thought?: string; opp?: string } }) {
  // AI master switch (#291): the whole creation flow is AI — show an empty state
  // rather than a dead header when it's off. (verbatim gate)
  if (!(await aiEnabled())) {
    return (
      <div className="space-y-4">
        <p className="max-w-xl text-[13px] text-neutral-500">
          Content creation uses AI, which is currently turned off. Turn it back on from Settings &rarr; AI features.
        </p>
        <Link href="/command/settings" className="inline-block text-xs text-blue-400 transition-colors hover:text-blue-300">
          Open Settings &rarr;
        </Link>
      </div>
    );
  }

  let initialSource = "";
  let presetAngles: PresetAngle[] = [];
  let inboxItemId: string | undefined;
  let claimClass: string | undefined;
  let evidenceSummary: string | null = null;

  if (seed.item) {
    const item = await commandDb.contentInboxItem.findUnique({ where: { id: seed.item } });
    if (item) {
      initialSource = item.observation;
      presetAngles = Array.isArray(item.suggestedAngles) ? (item.suggestedAngles as PresetAngle[]) : [];
      inboxItemId = item.id;
      claimClass = item.claimClass;
      evidenceSummary = summariseEvidence(item.evidence);
    }
  } else if (seed.thought) {
    const th = await commandDb.ellisThought.findUnique({ where: { id: seed.thought } });
    if (th) initialSource = th.body;
  } else if (seed.opp) {
    const opp = await commandDb.brandOpportunity.findUnique({ where: { id: seed.opp } });
    if (opp) {
      initialSource = opp.suggestedAction ? `${opp.title}\n\n${opp.suggestedAction}` : opp.title;
      claimClass = opp.claimClass;
    }
  }

  return (
    <div className="space-y-6">
      <p className="max-w-xl text-[13px] text-neutral-500">
        Decide what you&rsquo;re actually saying before we write a word. Source, then why, then the point, then the
        format. The draft comes last.
      </p>
      <CreateFlow
        initialSource={initialSource}
        presetAngles={presetAngles}
        inboxItemId={inboxItemId}
        claimClass={claimClass}
        evidenceSummary={evidenceSummary}
      />
    </div>
  );
}

// ── Drafts: the batch drafter (voice-gated) ──────────────────────────────────
async function DraftsView({ error }: { error?: string }) {
  const [qaSampleCount, recentDrafts, pendingTopics, batchItems, engagementRecords] = await Promise.all([
    commandDb.voiceSample.count({ where: { sampleType: "qa_response" } }),
    commandDb.draftPost.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    commandDb.contentTopic.findMany({
      where: { status: "pending" },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
    commandDb.draftPost.findMany({
      where: { approvedForBatch: true, posted: false },
      orderBy: { createdAt: "asc" },
      select: { id: true, channel: true, topicSeed: true, editedText: true, variant1: true, chosenVariant: true, createdAt: true },
    }),
    commandDb.contentEngagement.findMany({ select: { draftPostId: true } }),
  ]);

  const engagedDraftIds = new Set(engagementRecords.map((e) => e.draftPostId));

  // First-run voice gate (verbatim): no Q&A voice samples yet → intake only.
  if (qaSampleCount === 0) {
    return (
      <div className="space-y-8">
        <VoiceIntakePanel error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-end gap-4">
        {/* Topic queue lives in the Ideas tab; voice now lives in the Brand tab. */}
        <Link href="/command/content?tab=ideas&source=topics" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
          Topic queue →
        </Link>
        <Link href="/command/content?tab=brand&view=voice" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
          Voice samples →
        </Link>
      </div>

      <BatchQueue items={batchItems} />
      <DraftComposer channels={CHANNELS} tones={TONES} pendingTopics={pendingTopics} />
      <DraftHistory drafts={recentDrafts} engagedDraftIds={engagedDraftIds} />
    </div>
  );
}

// ── Images: the standalone image studio ──────────────────────────────────────
function ImagesView() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-neutral-200">Images</h2>
        <p className="text-xs text-neutral-600 mt-1">
          Branded cards for social posts: text cards, live chart snapshots, or AI-generated photography.
        </p>
      </div>
      <ImageGenerator />
    </div>
  );
}
