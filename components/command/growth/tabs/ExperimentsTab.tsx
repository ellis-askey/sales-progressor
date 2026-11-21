import { ParamTabs } from "@/components/command/ui/primitives";
import { TestsView } from "@/components/command/growth/tabs/experiments/TestsView";
import { ChasingView } from "@/components/command/growth/tabs/experiments/ChasingView";

// Growth workspace → Experiments tab. Two secondary views (?view=):
//   • Tests   — /command/experiments (growth experiment tracker; write-capable:
//               create / start / conclude / abandon / hypothesis edit).
//   • Chasing — /command/enquiries-chase ("Is our chasing working?"); four
//               sub-views selected by ?chase= (renamed from the legacy ?tab= to
//               avoid colliding with the workspace top-level ?tab).
// Only the active view's loaders run (lazy `view === key &&`) — Tests and
// Chasing never load together. Neither view touches PostHog. The Chasing
// sub-view (?chase=) is threaded through; Tests takes no params.

const EXP_VIEWS = [
  { key: "tests", label: "Tests" },
  { key: "chasing", label: "Chasing" },
] as const;
type ExpView = (typeof EXP_VIEWS)[number]["key"];

export async function ExperimentsTab({ view, chase }: { view?: string; chase?: string }) {
  const active: ExpView = (EXP_VIEWS.some((v) => v.key === view) ? view : "tests") as ExpView;
  const hrefFor = (v: string) => `/command/growth?tab=experiments&view=${v}`;

  return (
    <div className="space-y-6">
      <ParamTabs options={[...EXP_VIEWS]} active={active} hrefFor={hrefFor} />
      {active === "tests" && <TestsView />}
      {active === "chasing" && <ChasingView chase={chase} />}
    </div>
  );
}
