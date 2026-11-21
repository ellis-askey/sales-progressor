/**
 * @jest-environment node
 *
 * System consolidation regression guard (final Command Centre section). Six
 * entries become the Monitoring / Updates / Critique / Settings tabs of
 * /command/system. Static guard only — locks the shell, redirect map, sidebar
 * collapse, retirement, link repoints and preserved write/diagnostic wiring.
 * System monitoring/logging/diagnostics behaviour is untouched by design and not
 * exercised here.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { SYSTEM_REDIRECTS } from "@/lib/system-redirects";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const gone = (p: string) => !existsSync(join(process.cwd(), p));

const SHELL = "app/command/(protected)/system/page.tsx";
const NAV = "components/command/workspace-nav.ts";
const NEXT_CONFIG = "next.config.ts";
const MON_TAB = "components/command/system/tabs/MonitoringTab.tsx";
const ACTIVITY = "components/command/system/monitoring/ActivityView.tsx";
const AUDIT = "components/command/system/monitoring/AuditView.tsx";

describe("System — tabbed workspace shell", () => {
  it("exposes the four tabs (Monitoring default, Updates, Critique, Settings), lazily gated", () => {
    const src = read(SHELL);
    for (const k of ["monitoring", "updates", "critique", "settings"]) expect(src).toContain(`key: "${k}"`);
    expect(src).toContain('? rawTab : "monitoring"');
    expect(src).toContain('active === "monitoring" && (');
    expect(src).toContain('active === "updates" && <PlatformUpdatesView');
    expect(src).toContain('active === "critique" && <CritiqueView');
    expect(src).toContain('active === "settings" && <SettingsView');
    expect(src).toContain("Array.isArray(sp.tab) ? sp.tab[0] : sp.tab");
  });

  it("Monitoring has 3 views (Status default, Activity, Audit)", () => {
    const src = read(MON_TAB);
    for (const v of ["status", "activity", "audit"]) expect(src).toContain(`key: "${v}"`);
    expect(src).toContain('? view : "status"');
  });
});

describe("System — redirect map (real SYSTEM_REDIRECTS)", () => {
  const EXPECTED: Record<string, string> = {
    "/command/health": "/command/system?tab=monitoring&view=status",
    "/command/activity": "/command/system?tab=monitoring&view=activity",
    "/command/audit": "/command/system?tab=monitoring&view=audit",
    "/command/updates": "/command/system?tab=updates",
    "/command/critique": "/command/system?tab=critique",
    "/command/settings": "/command/system?tab=settings",
  };

  it("maps every landing to its canonical tab/view (302)", () => {
    const actual: Record<string, string> = {};
    for (const r of SYSTEM_REDIRECTS) { actual[r.source] = r.destination; expect(r.permanent).toBe(false); }
    expect(actual).toEqual(EXPECTED);
  });

  it("does NOT redirect the Settings → Connections detail route", () => {
    expect(SYSTEM_REDIRECTS.map((r) => r.source)).not.toContain("/command/settings/connections");
    for (const r of SYSTEM_REDIRECTS) {
      const keys = (r.destination.split("?")[1] ?? "").split("&").map((p) => p.split("=")[0]);
      for (const k of keys) expect(["tab", "view"]).toContain(k);
    }
  });

  it("is wired into next.config.ts alongside all five other workspace redirects", () => {
    const cfg = read(NEXT_CONFIG);
    expect(cfg).toContain('from "./lib/system-redirects"');
    expect(cfg).toContain("...SYSTEM_REDIRECTS");
    for (const spread of ["...CONTENT_REDIRECTS", "...GROWTH_REDIRECTS", "...MONEY_REDIRECTS", "...OPERATIONS_REDIRECTS", "...PLATFORM_REDIRECTS"]) {
      expect(cfg).toContain(spread);
    }
  });
});

describe("System — sidebar + retirement", () => {
  it("collapses System to the workspace entry + the standalone Reset demo tool", () => {
    const src = read(NAV);
    const start = src.indexOf('id: "system"');
    const section = src.slice(start);
    const hrefs = (section.match(/href: "([^"]+)"/g) ?? []).slice(0, 2).map((h) => h.replace(/href: "|"/g, ""));
    expect(hrefs).toEqual(["/command/system", "/command/admin/demo"]);
  });

  it("retires the six landing pages but keeps the Connections detail route", () => {
    for (const p of ["health", "activity", "audit", "updates", "critique", "settings"]) {
      expect(gone(`app/command/(protected)/${p}/page.tsx`)).toBe(true);
    }
    expect(existsSync(join(process.cwd(), "app/command/(protected)/settings/connections/page.tsx"))).toBe(true);
  });
});

describe("System — preserved functionality + repoints", () => {
  it("every monitoring/founder component is rendered (nothing dropped)", () => {
    expect(read("components/command/system/monitoring/StatusView.tsx")).toContain("getRecentSendFailures");
    expect(read(ACTIVITY)).toContain("<AutoRefresh"); // existing 30s refresh preserved
    expect(read(AUDIT)).toContain("commandDb.adminAuditLog.findMany");
    expect(read("components/command/system/PlatformUpdatesView.tsx")).toContain("<PlatformUpdatesManager");
    expect(read("components/command/system/CritiqueView.tsx")).toContain("<CritiqueReview");
    expect(read("components/command/system/SettingsView.tsx")).toContain("<AiMasterSwitch");
  });

  it("Activity + Audit repoint their filter links to the canonical views", () => {
    const act = read(ACTIVITY);
    expect(act).toContain('p.set("tab", "monitoring")');
    expect(act).toContain('p.set("view", "activity")');
    expect(act).toContain("/command/operations?tab=files&tx="); // feed file link (Files moved to Operations)
    expect(act).not.toContain('"/command/activity?');
    const aud = read(AUDIT);
    expect(aud).toContain('action="/command/system"'); // GET form repointed
    expect(aud).toContain('<input type="hidden" name="tab" value="monitoring" />');
    expect(aud).not.toContain('"/command/audit?');
  });

  it("Settings repoints the Activity-log tile; Connections back-link repointed", () => {
    expect(read("components/command/system/SettingsView.tsx")).toContain('href="/command/system?tab=monitoring&view=audit"');
    expect(read("app/command/(protected)/settings/connections/page.tsx")).toContain('href="/command/system?tab=settings"');
  });
});
