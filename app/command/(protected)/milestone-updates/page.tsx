import Link from "next/link";
import { buildUpdateStepList } from "@/lib/command/milestone-updates/steps";
import { getDefaultUpdateCore } from "@/lib/updates-copy";
import { getMilestoneUpdateSubtext, getMilestoneUpdateSubtextOther } from "@/lib/portal-copy";
import { prisma } from "@/lib/prisma";
import { MilestoneUpdatesEditor, type UpdateRow } from "@/components/command/milestone-updates/MilestoneUpdatesEditor";

// Command Centre → Milestone updates. Edit the client-portal Updates copy for
// each step (the confirmation clause + the subtext shown to each side). Live on
// the portal from the next render, no deploy.

export const dynamic = "force-dynamic";

export default async function MilestoneUpdatesPage() {
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
      <div>
        <Link
          href="/command/milestone-emails"
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          ← Milestone emails
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-100">Milestone updates</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Edit the portal Updates copy for each step: the confirmation line and the subtext shown to
          each side. Changes go live on the portal from the next render, no deploy.
        </p>
      </div>

      <MilestoneUpdatesEditor rows={rows} />
    </div>
  );
}
