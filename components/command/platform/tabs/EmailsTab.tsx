import { ParamTabs } from "@/components/command/ui/primitives";
import { CatalogueView } from "@/components/command/platform/email/CatalogueView";
import { MilestoneEmailsView } from "@/components/command/platform/email/MilestoneEmailsView";
import { TemplatesView } from "@/components/command/platform/email/TemplatesView";

// Platform workspace → Emails tab. Three secondary views (?view=):
//   • Catalogue — /command/emails (every email rendered + review state)
//   • Milestone — /command/milestone-emails (per-step milestone email editor)
//   • Other     — /command/email-templates (the longer automated client emails)
// Only the active view's loaders run (lazy). No email delivery touched.

const EMAIL_VIEWS = [
  { key: "catalogue", label: "Catalogue" },
  { key: "milestones", label: "Milestone" },
  { key: "templates", label: "Other" },
] as const;
type EmailView = (typeof EMAIL_VIEWS)[number]["key"];

export async function EmailsTab({ view }: { view?: string }) {
  const active: EmailView = (EMAIL_VIEWS.some((v) => v.key === view) ? view : "catalogue") as EmailView;
  const hrefFor = (v: string) => `/command/platform?tab=emails&view=${v}`;

  return (
    <div className="space-y-6">
      <ParamTabs options={[...EMAIL_VIEWS]} active={active} hrefFor={hrefFor} />
      {active === "catalogue" && <CatalogueView />}
      {active === "milestones" && <MilestoneEmailsView />}
      {active === "templates" && <TemplatesView />}
    </div>
  );
}
