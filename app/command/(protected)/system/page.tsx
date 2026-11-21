import { ParamTabs } from "@/components/command/ui/primitives";
import { MonitoringTab } from "@/components/command/system/tabs/MonitoringTab";
import { PlatformUpdatesView } from "@/components/command/system/PlatformUpdatesView";
import { CritiqueView } from "@/components/command/system/CritiqueView";
import { SettingsView } from "@/components/command/system/SettingsView";

// System workspace (Command Centre consolidation — final section). Six entries
// become four tabs:
//   • Monitoring — Status (/command/health) + Activity (/command/activity) +
//                  Audit (/command/audit)
//   • Updates    — Platform updates (/command/updates)
//   • Critique   — Critique notes (/command/critique)
//   • Settings   — tools + config signposts (/command/settings); the Connections
//                  detail route (/command/settings/connections) stays.
// Legacy routes redirect here (lib/system-redirects.ts). Only the active tab +
// active secondary view's loaders run (`active === key &&`) — no extra queries
// vs the old pages, no new external calls. System monitoring, logging,
// diagnostics, security and configuration behaviour are untouched — this only
// relocates the UIs.

export const dynamic = "force-dynamic";

const TABS = [
  { key: "monitoring", label: "Monitoring" },
  { key: "updates", label: "Updates" },
  { key: "critique", label: "Critique" },
  { key: "settings", label: "Settings" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function SystemWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string | string[]; view?: string;
    // monitoring → activity
    mode?: string; agency?: string; who?: string; sort?: string;
    // monitoring → audit
    action?: string; target?: string; admin?: string; from?: string; to?: string; page?: string;
  }>;
}) {
  const sp = await searchParams;
  const rawTab = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const active: Tab = (TABS.some((t) => t.key === rawTab) ? rawTab : "monitoring") as Tab;
  const hrefFor = (key: string) => `/command/system?tab=${key}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-100">System</h1>
      <ParamTabs options={[...TABS]} active={active} hrefFor={hrefFor} />

      {active === "monitoring" && (
        <MonitoringTab
          view={sp.view}
          mode={sp.mode} agency={sp.agency} who={sp.who} sort={sp.sort}
          action={sp.action} target={sp.target} admin={sp.admin} from={sp.from} to={sp.to} page={sp.page}
        />
      )}
      {active === "updates" && <PlatformUpdatesView />}
      {active === "critique" && <CritiqueView />}
      {active === "settings" && <SettingsView />}
    </div>
  );
}
