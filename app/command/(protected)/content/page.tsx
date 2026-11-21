import { ParamTabs } from "@/components/command/ui/primitives";
import { OverviewTab } from "@/components/command/content/tabs/OverviewTab";
import { IdeasTab } from "@/components/command/content/tabs/IdeasTab";
import { CreateTab } from "@/components/command/content/tabs/CreateTab";
import { PlanTab } from "@/components/command/content/tabs/PlanTab";
import { MeasureTab } from "@/components/command/content/tabs/MeasureTab";
import { BrandTab } from "@/components/command/content/tabs/BrandTab";

// Content workspace (consolidation Phase 1). The former /command/content
// overview page becomes a tabbed workspace shell. Phase 1 ships the Overview
// (default) and Ideas tabs only; the remaining tabs (Create / Plan / Measure /
// Brand) and the legacy-route redirects + sidebar collapse land in later phases,
// so every existing content route stays operational for now. See
// docs/active/admin-workspace/06-CONTENT-CONSOLIDATION.md.
//
// maxDuration carried over from the former inbox/opportunities pages: the Ideas
// tab hosts their AI refresh actions (Claude enrichment), which need the window.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Only the built tabs appear in the strip — no dead/placeholder controls. The
// other content pages remain reachable via the sidebar + their routes until
// their tabs ship.
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "ideas", label: "Ideas" },
  { key: "create", label: "Create" },
  { key: "plan", label: "Plan" },
  { key: "measure", label: "Measure" },
  { key: "brand", label: "Brand" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function ContentWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; source?: string; build?: string; view?: string; item?: string; thought?: string; opp?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const active: Tab = (TABS.some((t) => t.key === sp.tab) ? sp.tab : "overview") as Tab;
  const hrefFor = (key: string) => `/command/content?tab=${key}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-100">Content</h1>
      <ParamTabs options={[...TABS]} active={active} hrefFor={hrefFor} />

      {active === "overview" && <OverviewTab />}
      {active === "ideas" && <IdeasTab source={sp.source} />}
      {active === "create" && (
        <CreateTab view={sp.build} seed={{ item: sp.item, thought: sp.thought, opp: sp.opp, error: sp.error }} />
      )}
      {active === "plan" && <PlanTab />}
      {active === "measure" && <MeasureTab />}
      {active === "brand" && <BrandTab view={sp.view} error={sp.error} />}
    </div>
  );
}
