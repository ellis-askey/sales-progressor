/**
 * @jest-environment node
 *
 * Content consolidation — Phase 4A regression guard.
 *
 * The ten legacy /command/content/* pages now redirect into the single tabbed
 * workspace at /command/content, and the sidebar collapses to one entry. This
 * test locks:
 *   1. every legacy route → its exact canonical destination;
 *   2. query preservation + no param collision (destinations only use the
 *      canonical tab/source/build/view; seeds + errors are forwarded by Next);
 *   3. Create seed links (?item / ?opp / ?thought) are wired through the shell;
 *   4. voice validation errors are DISPLAYED in their canonical views;
 *   5. canonical tab + secondary-view navigation (Ideas/Create/Brand strips);
 *   6. the engagement drill-down route is preserved (NOT redirected);
 *   7. the sidebar has exactly one canonical Content entry.
 *
 * It is a static guard (reads the source + the pure redirect module) — it does
 * not exercise Next's runtime, but Next guarantees config redirects run before
 * filesystem routes and forward the request query onto the destination.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { CONTENT_REDIRECTS } from "@/lib/content-redirects";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const SHELL = "app/command/(protected)/content/page.tsx";
const IDEAS = "components/command/content/tabs/IdeasTab.tsx";
const CREATE = "components/command/content/tabs/CreateTab.tsx";
const BRAND = "components/command/content/tabs/BrandTab.tsx";
const MEASURE = "components/command/content/tabs/MeasureTab.tsx";
const OVERVIEW = "components/command/content/tabs/OverviewTab.tsx";
const NAV = "components/command/workspace-nav.ts";

// The authoritative legacy → canonical map. Changing a redirect must change
// this table (the point of the lock).
const EXPECTED: Record<string, string> = {
  "/command/content/inbox": "/command/content?tab=ideas&source=inbox",
  "/command/content/opportunities": "/command/content?tab=ideas&source=opportunities",
  "/command/content/thoughts": "/command/content?tab=ideas&source=thoughts",
  "/command/content/topics": "/command/content?tab=ideas&source=topics",
  "/command/content/create": "/command/content?tab=create&build=new",
  "/command/content/drafts": "/command/content?tab=create&build=drafts",
  "/command/content/calendar": "/command/content?tab=plan",
  "/command/content/performance": "/command/content?tab=measure",
  "/command/content/strategy": "/command/content?tab=brand&view=strategy",
  "/command/content/brand": "/command/content?tab=brand&view=positioning",
  "/command/content/voice": "/command/content?tab=brand&view=voice",
};

describe("Content Phase 4A — legacy route redirects", () => {
  it("maps every legacy content route to its exact canonical destination", () => {
    const actual: Record<string, string> = {};
    for (const r of CONTENT_REDIRECTS) actual[r.source] = r.destination;
    expect(actual).toEqual(EXPECTED);
  });

  it("is wired into next.config.ts", () => {
    const cfg = read("next.config.ts");
    expect(cfg).toContain('from "./lib/content-redirects"');
    expect(cfg).toContain("...CONTENT_REDIRECTS");
  });

  it("uses reversible 302s (permanent:false) while verifying", () => {
    for (const r of CONTENT_REDIRECTS) expect(r.permanent).toBe(false);
  });

  it("preserves query without collision: sources carry no query; destinations use only canonical params", () => {
    for (const r of CONTENT_REDIRECTS) {
      // Clean exact-match source — no query string to collide on.
      expect(r.source).not.toContain("?");
      expect(r.destination.startsWith("/command/content?")).toBe(true);
      // The seed/error params are forwarded from the request by Next — they must
      // NOT be hard-coded on the destination (that is what would collide).
      const query = r.destination.split("?")[1] ?? "";
      const keys = query.split("&").map((p) => p.split("=")[0]);
      for (const k of keys) expect(["tab", "source", "build", "view"]).toContain(k);
    }
  });

  it("does NOT redirect the canonical workspace, the engagement drill-down, or /think", () => {
    const sources = CONTENT_REDIRECTS.map((r) => r.source);
    expect(sources).not.toContain("/command/content");
    expect(sources.some((s) => s.includes("/engagement"))).toBe(false);
    expect(sources).not.toContain("/think");
  });
});

describe("Content Phase 4A — canonical tabs + secondary views", () => {
  it("the shell exposes all six canonical tabs", () => {
    const src = read(SHELL);
    for (const key of ["overview", "ideas", "create", "plan", "measure", "brand"]) {
      expect(src).toContain(`key: "${key}"`);
    }
  });

  it("Ideas has its source strip; Create its build strip; Brand its view strip", () => {
    expect(read(IDEAS)).toContain("tab=ideas&source=");
    expect(read(CREATE)).toContain("tab=create&build=");
    const brand = read(BRAND);
    expect(brand).toContain("tab=brand&view=");
    for (const v of ["positioning", "strategy", "voice"]) expect(brand).toContain(`key: "${v}"`);
  });
});

describe("Content Phase 4A — seed params survive the shell", () => {
  it("Overview deep-links into Create with an item seed", () => {
    expect(read(OVERVIEW)).toContain("tab=create&build=new&item=");
  });

  it("the shell threads item/opp/thought/error into the Create tab", () => {
    const src = read(SHELL);
    expect(src).toContain("item: sp.item");
    expect(src).toContain("opp: sp.opp");
    expect(src).toContain("thought: sp.thought");
    expect(src).toContain("error: sp.error");
  });
});

describe("Content Phase 4A — validation errors are displayed, not just preserved", () => {
  it("the shell passes the error param to BOTH Brand and Create", () => {
    const src = read(SHELL);
    // Brand voice add-sample redirects to /content/voice?error=empty → Brand/Voice.
    expect(src).toMatch(/BrandTab[^>]*error=\{sp\.error\}/);
    // VoiceIntakePanel save redirects to /content/drafts?error= → Create/Drafts.
    expect(src).toContain("error: sp.error");
  });

  it("the Brand Voice view renders the empty-content error", () => {
    expect(read(BRAND)).toContain('error === "empty"');
  });

  it("the Create Drafts view forwards the error into the voice intake panel", () => {
    const src = read(CREATE);
    expect(src).toContain("DraftsView error={seed.error}");
    expect(src).toContain("<VoiceIntakePanel error={error} />");
  });
});

describe("Content Phase 4B — navigation redirects repointed to canonical (no legacy paths)", () => {
  it("voice-samples actions redirect to canonical workspace URLs", () => {
    const src = read("app/actions/voice-samples.ts");
    expect(src).toContain('redirect("/command/content?tab=create&build=drafts&error=empty")');
    expect(src).toContain('redirect("/command/content?tab=create&build=drafts")');
    expect(src).toContain('redirect("/command/content?tab=brand&view=voice&error=empty")');
    // No legacy redirect() targets remain (revalidatePath is deferred — not asserted).
    expect(src).not.toMatch(/redirect\("\/command\/content\/(drafts|voice)/);
  });

  it("content-engagement returns to the canonical Drafts view", () => {
    const src = read("app/actions/content-engagement.ts");
    expect(src).toContain('redirect("/command/content?tab=create&build=drafts")');
    expect(src).not.toContain('redirect("/command/content/drafts")');
  });

  it("the dead AI-gate sidebar conditional is gone", () => {
    const src = read("components/command/CommandSidebar.tsx");
    expect(src).not.toContain('/command/content/create" && !aiOn');
  });
});

describe("Content Phase 4A — preserved drill-down + collapsed sidebar", () => {
  it("Measure keeps the per-post engagement drill-down link", () => {
    expect(read(MEASURE)).toContain("/command/content/engagement/");
  });

  it("the sidebar Content section collapses to exactly one entry → /command/content", () => {
    const src = read(NAV);
    const start = src.indexOf('id: "content"');
    expect(start).toBeGreaterThan(-1);
    // The content section runs until the next section's `id:` or the array end.
    const after = src.indexOf('id: "', start + 10);
    const section = src.slice(start, after === -1 ? undefined : after);
    const hrefs = section.match(/href: "\/command\/content[^"]*"/g) ?? [];
    expect(hrefs).toEqual(['href: "/command/content"']);
  });
});
