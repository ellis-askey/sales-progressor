import { ParamTabs } from "@/components/command/ui/primitives";
import { EmailsTab } from "@/components/command/platform/tabs/EmailsTab";
import { UpdatesView } from "@/components/command/platform/UpdatesView";
import { ChasingView } from "@/components/command/platform/ChasingView";
import { EngineTab } from "@/components/command/platform/tabs/EngineTab";

// Platform workspace (Command Centre consolidation). Seven areas become four
// tabs:
//   • Emails   — Catalogue (/command/emails) + Milestone (/command/milestone-
//                emails) + Other (/command/email-templates)
//   • Updates  — Milestone updates (/command/milestone-updates), portal copy
//   • Chasing  — Solicitor chasing cadence (/command/solicitor-chase)
//   • Engine   — Rules (/command/rules) + Timeframes (/command/timeframes, moved
//                here from Growth)
// Legacy routes redirect here (lib/platform-redirects.ts). Only the active tab +
// active secondary view's loaders run (`active === key &&`) — no extra queries
// vs the old pages, no new external calls. Live email delivery, milestone
// notifications, solicitor chasing, scheduling and background processing are
// untouched — this only relocates the editors/reference UIs.

export const dynamic = "force-dynamic";

const TABS = [
  { key: "emails", label: "Emails" },
  { key: "updates", label: "Updates" },
  { key: "chasing", label: "Chasing" },
  { key: "engine", label: "Engine" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function PlatformWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string | string[]; view?: string;
    // engine → timeframes filters
    segment?: string; source?: string; held?: string; mode?: string; agency?: string;
  }>;
}) {
  const sp = await searchParams;
  const rawTab = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const active: Tab = (TABS.some((t) => t.key === rawTab) ? rawTab : "emails") as Tab;
  const hrefFor = (key: string) => `/command/platform?tab=${key}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-100">Platform</h1>
      <ParamTabs options={[...TABS]} active={active} hrefFor={hrefFor} />

      {active === "emails" && <EmailsTab view={sp.view} />}
      {active === "updates" && <UpdatesView />}
      {active === "chasing" && <ChasingView />}
      {active === "engine" && (
        <EngineTab view={sp.view} segment={sp.segment} source={sp.source} held={sp.held} mode={sp.mode} agency={sp.agency} />
      )}
    </div>
  );
}
