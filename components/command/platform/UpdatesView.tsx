import { buildUpdateStepList } from "@/lib/command/milestone-updates/steps";
import { getDefaultUpdateCore } from "@/lib/updates-copy";
import { getMilestoneUpdateSubtext, getMilestoneUpdateSubtextOther } from "@/lib/portal-copy";
import { prisma } from "@/lib/prisma";
import { MilestoneUpdatesEditor, type UpdateRow } from "@/components/command/milestone-updates/MilestoneUpdatesEditor";

// Platform workspace → Updates tab ("Milestone updates"). Verbatim from
// /command/milestone-updates (consolidation): edit the client-portal Updates
// copy for each step (confirmation line + per-side subtext). The
// MilestoneUpdatesEditor + its save actions are unchanged; changes go live on
// the portal from the next render. The former page <h1> + "← Milestone emails"
// back-link are dropped (shell + tab strip label it).

export async function UpdatesView() {
  const steps = buildUpdateStepList();
  const overrides = await prisma.milestoneUpdateOverride.findMany();
  const byCode = new Map(overrides.map((o) => [o.code, o]));

  const rows: UpdateRow[] = steps.map((s) => {
    const o = byCode.get(s.code);
    return {
      code: s.code,
      label: s.label,
      side: s.side,
      coreBase: getDefaultUpdateCore(s.code) ?? "",
      coreOverride: o?.core ?? null,
      subtextOwnBase: getMilestoneUpdateSubtext(s.code) ?? "",
      subtextOwnOverride: o?.subtextOwn ?? null,
      subtextOtherBase: getMilestoneUpdateSubtextOther(s.code) ?? "",
      subtextOtherOverride: o?.subtextOther ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-400">
        Edit the portal Updates copy for each step: the confirmation line and the subtext shown to
        each side. Changes go live on the portal from the next render, no deploy.
      </p>

      <MilestoneUpdatesEditor rows={rows} />
    </div>
  );
}
