/**
 * @jest-environment node
 *
 * Platform consolidation regression guard. Seven areas (incl. Timeframes, moved
 * from Growth) become the Emails / Updates / Chasing / Engine tabs of
 * /command/platform. Static guard only — locks the shell, redirect map, sidebar
 * collapse, Timeframes move, retirement, link repoints and preserved write
 * wiring. Live email/chasing/automation behaviour is untouched by design and not
 * exercised here.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PLATFORM_REDIRECTS } from "@/lib/platform-redirects";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const gone = (p: string) => !existsSync(join(process.cwd(), p));

const SHELL = "app/command/(protected)/platform/page.tsx";
const NAV = "components/command/workspace-nav.ts";
const NEXT_CONFIG = "next.config.ts";
const EMAILS_TAB = "components/command/platform/tabs/EmailsTab.tsx";
const ENGINE_TAB = "components/command/platform/tabs/EngineTab.tsx";
const TIMEFRAMES = "components/command/platform/engine/TimeframesView.tsx";

describe("Platform — tabbed workspace shell", () => {
  it("exposes the four tabs (Emails default, Updates, Chasing, Engine), lazily gated", () => {
    const src = read(SHELL);
    for (const k of ["emails", "updates", "chasing", "engine"]) expect(src).toContain(`key: "${k}"`);
    expect(src).toContain('? rawTab : "emails"');
    expect(src).toContain('active === "emails" && <EmailsTab');
    expect(src).toContain('active === "updates" && <UpdatesView');
    expect(src).toContain('active === "chasing" && <ChasingView');
    expect(src).toContain('active === "engine" && (');
    expect(src).toContain("Array.isArray(sp.tab) ? sp.tab[0] : sp.tab");
  });

  it("Emails has 3 views; Engine has 2 (Rules + Timeframes)", () => {
    const emails = read(EMAILS_TAB);
    for (const v of ["catalogue", "milestones", "templates"]) expect(emails).toContain(`key: "${v}"`);
    const engine = read(ENGINE_TAB);
    for (const v of ["rules", "timeframes"]) expect(engine).toContain(`key: "${v}"`);
  });
});

describe("Platform — redirect map (real PLATFORM_REDIRECTS, incl. Timeframes move)", () => {
  const EXPECTED: Record<string, string> = {
    "/command/emails": "/command/platform?tab=emails&view=catalogue",
    "/command/milestone-emails": "/command/platform?tab=emails&view=milestones",
    "/command/email-templates": "/command/platform?tab=emails&view=templates",
    "/command/milestone-updates": "/command/platform?tab=updates",
    "/command/solicitor-chase": "/command/platform?tab=chasing",
    "/command/rules": "/command/platform?tab=engine&view=rules",
    "/command/timeframes": "/command/platform?tab=engine&view=timeframes",
  };

  it("maps every landing (and Timeframes) to its canonical tab/view (302)", () => {
    const actual: Record<string, string> = {};
    for (const r of PLATFORM_REDIRECTS) { actual[r.source] = r.destination; expect(r.permanent).toBe(false); }
    expect(actual).toEqual(EXPECTED);
  });

  it("destinations use only canonical tab/view params", () => {
    for (const r of PLATFORM_REDIRECTS) {
      const keys = (r.destination.split("?")[1] ?? "").split("&").map((p) => p.split("=")[0]);
      for (const k of keys) expect(["tab", "view"]).toContain(k);
    }
  });

  it("is wired into next.config.ts alongside the other workspace redirects", () => {
    const cfg = read(NEXT_CONFIG);
    expect(cfg).toContain('from "./lib/platform-redirects"');
    expect(cfg).toContain("...PLATFORM_REDIRECTS");
    for (const spread of ["...CONTENT_REDIRECTS", "...GROWTH_REDIRECTS", "...MONEY_REDIRECTS", "...OPERATIONS_REDIRECTS"]) {
      expect(cfg).toContain(spread);
    }
  });
});

describe("Platform — sidebar + Timeframes move + retirement", () => {
  it("collapses the Platform section to a single /command/platform entry", () => {
    const src = read(NAV);
    const start = src.indexOf('id: "platform"');
    const after = src.indexOf('id: "', start + 10);
    const section = src.slice(start, after === -1 ? undefined : after);
    const hrefs = (section.match(/href: "([^"]+)"/g) ?? []).map((h) => h.replace(/href: "|"/g, ""));
    expect(hrefs).toEqual(["/command/platform"]);
  });

  it("removed Timeframes from the Growth section", () => {
    const src = read(NAV);
    const start = src.indexOf('id: "growth"');
    const after = src.indexOf('id: "', start + 10);
    expect(src.slice(start, after)).not.toContain("/command/timeframes");
  });

  it("retires the seven landing pages but keeps emails/ (EmailCatalogue.tsx + actions.ts)", () => {
    for (const p of ["emails", "milestone-emails", "email-templates", "milestone-updates", "solicitor-chase", "rules", "timeframes"]) {
      expect(gone(`app/command/(protected)/${p}/page.tsx`)).toBe(true);
    }
    expect(existsSync(join(process.cwd(), "app/command/(protected)/emails/EmailCatalogue.tsx"))).toBe(true);
    expect(existsSync(join(process.cwd(), "app/command/(protected)/emails/actions.ts"))).toBe(true);
  });
});

describe("Platform — preserved functionality + repoints", () => {
  it("every editor/reference component is rendered in its view (nothing dropped)", () => {
    expect(read("components/command/platform/email/CatalogueView.tsx")).toContain("<EmailCatalogue");
    expect(read("components/command/platform/email/MilestoneEmailsView.tsx")).toContain("<MilestoneEmailsMatrix");
    expect(read("components/command/platform/email/TemplatesView.tsx")).toContain("<PlatformEmailTemplatesEditor");
    expect(read("components/command/platform/UpdatesView.tsx")).toContain("<MilestoneUpdatesEditor");
    expect(read("components/command/platform/ChasingView.tsx")).toContain("<SolicitorCadencePanel");
    expect(read("components/command/platform/engine/RulesView.tsx")).toContain("<RulesTabs");
  });

  it("Timeframes repoints its filter links to the canonical Engine view", () => {
    const src = read(TIMEFRAMES);
    expect(src).toContain("/command/platform?${p.toString()}");
    expect(src).toContain('p.set("tab", "engine")');
    expect(src).toContain('p.set("view", "timeframes")');
    expect(src).not.toContain('"/command/timeframes?');
  });

  it("repoints the settings + agency-controls deep links to the canonical tabs", () => {
    // Settings' Rules tile now lives in the System workspace's SettingsView (the
    // old /command/settings landing was retired in the System consolidation).
    expect(read("components/command/system/SettingsView.tsx")).toContain('href="/command/platform?tab=engine&view=rules"');
    expect(read("components/command/agencies/AgencyControlsMatrix.tsx")).toContain('href="/command/platform?tab=chasing"');
  });
});
