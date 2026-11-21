import { buildStepList } from "@/lib/milestone-emails/steps";
import { MilestoneEmailsMatrix } from "@/components/command/milestone-emails/MilestoneEmailsMatrix";

// Platform workspace → Emails → Milestone view. Verbatim from
// /command/milestone-emails (consolidation): pick a scenario and see / edit
// exactly what sends on each step. The MilestoneEmailsMatrix editor + its save
// actions are unchanged; edits apply from the next send. The former page <h1> +
// "← Rules" back-link are dropped (shell + strips label it).
export const dynamic = "force-dynamic";

export function MilestoneEmailsView() {
  const steps = buildStepList();

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-400">
        Pick a scenario and see exactly what sends on each step. Edit it, and it goes out that way
        from the next send.
      </p>

      <MilestoneEmailsMatrix steps={steps} />
    </div>
  );
}
