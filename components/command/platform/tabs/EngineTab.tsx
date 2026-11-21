import { ParamTabs } from "@/components/command/ui/primitives";
import { RulesView } from "@/components/command/platform/engine/RulesView";
import { TimeframesView } from "@/components/command/platform/engine/TimeframesView";

// Platform workspace → Engine tab. Two secondary views (?view=):
//   • Rules      — /command/rules (read-only milestone + reminder engine config)
//   • Timeframes — /command/timeframes (live step timing vs the app's
//                  assumptions; moved here from Growth)
// Only the active view's loaders run (lazy). Timeframes' own filters are
// threaded through.

const ENGINE_VIEWS = [
  { key: "rules", label: "Rules" },
  { key: "timeframes", label: "Timeframes" },
] as const;
type EngineView = (typeof ENGINE_VIEWS)[number]["key"];

export async function EngineTab({
  view, segment, source, held, mode, agency,
}: {
  view?: string; segment?: string; source?: string; held?: string; mode?: string; agency?: string;
}) {
  const active: EngineView = (ENGINE_VIEWS.some((v) => v.key === view) ? view : "rules") as EngineView;
  const hrefFor = (v: string) => `/command/platform?tab=engine&view=${v}`;

  return (
    <div className="space-y-6">
      <ParamTabs options={[...ENGINE_VIEWS]} active={active} hrefFor={hrefFor} />
      {active === "rules" && <RulesView />}
      {active === "timeframes" && <TimeframesView segment={segment} source={source} held={held} mode={mode} agency={agency} />}
    </div>
  );
}
