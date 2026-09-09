import Link from "next/link";
import { commandDb } from "@/lib/command/prisma";
import { CreateFlow } from "@/components/command/content/CreateFlow";

// Guided creation flow (docs/active/content-brand/SPEC.md, Phase 1.4). Reachable
// blank, or seeded from an inbox item (?item=) or a saved thought (?thought=).
// Superadmin gating handled by the (protected) layout.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string; thought?: string; opp?: string }>;
}) {
  const sp = await searchParams;

  let initialSource = "";
  let presetAngles: PresetAngle[] = [];
  let inboxItemId: string | undefined;
  let claimClass: string | undefined;
  let evidenceSummary: string | null = null;

  if (sp.item) {
    const item = await commandDb.contentInboxItem.findUnique({ where: { id: sp.item } });
    if (item) {
      initialSource = item.observation;
      presetAngles = Array.isArray(item.suggestedAngles) ? (item.suggestedAngles as PresetAngle[]) : [];
      inboxItemId = item.id;
      claimClass = item.claimClass;
      evidenceSummary = summariseEvidence(item.evidence);
    }
  } else if (sp.thought) {
    const th = await commandDb.ellisThought.findUnique({ where: { id: sp.thought } });
    if (th) initialSource = th.body;
  } else if (sp.opp) {
    const opp = await commandDb.brandOpportunity.findUnique({ where: { id: sp.opp } });
    if (opp) {
      initialSource = opp.suggestedAction ? `${opp.title}\n\n${opp.suggestedAction}` : opp.title;
      claimClass = opp.claimClass;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Create</h1>
          <p className="mt-1 max-w-xl text-[13px] text-neutral-500">
            Decide what you&rsquo;re actually saying before we write a word. Source, then why, then the point, then the
            format. The draft comes last.
          </p>
        </div>
        <Link href="/command/content/inbox" className="shrink-0 text-xs text-neutral-500 transition-colors hover:text-neutral-300">
          ← Inbox
        </Link>
      </div>

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
