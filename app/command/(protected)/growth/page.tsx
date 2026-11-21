import { ParamTabs } from "@/components/command/ui/primitives";
import { TrendsTab } from "@/components/command/growth/tabs/TrendsTab";
import { AcquisitionTab } from "@/components/command/growth/tabs/AcquisitionTab";
import { ActivationTab } from "@/components/command/growth/tabs/ActivationTab";
import { EngagementTab } from "@/components/command/growth/tabs/EngagementTab";
import { RetentionTab } from "@/components/command/growth/tabs/RetentionTab";
import { ExperimentsTab } from "@/components/command/growth/tabs/ExperimentsTab";

// Growth workspace (consolidation Phases 1-4). The former standalone
// /command/growth (Trends) page becomes a tabbed workspace shell. All six
// analytics tabs now live here: Trends (default), Acquisition (Website +
// Invites), Activation, Engagement (Features + Adoption), Retention, Experiments
// (Tests + Chasing). The legacy-route redirects + sidebar collapse land in
// Phase 5A, so every existing Growth route stays operational for now. (Timeframes
// stays separate — it moves to Platform later.) See
// docs/active/admin-workspace/07-GROWTH-CONSOLIDATION.md.
//
// Only the active tab's component runs — each tab is an async server component
// gated by `active === key`, so exactly one tab's loaders execute per request
// (no stacking, no extra queries, no extra PostHog). The mode/agency scope is
// read from the URL and threaded to the active tab, and preserved across tab
// switches via hrefFor (view-specific params like view/period/tier/range/
// surface/sort/feature are intentionally NOT carried across top tabs — each
// tab/view validates its own params and defaults safely). Secondary params are
// passed through to the active tab so its in-tab controls + drill-downs work.

export const dynamic = "force-dynamic";

// Only the built tabs appear in the strip — no dead/placeholder controls. The
// other Growth pages remain reachable via the sidebar + their routes until
// their tabs ship.
const TABS = [
  { key: "trends", label: "Trends" },
  { key: "acquisition", label: "Acquisition" },
  { key: "activation", label: "Activation" },
  { key: "engagement", label: "Engagement" },
  { key: "retention", label: "Retention" },
  { key: "experiments", label: "Experiments" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function GrowthWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string | string[]; mode?: string; agency?: string;
    view?: string; period?: string; tier?: string; range?: string;
    surface?: string; sort?: string; feature?: string; chase?: string;
  }>;
}) {
  const sp = await searchParams;
  // Defence-in-depth for the enquiries-chase redirect: if a legacy ?tab= value
  // were ever forwarded alongside the canonical ?tab=experiments, Next would
  // deliver an array with the destination value FIRST. Coerce to the first so a
  // legacy tab can never overwrite the workspace tab, independent of Next's
  // query-forward/consume semantics.
  const rawTab = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const active: Tab = (TABS.some((t) => t.key === rawTab) ? rawTab : "trends") as Tab;

  // Preserve the current scope (mode/agency) across tab switches.
  const scope = new URLSearchParams();
  if (sp.mode) scope.set("mode", sp.mode);
  if (sp.agency) scope.set("agency", sp.agency);
  const scopeQs = scope.toString();
  const hrefFor = (key: string) => `/command/growth?tab=${key}${scopeQs ? `&${scopeQs}` : ""}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-100">Growth</h1>
      <ParamTabs options={[...TABS]} active={active} hrefFor={hrefFor} />

      {active === "trends" && <TrendsTab mode={sp.mode} agency={sp.agency} />}
      {active === "acquisition" && (
        <AcquisitionTab view={sp.view} period={sp.period} tier={sp.tier} range={sp.range} />
      )}
      {active === "activation" && <ActivationTab mode={sp.mode} agency={sp.agency} />}
      {active === "engagement" && (
        <EngagementTab
          view={sp.view}
          mode={sp.mode}
          agency={sp.agency}
          period={sp.period}
          surface={sp.surface}
          sort={sp.sort}
          feature={sp.feature}
        />
      )}
      {active === "retention" && <RetentionTab mode={sp.mode} agency={sp.agency} />}
      {active === "experiments" && <ExperimentsTab view={sp.view} chase={sp.chase} />}
    </div>
  );
}
