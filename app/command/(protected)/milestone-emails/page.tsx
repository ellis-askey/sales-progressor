import Link from "next/link";
import { buildStepList } from "@/lib/milestone-emails/steps";
import { MilestoneEmailsMatrix } from "@/components/command/milestone-emails/MilestoneEmailsMatrix";

// Command Centre → Milestone emails. Pick a scenario (tenure, method, side, step)
// and see exactly what sends on each confirmation. Edit it and it goes out that
// way from the next send.

export const dynamic = "force-dynamic";

export default function MilestoneEmailsPage() {
  const steps = buildStepList();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/command/rules"
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          ← Rules
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-100">Milestone emails</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Pick a scenario and see exactly what sends on each step. Edit it, and it goes out that way
          from the next send.
        </p>
      </div>

      <MilestoneEmailsMatrix steps={steps} />
    </div>
  );
}
