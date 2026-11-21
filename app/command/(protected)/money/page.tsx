import { ParamTabs } from "@/components/command/ui/primitives";
import { RevenueTab } from "@/components/command/money/tabs/RevenueTab";
import { QuotesTab } from "@/components/command/money/tabs/QuotesTab";
import { FirmsTab } from "@/components/command/money/tabs/FirmsTab";

// Money workspace (Command Centre consolidation). The former Revenue, Quote
// inbox and Surveyor-firms landing pages become three tabs of one workspace at
// /command/money. The legacy routes redirect here (lib/money-redirects.ts); the
// detail / config / breakdown routes (/command/revenue/[agencyId],
// /command/revenue/breakdown, /command/providers/[id], /command/providers/
// quotes/[id], /command/providers/service-types) stay as their own routes and
// are linked from the tabs.
//
// Only the active tab's component runs (`active === key &&`), so exactly one
// tab's loaders execute per request — no new queries vs the three old pages, no
// external calls. The revenue scope (mode/agency) is preserved across tab
// switches via hrefFor; each tab's own filters (quotes status/firmId/collected)
// are threaded through to it.

export const dynamic = "force-dynamic";

const TABS = [
  { key: "revenue", label: "Revenue" },
  { key: "quotes", label: "Quotes" },
  { key: "firms", label: "Firms" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function MoneyWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string; mode?: string; agency?: string;
    status?: string; firmId?: string; collected?: string;
  }>;
}) {
  const sp = await searchParams;
  const active: Tab = (TABS.some((t) => t.key === sp.tab) ? sp.tab : "revenue") as Tab;

  // Preserve the revenue scope (mode/agency) across tab switches. Tab-specific
  // filters (quotes status/firmId/collected) are intentionally not carried to
  // other tabs.
  const scope = new URLSearchParams();
  if (sp.mode) scope.set("mode", sp.mode);
  if (sp.agency) scope.set("agency", sp.agency);
  const scopeQs = scope.toString();
  const hrefFor = (key: string) => `/command/money?tab=${key}${scopeQs ? `&${scopeQs}` : ""}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-100">Money</h1>
      <ParamTabs options={[...TABS]} active={active} hrefFor={hrefFor} />

      {active === "revenue" && <RevenueTab mode={sp.mode} agency={sp.agency} />}
      {active === "quotes" && <QuotesTab status={sp.status} firmId={sp.firmId} collected={sp.collected} />}
      {active === "firms" && <FirmsTab />}
    </div>
  );
}
