import { commandDb } from "@/lib/command/prisma";

// Content calendar / pipeline (docs/active/content-brand/SPEC.md, Phase 5.1).
// Reads the draft pipeline by stage. "Scheduled" means prepared + reminded, not
// auto-published (that arrives with a publishing integration in Phase 6).
// Superadmin gating lives in the caller.

export type PipelineItem = {
  id: string;
  channel: string;
  text: string;
  pillar: string | null;
  scheduleStatus: string;
  scheduledFor: string | null;
};

export const ACTIVE_STAGES = ["ready", "approved", "scheduled"] as const;

function textOf(d: { editedText: string | null; variant1: string; variant2: string; chosenVariant: number | null }): string {
  return (d.editedText || (d.chosenVariant === 2 ? d.variant2 : d.variant1) || "").trim();
}

function shape(d: {
  id: string; channel: string; editedText: string | null; variant1: string; variant2: string;
  chosenVariant: number | null; pillar: string | null; scheduleStatus: string; scheduledFor: Date | null;
}): PipelineItem {
  return {
    id: d.id,
    channel: d.channel,
    text: textOf(d),
    pillar: d.pillar,
    scheduleStatus: d.scheduleStatus,
    scheduledFor: d.scheduledFor ? d.scheduledFor.toISOString() : null,
  };
}

export type Pipeline = {
  ready: PipelineItem[];
  approved: PipelineItem[];
  scheduled: PipelineItem[];
  published: PipelineItem[];
};

const SELECT = {
  id: true, channel: true, editedText: true, variant1: true, variant2: true,
  chosenVariant: true, pillar: true, scheduleStatus: true, scheduledFor: true,
} as const;

export async function getPipeline(): Promise<Pipeline> {
  const [active, published] = await Promise.all([
    commandDb.draftPost.findMany({
      where: { posted: false, scheduleStatus: { in: ["ready", "approved", "scheduled"] } },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
      take: 100,
      select: SELECT,
    }),
    commandDb.draftPost.findMany({
      where: { posted: true },
      orderBy: { postedAt: "desc" },
      take: 15,
      select: SELECT,
    }),
  ]);

  const byStage: Pipeline = { ready: [], approved: [], scheduled: [], published: [] };
  for (const d of active) {
    const item = shape(d);
    if (item.scheduleStatus === "ready") byStage.ready.push(item);
    else if (item.scheduleStatus === "approved") byStage.approved.push(item);
    else if (item.scheduleStatus === "scheduled") byStage.scheduled.push(item);
  }
  byStage.published = published.map(shape);
  return byStage;
}
