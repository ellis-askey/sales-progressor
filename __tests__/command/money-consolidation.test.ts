/**
 * @jest-environment node
 *
 * Money consolidation regression guard. The three landing pages (Revenue /
 * Quote inbox / Surveyor firms) become tabs of /command/money; legacy routes
 * redirect; detail/config routes stay. This static guard locks the shell, the
 * redirect map, the sidebar collapse, the retirement, link repoints and the
 * preserved write wiring. (Runtime behaviour is not exercised here.)
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { MONEY_REDIRECTS } from "@/lib/money-redirects";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const gone = (p: string) => !existsSync(join(process.cwd(), p));

const SHELL = "app/command/(protected)/money/page.tsx";
const REVENUE = "components/command/money/tabs/RevenueTab.tsx";
const QUOTES = "components/command/money/tabs/QuotesTab.tsx";
const FIRMS = "components/command/money/tabs/FirmsTab.tsx";
const NEXT_CONFIG = "next.config.ts";
const NAV = "components/command/workspace-nav.ts";

describe("Money — tabbed workspace shell", () => {
  it("exposes the three tabs (Revenue default, Quotes, Firms), lazily gated", () => {
    const src = read(SHELL);
    for (const k of ["revenue", "quotes", "firms"]) expect(src).toContain(`key: "${k}"`);
    expect(src).toContain('? sp.tab : "revenue"');
    expect(src).toContain('active === "revenue" && <RevenueTab');
    expect(src).toContain('active === "quotes" && <QuotesTab');
    expect(src).toContain('active === "firms" && <FirmsTab');
  });

  it("threads the revenue scope + quote filters to the right tab", () => {
    const src = read(SHELL);
    expect(src).toMatch(/<RevenueTab mode=\{sp\.mode\} agency=\{sp\.agency\}/);
    expect(src).toMatch(/<QuotesTab status=\{sp\.status\} firmId=\{sp\.firmId\} collected=\{sp\.collected\}/);
    expect(src).toContain('scope.set("mode", sp.mode)');
    expect(src).toContain("`/command/money?tab=${key}");
  });
});

describe("Money — redirect map (real MONEY_REDIRECTS)", () => {
  const EXPECTED: Record<string, string> = {
    "/command/revenue": "/command/money?tab=revenue",
    "/command/providers/quotes": "/command/money?tab=quotes",
    "/command/providers": "/command/money?tab=firms",
  };

  it("maps each landing to its canonical tab (302, reversible)", () => {
    const actual: Record<string, string> = {};
    for (const r of MONEY_REDIRECTS) { actual[r.source] = r.destination; expect(r.permanent).toBe(false); }
    expect(actual).toEqual(EXPECTED);
  });

  it("does NOT redirect the detail/config/breakdown routes (exact sources only)", () => {
    const sources = MONEY_REDIRECTS.map((r) => r.source);
    for (const kept of ["/command/money", "/command/revenue/breakdown", "/command/providers/service-types"]) {
      expect(sources).not.toContain(kept);
    }
    // Destinations use only the canonical tab param.
    for (const r of MONEY_REDIRECTS) {
      const keys = (r.destination.split("?")[1] ?? "").split("&").map((p) => p.split("=")[0]);
      for (const k of keys) expect(k).toBe("tab");
    }
  });

  it("is wired into next.config.ts without disturbing Content/Growth redirects", () => {
    const cfg = read(NEXT_CONFIG);
    expect(cfg).toContain('from "./lib/money-redirects"');
    expect(cfg).toContain("...MONEY_REDIRECTS");
    expect(cfg).toContain("...CONTENT_REDIRECTS");
    expect(cfg).toContain("...GROWTH_REDIRECTS");
  });
});

describe("Money — sidebar collapse + legacy retirement", () => {
  it("collapses the Money section to a single /command/money entry", () => {
    const src = read(NAV);
    const start = src.indexOf('id: "money"');
    const after = src.indexOf('id: "', start + 10);
    const section = src.slice(start, after === -1 ? undefined : after);
    const hrefs = (section.match(/href: "([^"]+)"/g) ?? []).map((h) => h.replace(/href: "|"/g, ""));
    expect(hrefs).toEqual(["/command/money"]);
  });

  it("retires the three landing pages but keeps the detail/config routes", () => {
    expect(gone("app/command/(protected)/revenue/page.tsx")).toBe(true);
    expect(gone("app/command/(protected)/providers/quotes/page.tsx")).toBe(true);
    expect(gone("app/command/(protected)/providers/page.tsx")).toBe(true);
    // Kept:
    for (const keep of [
      "app/command/(protected)/revenue/[agencyId]/page.tsx",
      "app/command/(protected)/revenue/breakdown/page.tsx",
      "app/command/(protected)/providers/[id]/page.tsx",
      "app/command/(protected)/providers/quotes/[id]/page.tsx",
      "app/command/(protected)/providers/service-types/page.tsx",
      "app/command/(protected)/providers/NewProviderForm.tsx",
      "app/command/(protected)/providers/CopyOnboardingButton.tsx",
    ]) {
      expect(existsSync(join(process.cwd(), keep))).toBe(true);
    }
  });
});

describe("Money — preserved functionality + repointed links", () => {
  it("Revenue repoints quote links to the canonical Quotes tab; keeps detail drill-downs", () => {
    const src = read(REVENUE);
    expect(src).toContain("/command/money?tab=quotes&status=won");
    // No stray legacy quote LINKS (the doc comment may name the path).
    expect(src).not.toContain('href="/command/providers/quotes');
    expect(src).not.toContain("providers/quotes?status");
    expect(src).toContain("/command/revenue/${r.agencyId}"); // per-agency drill-down kept
    expect(src).toContain("/command/revenue/breakdown"); // breakdown drill-down kept
  });

  it("Quotes keeps the inbox loaders + guard + detail links + status filters (repointed)", () => {
    const src = read(QUOTES);
    expect(src).toContain("hasSuperAdminPowers(session)"); // guard preserved
    expect(src).toContain("commandDb.quoteRequest.findMany");
    expect(src).toContain("/command/providers/quotes/${r.id}"); // detail route kept
    expect(src).toContain('href={`/command/money?${params.toString()}`}'); // status filters repointed
    expect(src).toContain('params.set("tab", "quotes")');
  });

  it("Firms preserves the add-firm write form + onboarding button + detail links", () => {
    const src = read(FIRMS);
    expect(src).toContain("<NewProviderForm />");
    expect(src).toContain("<CopyOnboardingButton />");
    expect(src).toContain('from "@/app/command/(protected)/providers/NewProviderForm"');
    expect(src).toContain("/command/providers/${f.id}"); // firm detail kept
    expect(src).toContain("/command/providers/service-types"); // config route kept
  });

  it("the provider/quote write actions keep their logic; revalidatePath repointed to canonical", () => {
    for (const f of ["app/actions/quote-requests.ts", "app/actions/provider-firms.ts", "app/actions/provider-service-types.ts", "app/actions/survey-booking.ts"]) {
      const src = read(f);
      expect(src).not.toContain('revalidatePath("/command/providers/quotes")');
      expect(src).not.toContain('revalidatePath("/command/providers")');
      expect(src).toContain('revalidatePath("/command/money")');
    }
  });

  it("the briefing signal link points at the canonical Quotes tab", () => {
    expect(read("lib/command/signal-display.ts")).toContain('"/command/money?tab=quotes"');
  });
});
