/**
 * @jest-environment node
 *
 * Increment 2 — Agency Billing consolidation guard.
 *
 * The agency revenue experience must be ONE shared component rendered by both
 * the /command/revenue/[agencyId] route and the Agency Account Billing tab —
 * no duplicated revenue UI, and the standalone route must stay operational.
 * (Figure-level correctness is guaranteed separately by `tsc`: AgencyBillingPanel's
 * `data` prop is derived from getAgencyRevenueDetail's return type, so any wrong
 * field access fails typecheck.)
 */

import { readFileSync, existsSync } from "fs";

const PANEL = "components/command/agency/AgencyBillingPanel.tsx";
const REVENUE_ROUTE = "app/command/(protected)/revenue/[agencyId]/page.tsx";
const ACCOUNT = "app/command/(protected)/agency/[agencyId]/page.tsx";

describe("Agency billing consolidation (Increment 2)", () => {
  it("the shared AgencyBillingPanel exists and is exported", () => {
    expect(existsSync(PANEL)).toBe(true);
    expect(readFileSync(PANEL, "utf8")).toMatch(/export function AgencyBillingPanel/);
  });

  it("both the revenue route and the agency account render the shared panel", () => {
    expect(readFileSync(REVENUE_ROUTE, "utf8")).toContain("AgencyBillingPanel");
    expect(readFileSync(ACCOUNT, "utf8")).toContain("AgencyBillingPanel");
  });

  it("the revenue experience is single-source: the route no longer duplicates the sections", () => {
    const route = readFileSync(REVENUE_ROUTE, "utf8");
    const panel = readFileSync(PANEL, "utf8");
    // These section markers now live ONLY in the panel.
    for (const marker of ["Pipeline outlook", "Active files · expected fees", "Recent exchanges"]) {
      expect(panel).toContain(marker);
      expect(route).not.toContain(marker);
    }
  });

  it("the revenue route stays operational (loader + notFound guard preserved)", () => {
    const route = readFileSync(REVENUE_ROUTE, "utf8");
    expect(route).toContain("getAgencyRevenueDetail");
    expect(route).toContain("notFound()");
  });

  it("financial loaders/controls are reused, not reimplemented, in the account", () => {
    const account = readFileSync(ACCOUNT, "utf8");
    // Fee editing reused; revenue fetched via the shared loader (lazily on the billing tab).
    expect(account).toContain("AgencyFeeEditor");
    expect(account).toContain("getAgencyRevenueDetail");
    // No bespoke fee maths in the page.
    expect(account).not.toMatch(/computeFee|feeBand|\*\s*0\.0?[12]/);
  });
});
