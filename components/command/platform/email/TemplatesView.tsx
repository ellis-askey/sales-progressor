import { PlatformEmailTemplatesEditor } from "@/components/command/email-templates/PlatformEmailTemplatesEditor";

// Platform workspace → Emails → Other view ("Other client emails"). Verbatim
// from /command/email-templates (consolidation): Sales Progressor's own
// defaults for the longer automated client emails (completion pack, exchange
// day, chase, weekly update). The PlatformEmailTemplatesEditor + its save
// actions are unchanged; edits apply from the next send. The former page <h1> +
// "← Milestone emails" back-link are dropped.

export function TemplatesView() {
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-neutral-400">
        The default wording for the longer automated client emails. This is what every agency inherits unless they
        change it in their own account. Edits apply from the next send. The step-by-step milestone emails are edited
        under Milestone.
      </p>

      <PlatformEmailTemplatesEditor />
    </div>
  );
}
