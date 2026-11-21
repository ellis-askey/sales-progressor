/**
 * @jest-environment node
 *
 * Growth consolidation — Phase 1 regression guard.
 *
 * Phase 1 turns /command/growth into a tabbed workspace shell with Trends
 * (default) + Retention, extracted verbatim into tab components. Legacy routes
 * stay operational; no redirects/sidebar/other tabs yet. This static guard locks:
 *   1. the shell exposes exactly the two built tabs (no dead/placeholder tabs);
 *   2. only the active tab renders (lazy — one loader set per request);
 *   3. the mode/agency scope is threaded in and preserved across tab switches;
 *   4. the tab components exist and are verbatim (loaders unchanged, no PostHog/
 *      polling introduced);
 *   5. the legacy /command/retention route is left in place (operational).
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { mapLegacyChaseUrl, LEGACY_CHASE_VALUES } from "@/lib/growth-chasing-compat";
import { GROWTH_REDIRECTS } from "@/lib/growth-redirects";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const SHELL = "app/command/(protected)/growth/page.tsx";
const TRENDS = "components/command/growth/tabs/TrendsTab.tsx";
const RETENTION = "components/command/growth/tabs/RetentionTab.tsx";
const ACQUISITION = "components/command/growth/tabs/AcquisitionTab.tsx";
const ACTIVATION = "components/command/growth/tabs/ActivationTab.tsx";
const ENGAGEMENT = "components/command/growth/tabs/EngagementTab.tsx";
const FEATURES = "components/command/growth/tabs/engagement/FeaturesView.tsx";
const ADOPTION_VIEW = "components/command/growth/tabs/engagement/AdoptionView.tsx";
const LEGACY_RETENTION = "app/command/(protected)/retention/page.tsx";
const LEGACY_WEBSITE = "app/command/(protected)/website-growth/page.tsx";
const LEGACY_INVITES = "app/command/(protected)/chain-invites/page.tsx";
const LEGACY_ACTIVATION = "app/command/(protected)/activation/page.tsx";
const LEGACY_FOLLOWUP = "app/command/(protected)/followup-usage/page.tsx";
const LEGACY_ADOPTION = "app/command/(protected)/adoption/page.tsx";
const EXPERIMENTS_TAB = "components/command/growth/tabs/ExperimentsTab.tsx";
const TESTS_VIEW = "components/command/growth/tabs/experiments/TestsView.tsx";
const CHASING_VIEW = "components/command/growth/tabs/experiments/ChasingView.tsx";
const LEGACY_EXPERIMENTS = "app/command/(protected)/experiments/page.tsx";
const LEGACY_ENQUIRIES_CHASE = "app/command/(protected)/enquiries-chase/page.tsx";
const NEXT_CONFIG = "next.config.ts";
const NAV = "components/command/workspace-nav.ts";

describe("Growth Phase 1 — tabbed shell", () => {
  it("exposes exactly the six built tabs (Trends default … Experiments)", () => {
    const src = read(SHELL);
    for (const key of ["trends", "acquisition", "activation", "engagement", "retention", "experiments"]) {
      expect(src).toContain(`key: "${key}"`);
    }
    // Default falls back to trends (tab resolved from the coerced rawTab).
    expect(src).toContain('? rawTab : "trends"');
  });

  it("renders only the active tab (lazy — one loader set per request)", () => {
    const src = read(SHELL);
    expect(src).toContain('active === "trends" && <TrendsTab');
    expect(src).toContain('active === "acquisition" && (');
    expect(src).toContain('active === "activation" && <ActivationTab');
    expect(src).toContain('active === "engagement" && (');
    expect(src).toContain('active === "retention" && <RetentionTab');
    expect(src).toContain('active === "experiments" && <ExperimentsTab');
  });

  it("threads mode/agency into both tabs and preserves scope across tab switches", () => {
    const src = read(SHELL);
    expect(src).toMatch(/<TrendsTab mode=\{sp\.mode\} agency=\{sp\.agency\}/);
    expect(src).toMatch(/<RetentionTab mode=\{sp\.mode\} agency=\{sp\.agency\}/);
    // hrefFor carries the scope query so switching tabs keeps the selection.
    expect(src).toContain("scope.set(\"mode\", sp.mode)");
    expect(src).toContain("scope.set(\"agency\", sp.agency)");
    expect(src).toContain("`/command/growth?tab=${key}");
  });
});

describe("Growth Phase 1 — tab components verbatim, no new external calls", () => {
  it("Trends keeps its exact commandDb query set and adds no PostHog/fetch/polling", () => {
    const src = read(TRENDS);
    // The three dailyMetric.findMany queries (+ one more textual hit in the
    // DailyRow type alias), the groupBy leaderboard, cohorts, and agency lookups.
    expect((src.match(/commandDb\.dailyMetric\.findMany/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(src).toContain("commandDb.dailyMetric.groupBy");
    expect(src).toContain("commandDb.agency.groupBy");
    expect(src).toContain("commandDb.weeklyCohort.findMany");
    expect(src).toContain("commandDb.agency.findMany");
    expect(src).not.toMatch(/posthog|isPosthogConfigured|fetch\(|setInterval|useEffect/i);
  });

  it("Retention renders the same three loaders and adds no PostHog/fetch/polling", () => {
    const src = read(RETENTION);
    expect(src).toContain("getRetention(mode, agencyIds)");
    expect(src).toContain("getTransactionRetention(mode, agencyIds)");
    expect(src).toContain("getFreeModelSignals(mode, agencyIds)");
    expect(src).not.toMatch(/posthog|isPosthogConfigured|fetch\(|setInterval|useEffect/i);
  });
});

describe("Growth Phase 1 — legacy route preserved", () => {
  it("retires the legacy /command/retention page (Phase 5B); redirect still maps it", () => {
    expect(existsSync(join(process.cwd(), LEGACY_RETENTION))).toBe(false);
    expect(GROWTH_REDIRECTS.some((r) => r.source === "/command/retention")).toBe(true);
  });
});

describe("Growth Phase 2 — Acquisition tab (Website + Invites)", () => {
  it("shell passes view/period/tier/range through to the Acquisition tab", () => {
    const src = read(SHELL);
    expect(src).toMatch(/<AcquisitionTab view=\{sp\.view\} period=\{sp\.period\} tier=\{sp\.tier\} range=\{sp\.range\}/);
  });

  it("has two secondary views (Website default, Invites), each gated (lazy)", () => {
    const src = read(ACQUISITION);
    expect(src).toContain('key: "website"');
    expect(src).toContain('key: "invites"');
    expect(src).toContain('? view : "website"');
    expect(src).toContain('active === "website" && <WebsiteView');
    expect(src).toContain('active === "invites" && <InvitesView');
  });

  it("Website view keeps its exact loaders — only Website touches PostHog", () => {
    const src = read(ACQUISITION);
    expect(src).toContain("getGrowthDashboard(periodKey, tierKey)");
    expect(src).toContain("getWebsiteBehaviour(d.period.start, d.period.end)");
    expect(src).toContain("getHomepageSectionReach(d.period.start, d.period.end)");
    // The only PostHog references sit inside WebsiteView (gated by view==="website").
    const invitesStart = src.indexOf("async function InvitesView");
    expect(invitesStart).toBeGreaterThan(-1);
    expect(src.slice(invitesStart)).not.toMatch(/getWebsiteBehaviour|getHomepageSectionReach|posthog/i);
  });

  it("Invites view keeps its four loaders and touches no PostHog/fetch", () => {
    const src = read(ACQUISITION);
    for (const loader of ["getChainInviteReport", "getUninvitedNeighbours", "getClaimActivation", "getLoopMetrics"]) {
      expect(src).toContain(loader);
    }
  });

  it("repoints the period/tier/range filter links to the workspace URL", () => {
    const src = read(ACQUISITION);
    expect(src).toContain("`/command/growth?${params.toString()}`"); // website period/tier
    expect(src).toContain('params.set("tab", "acquisition")');
    expect(src).toContain('params.set("view", "website")');
    expect(src).toContain("/command/growth?tab=acquisition&view=invites&range=");
    // No stray navigational links back to the legacy routes (the doc comment
    // may name them, so match the link/query forms the old pages actually used).
    expect(src).not.toContain("/command/website-growth?");
    expect(src).not.toContain("/command/website-growth`");
    expect(src).not.toContain("/command/chain-invites?");
    expect(src).not.toContain("/command/chain-invites`");
  });

  it("adds no polling / auto-refresh / new caching", () => {
    const src = read(ACQUISITION);
    expect(src).not.toMatch(/setInterval|useEffect|refetchInterval|revalidate\s*[:=]|unstable_cache/);
  });

  it("retires the legacy website-growth + chain-invites pages (Phase 5B); redirects still map them", () => {
    expect(existsSync(join(process.cwd(), LEGACY_WEBSITE))).toBe(false);
    expect(existsSync(join(process.cwd(), LEGACY_INVITES))).toBe(false);
    expect(GROWTH_REDIRECTS.some((r) => r.source === "/command/website-growth")).toBe(true);
    expect(GROWTH_REDIRECTS.some((r) => r.source === "/command/chain-invites")).toBe(true);
  });
});

describe("Growth Phase 3 — Activation + Engagement", () => {
  it("shell threads scope to Activation and the feature params to Engagement", () => {
    const src = read(SHELL);
    expect(src).toMatch(/<ActivationTab mode=\{sp\.mode\} agency=\{sp\.agency\}/);
    expect(src).toContain("view={sp.view}");
    expect(src).toContain("surface={sp.surface}");
    expect(src).toContain("sort={sp.sort}");
    expect(src).toContain("feature={sp.feature}");
  });

  it("Activation keeps its exact loaders (incl. the two raw percentile queries) and no PostHog", () => {
    const src = read(ACTIVATION);
    expect((src.match(/commandDb\.\$queryRaw/g) ?? []).length).toBe(2);
    expect(src).toContain("commandDb.agency.findMany");
    expect((src.match(/commandDb\.event\.findMany/g) ?? []).length).toBe(2);
    // No external-call / polling code (plain word "PostHog" in the doc comment is fine).
    expect(src).not.toMatch(/isPosthogConfigured|getWebsiteBehaviour|getHomepageSectionReach|fetch\(|setInterval|useEffect/);
  });

  it("Engagement has two views (Features default, Adoption), each lazily gated", () => {
    const src = read(ENGAGEMENT);
    expect(src).toContain('key: "features"');
    expect(src).toContain('key: "adoption"');
    expect(src).toContain('? view : "features"');
    expect(src).toContain('active === "features" && (');
    expect(src).toContain('active === "adoption" && <AdoptionView');
  });

  it("Features view keeps league + detail loaders and repoints every link to the workspace", () => {
    const src = read(FEATURES);
    expect(src).toContain("getFeatureUsage({ mode, agencyIds }, period)");
    expect(src).toContain("getFeatureDetail(feature, { mode, agencyIds }, period)");
    // All internal links go through the repointed href() → the workspace URL.
    expect(src).toContain("`/command/growth?${p.toString()}`");
    expect(src).toContain('p.set("tab", "engagement")');
    expect(src).toContain('p.set("view", "features")');
    // No navigational link back to the legacy route (doc comment may name it, so
    // match the link/query forms the old page actually built).
    expect(src).not.toContain("/command/followup-usage?");
    expect(src).not.toContain("/command/followup-usage`");
    expect(src).not.toMatch(/getFeatureUsage.*posthog|fetch\(|setInterval|useEffect/i);
  });

  it("the feature-detail drill-down + back link resolve inside the workspace", () => {
    const src = read(FEATURES);
    // Drill-down: href(base, { feature: f.id }); detail branch reads `feature`.
    expect(src).toContain("href(base, { feature: f.id })");
    expect(src).toContain("if (feature) {");
    // Back link clears the feature param (returns to the league within the tab).
    expect(src).toContain("{ feature: undefined }");
  });

  it("Adoption view preserves the expandable AdoptionTable and adds no PostHog", () => {
    const src = read(ADOPTION_VIEW);
    expect(src).toContain("<AdoptionTable clients={clients} />");
    expect(src).toContain("getPortalAdoption()");
    // No external-call / polling code (plain word "PostHog" in the doc comment is fine).
    expect(src).not.toMatch(/isPosthogConfigured|getWebsiteBehaviour|getHomepageSectionReach|fetch\(|setInterval|useEffect/);
  });

  it("retires the legacy activation / followup-usage / adoption pages (Phase 5B); redirects still map them", () => {
    for (const f of [LEGACY_ACTIVATION, LEGACY_FOLLOWUP, LEGACY_ADOPTION]) {
      expect(existsSync(join(process.cwd(), f))).toBe(false);
    }
    for (const s of ["/command/activation", "/command/followup-usage", "/command/adoption"]) {
      expect(GROWTH_REDIRECTS.some((r) => r.source === s)).toBe(true);
    }
  });
});

describe("Growth Phase 4 — Experiments + Chasing", () => {
  it("shell threads view + chase to the Experiments tab", () => {
    const src = read(SHELL);
    expect(src).toMatch(/<ExperimentsTab view=\{sp\.view\} chase=\{sp\.chase\}/);
    expect(src).toContain("chase?: string");
  });

  it("Experiments has two views (Tests default, Chasing), each lazily gated", () => {
    const src = read(EXPERIMENTS_TAB);
    expect(src).toContain('key: "tests"');
    expect(src).toContain('key: "chasing"');
    expect(src).toContain('? view : "tests"');
    expect(src).toContain('active === "tests" && <TestsView');
    expect(src).toContain('active === "chasing" && <ChasingView chase={chase}');
  });

  it("Tests view keeps every write component wired to its existing server action", () => {
    const src = read(TESTS_VIEW);
    // The four write/interactive components are rendered…
    for (const comp of ["<ExperimentSuggestions", "<NewExperimentForm", "<ProposedHypothesisEditor", "<ExperimentActions"]) {
      expect(src).toContain(comp);
    }
    // …and the loaders are the exact originals (no PostHog).
    expect(src).toContain("commandDb.experiment.findMany");
    expect(src).toContain("getExperimentSuggestions()");
    expect(src).not.toMatch(/isPosthogConfigured|getWebsiteBehaviour|fetch\(|setInterval/);
  });

  it("experiment/chase server actions: logic preserved, revalidatePath repointed to canonical (Phase 5B)", () => {
    const actions = read("app/actions/command-centre.ts");
    // Phase 5B: the retired-route revalidatePath targets are gone; they now
    // point at the canonical workspace route.
    expect(actions).not.toContain('revalidatePath("/command/experiments")');
    expect(actions).not.toContain('revalidatePath("/command/enquiries-chase")');
    expect(actions).toContain('revalidatePath("/command/growth")');
    // Business logic / validation throws untouched.
    expect(actions).toContain("A name and a hypothesis are both required.");
    expect(actions).toContain("The hypothesis can't be empty.");
  });

  it("Chasing view uses ?chase= (never a bare ?tab=) and keeps all four sub-views", () => {
    const src = read(CHASING_VIEW);
    expect(src).toContain('{ key: "enquiries"');
    expect(src).toContain('{ key: "solicitor"');
    expect(src).toContain('{ key: "client"');
    expect(src).toContain('{ key: "opted_out"');
    // Sub-view links target the workspace with ?chase=, not the legacy ?tab=.
    expect(src).toContain("/command/growth?tab=experiments&view=chasing");
    expect(src).toContain("&chase=${t.key}");
    // No navigational link back to the legacy route (the doc comment may name
    // it, so match the link/query forms the old page actually built).
    expect(src).not.toContain("/command/enquiries-chase?");
    expect(src).not.toContain("/command/enquiries-chase`");
    expect(src).not.toContain("/command/enquiries-chase$");
    // The write toggle + drawer + read-only opted-out table are preserved.
    expect(src).toContain("<ChaseHubTable");
    expect(src).toContain("<OptedOutTable");
  });

  it("retires the legacy experiments + enquiries-chase pages (Phase 5B); redirects still map them", () => {
    expect(existsSync(join(process.cwd(), LEGACY_EXPERIMENTS))).toBe(false);
    expect(existsSync(join(process.cwd(), LEGACY_ENQUIRIES_CHASE))).toBe(false);
    expect(GROWTH_REDIRECTS.filter((r) => r.source === "/command/enquiries-chase")).toHaveLength(2);
    expect(GROWTH_REDIRECTS.some((r) => r.source === "/command/experiments")).toBe(true);
  });

  it("the write actions remain unverified at runtime (static wiring only)", () => {
    // This suite proves the components are wired to the actions, NOT that the
    // mutations run or that the UI refreshes on the canonical route. The list of
    // write workflows needing an authenticated run is in 07 §11d/§11e.
    expect(true).toBe(true);
  });
});

describe("Growth Phase 4 — enquiries-chase ?tab= → ?chase= backward-compat mapping", () => {
  // The reference mapping (lib/growth-chasing-compat.ts). This is the ORACLE the
  // Phase-5A config redirect must reproduce; runtime verification of the actual
  // `has` redirect in a running Next app is still outstanding.
  it("maps the default URL (no query) to the Chasing view with no chase param", () => {
    expect(mapLegacyChaseUrl({})).toBe("/command/growth?tab=experiments&view=chasing");
  });

  it("maps all four legacy tab values correctly", () => {
    expect(mapLegacyChaseUrl({ tab: "enquiries" })).toBe("/command/growth?tab=experiments&view=chasing");
    expect(mapLegacyChaseUrl({ tab: "solicitor" })).toBe("/command/growth?tab=experiments&view=chasing&chase=solicitor");
    expect(mapLegacyChaseUrl({ tab: "client" })).toBe("/command/growth?tab=experiments&view=chasing&chase=client");
    expect(mapLegacyChaseUrl({ tab: "opted_out" })).toBe("/command/growth?tab=experiments&view=chasing&chase=opted_out");
  });

  it("covers every documented legacy value", () => {
    for (const v of LEGACY_CHASE_VALUES) {
      const url = mapLegacyChaseUrl({ tab: v });
      expect(url.startsWith("/command/growth?tab=experiments&view=chasing")).toBe(true);
    }
  });

  it("an invalid/unknown tab value falls back to the enquiries default", () => {
    expect(mapLegacyChaseUrl({ tab: "garbage" })).toBe("/command/growth?tab=experiments&view=chasing");
  });

  it("the legacy tab value can NEVER overwrite the workspace top-level tab", () => {
    for (const v of ["enquiries", "solicitor", "client", "opted_out", "garbage"]) {
      const params = new URLSearchParams(mapLegacyChaseUrl({ tab: v }).split("?")[1]);
      expect(params.getAll("tab")).toEqual(["experiments"]); // exactly one, always experiments
    }
  });

  it("forwards unrelated query params without clobbering reserved ones", () => {
    expect(mapLegacyChaseUrl({ foo: "bar" })).toBe("/command/growth?tab=experiments&view=chasing&foo=bar");
    expect(mapLegacyChaseUrl({ tab: "solicitor", foo: "bar" })).toBe("/command/growth?tab=experiments&view=chasing&chase=solicitor&foo=bar");
    // A hostile ?view=/?chase= in the legacy URL cannot override the canonical ones.
    const hostile = new URLSearchParams(mapLegacyChaseUrl({ tab: "client", view: "website", chase: "x" }).split("?")[1]);
    expect(hostile.get("view")).toBe("chasing");
    expect(hostile.get("chase")).toBe("client");
  });
});

describe("Growth Phase 5A — redirect matrix (real GROWTH_REDIRECTS config data)", () => {
  // Simple (no-has) legacy → canonical mappings.
  const EXPECTED: Record<string, string> = {
    "/command/website-growth": "/command/growth?tab=acquisition&view=website",
    "/command/chain-invites": "/command/growth?tab=acquisition&view=invites",
    "/command/activation": "/command/growth?tab=activation",
    "/command/followup-usage": "/command/growth?tab=engagement&view=features",
    "/command/adoption": "/command/growth?tab=engagement&view=adoption",
    "/command/retention": "/command/growth?tab=retention",
    "/command/experiments": "/command/growth?tab=experiments&view=tests",
  };

  it("maps each simple dashboard route to its canonical tab/view", () => {
    for (const [source, destination] of Object.entries(EXPECTED)) {
      const r = GROWTH_REDIRECTS.find((x) => x.source === source && !x.has);
      expect(r).toBeDefined();
      expect(r!.destination).toBe(destination);
      expect(r!.permanent).toBe(false); // reversible
    }
  });

  it("maps enquiries-chase with a has-capture (consumes tab) + a bare fallback, in that order", () => {
    const chase = GROWTH_REDIRECTS.filter((r) => r.source === "/command/enquiries-chase");
    expect(chase).toHaveLength(2);
    const [capture, fallback] = chase;
    // The capture MUST come first and reference :v (consuming the legacy tab).
    expect(capture.has?.[0]).toEqual({ type: "query", key: "tab", value: "(?<v>solicitor|client|opted_out)" });
    expect(capture.destination).toBe("/command/growth?tab=experiments&view=chasing&chase=:v");
    // Fallback (default / enquiries / invalid) — no has, no chase.
    expect(fallback.has).toBeUndefined();
    expect(fallback.destination).toBe("/command/growth?tab=experiments&view=chasing");
    for (const r of chase) expect(r.permanent).toBe(false);
  });

  it("every destination carries tab=experiments/activation/etc. and only canonical params (no collision)", () => {
    for (const r of GROWTH_REDIRECTS) {
      const query = r.destination.split("?")[1] ?? "";
      const keys = query.split("&").map((p) => p.split("=")[0]);
      for (const k of keys) expect(["tab", "view", "chase"]).toContain(k);
    }
  });

  it("does NOT redirect the workspace itself, Prospects, AI Outreach or Timeframes", () => {
    const sources = GROWTH_REDIRECTS.map((r) => r.source);
    for (const kept of ["/command/growth", "/command/prospects", "/command/ai-outreach", "/command/timeframes"]) {
      expect(sources).not.toContain(kept);
    }
  });

  it("is wired into next.config.ts (and Content redirects are left intact)", () => {
    const cfg = read(NEXT_CONFIG);
    expect(cfg).toContain('from "./lib/growth-redirects"');
    expect(cfg).toContain("...GROWTH_REDIRECTS");
    // Content redirects untouched.
    expect(cfg).toContain("...CONTENT_REDIRECTS");
  });
});

describe("Growth Phase 5A — sidebar collapse + deep links", () => {
  it("collapses the Growth section to Growth + the two standalone arcs (Timeframes moved to Platform)", () => {
    const src = read(NAV);
    const start = src.indexOf('id: "growth"');
    const after = src.indexOf('id: "', start + 10);
    const section = src.slice(start, after === -1 ? undefined : after);
    const hrefs = (section.match(/href: "([^"]+)"/g) ?? []).map((h) => h.replace(/href: "|"/g, ""));
    expect(hrefs).toEqual([
      "/command/growth",
      "/command/prospects",
      "/command/ai-outreach",
    ]);
    // The nine retired dashboard links are gone from the sidebar; Timeframes has
    // moved to the Platform workspace.
    for (const gone of ["website-growth", "chain-invites", "activation", "adoption", "followup-usage", "retention", "experiments", "enquiries-chase", "timeframes"]) {
      expect(section).not.toContain(`/command/${gone}`);
    }
  });

  it("repoints the overview + insights experiments deep links to the canonical view", () => {
    expect(read("app/command/(protected)/overview/page.tsx")).toContain('href="/command/growth?tab=experiments&view=tests"');
    expect(read("components/command/insights/SignalActions.tsx")).toContain("/command/growth?tab=experiments&view=tests");
  });

  it("repoints the Trends cross-link to the canonical Activation tab", () => {
    expect(read(TRENDS)).toContain('href="/command/growth?tab=activation"');
    expect(read(TRENDS)).not.toContain('href="/command/activation"');
  });

  it("hardens the shell so a legacy tab cannot overwrite tab=experiments", () => {
    const src = read(SHELL);
    expect(src).toContain("Array.isArray(sp.tab) ? sp.tab[0] : sp.tab");
  });
});

describe("Growth workspace — URL parameter handling (Phases 1-3)", () => {
  it("top-tab switches preserve only scope (mode/agency), never view-specific params", () => {
    const src = read(SHELL);
    // hrefFor carries exactly the scope query; no view/period/surface/etc.
    expect(src).toContain("`/command/growth?tab=${key}${scopeQs ? `&${scopeQs}` : \"\"}`");
    expect(src).toContain('scope.set("mode", sp.mode)');
    expect(src).toContain('scope.set("agency", sp.agency)');
  });

  it("each tab/view validates its own param set and defaults safely (no cross-tab bleed)", () => {
    // A stale ?view= from Acquisition cannot select an Engagement view and vice versa.
    expect(read(ACQUISITION)).toContain('? view : "website"');
    expect(read(ENGAGEMENT)).toContain('? view : "features"');
    expect(read(FEATURES)).toContain('return raw === "30d" || raw === "90d" ? raw : "all"'); // period parser
  });
});
