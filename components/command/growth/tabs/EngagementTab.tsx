import { ParamTabs } from "@/components/command/ui/primitives";
import { FeaturesView } from "@/components/command/growth/tabs/engagement/FeaturesView";
import { AdoptionView } from "@/components/command/growth/tabs/engagement/AdoptionView";

// Growth workspace → Engagement tab. Two secondary views (?view=), each a
// verbatim extraction of its former page:
//   • Features — /command/followup-usage (league table + per-feature detail
//                drill-down; keeps mode/agency scope + period/surface/sort +
//                the ?feature= drill-down, all repointed into the workspace URL).
//   • Adoption — /command/adoption (portal engagement; the expandable
//                AdoptionTable; no filters).
// Only the active view's loaders run (lazy `view === key &&`). Neither view
// touches PostHog. Feature-view params are threaded through; Adoption takes none.

const ENG_VIEWS = [
  { key: "features", label: "Features" },
  { key: "adoption", label: "Adoption" },
] as const;
type EngView = (typeof ENG_VIEWS)[number]["key"];

export async function EngagementTab({
  view,
  mode,
  agency,
  period,
  surface,
  sort,
  feature,
}: {
  view?: string;
  mode?: string;
  agency?: string;
  period?: string;
  surface?: string;
  sort?: string;
  feature?: string;
}) {
  const active: EngView = (ENG_VIEWS.some((v) => v.key === view) ? view : "features") as EngView;
  const hrefFor = (v: string) => `/command/growth?tab=engagement&view=${v}`;

  return (
    <div className="space-y-6">
      <ParamTabs options={[...ENG_VIEWS]} active={active} hrefFor={hrefFor} />
      {active === "features" && (
        <FeaturesView mode={mode} agency={agency} period={period} surface={surface} sort={sort} feature={feature} />
      )}
      {active === "adoption" && <AdoptionView />}
    </div>
  );
}
