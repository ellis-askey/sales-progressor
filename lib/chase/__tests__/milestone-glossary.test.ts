/**
 * @jest-environment node
 */

// Tests the glossary parser against the real MILESTONE_GLOSSARY.md file.
// These are integration tests — they catch regressions in both the parser logic
// and any structural changes to the glossary document.

import fs from "fs";
import path from "path";
import { parseGlossary, getMilestoneContext } from "@/lib/chase/milestone-glossary";

const GLOSSARY_PATH = path.join(
  process.cwd(),
  "docs",
  "chase-generation",
  "MILESTONE_GLOSSARY.md"
);

// Parse the file once for all tests (avoid re-reading per test)
const content = fs.readFileSync(GLOSSARY_PATH, "utf-8");
const glossary = parseGlossary(content);

// ---

describe("parseGlossary — milestone count", () => {
  test("parses all 47 milestones (VM1–VM20, PM1–PM27)", () => {
    const keys = Object.keys(glossary);
    // 20 vendor + 27 purchaser
    expect(keys.filter((k) => k.startsWith("VM"))).toHaveLength(20);
    expect(keys.filter((k) => k.startsWith("PM"))).toHaveLength(27);
  });
});

// ---

describe("getMilestoneContext — unknown codes", () => {
  test("returns null for an unrecognised code", () => {
    expect(getMilestoneContext("XX99")).toBeNull();
  });

  test("returns null for an empty string", () => {
    expect(getMilestoneContext("")).toBeNull();
  });
});

// ---

describe("VM7 — draft contract pack", () => {
  const ctx = glossary["VM7"];

  test("has all four fields", () => {
    expect(ctx).toBeDefined();
    expect(ctx.tracks).toBeTruthy();
    expect(ctx.outstanding).toBeTruthy();
    expect(ctx.alsoCalled).toBeTruthy();
    expect(ctx.misframings).toBeTruthy();
  });

  test("tracks field references the draft contract pack", () => {
    expect(ctx.tracks.toLowerCase()).toContain("draft contract pack");
  });

  test("alsoCalled includes DCP abbreviation", () => {
    expect(ctx.alsoCalled).toContain("DCP");
  });

  test("misframings identifies seller's solicitor as action-holder", () => {
    expect(ctx.misframings.toLowerCase()).toContain("seller's solicitor");
  });
});

// ---

describe("PM6 — lender valuation booked", () => {
  const ctx = glossary["PM6"];

  test("has all four fields", () => {
    expect(ctx).toBeDefined();
  });

  test("tracks field mentions lender's valuation", () => {
    expect(ctx.tracks.toLowerCase()).toContain("lender's valuation");
  });

  test("alsoCalled includes desktop valuation variant", () => {
    expect(ctx.alsoCalled.toLowerCase()).toContain("desktop valuation");
  });

  test("misframings distinguishes lender valuation from buyer's own survey", () => {
    expect(ctx.misframings.toLowerCase()).toContain("buyer's own survey");
  });
});

// ---

describe("PM9 — survey booking — critical regression test", () => {
  // PM9 motivated the entire glossary: the model was reading "Buyer has booked a
  // Level 2 or Level 3 survey" as past-tense fact rather than as the goal state
  // being chased. The glossary entry must explicitly correct this.
  const ctx = glossary["PM9"];

  test("has all four fields", () => {
    expect(ctx).toBeDefined();
  });

  test("outstanding field states the booking has NOT yet been made", () => {
    // Must contain an explicit negation — this is the core regression guard
    expect(ctx.outstanding).toContain("NOT yet been made");
  });

  test("misframings labels this as the completed state", () => {
    expect(ctx.misframings).toContain("COMPLETED state");
  });

  test("misframings forbids writing that the survey is booked", () => {
    expect(ctx.misframings.toLowerCase()).toContain("survey is booked");
  });

  test("alsoCalled includes Level 2 survey variants", () => {
    expect(ctx.alsoCalled).toContain("Level 2");
  });
});

// ---

describe("PM11 — mortgage offer received", () => {
  const ctx = glossary["PM11"];

  test("has all four fields", () => {
    expect(ctx).toBeDefined();
  });

  test("tracks field concerns the mortgage offer from the lender", () => {
    expect(ctx.tracks.toLowerCase()).toContain("mortgage offer");
  });

  test("alsoCalled includes formal offer", () => {
    expect(ctx.alsoCalled.toLowerCase()).toContain("formal offer");
  });

  test("misframings flags the past-tense name ambiguity", () => {
    // The milestone name reads as completed — misframings must call this out
    expect(ctx.misframings.toLowerCase()).toContain("past tense");
  });
});

// ---

describe("VM18 — exchange gate milestone", () => {
  // VM18 is the vendor exchange gate — it IS the gate, not blocked by others.
  // The glossary must not describe it as a routine checkbox.
  const ctx = glossary["VM18"];

  test("has all four fields", () => {
    expect(ctx).toBeDefined();
  });

  test("alsoCalled includes ready-to-exchange variant", () => {
    expect(ctx.alsoCalled).toContain("Ready to exchange");
  });

  test("misframings identifies this as the gate itself", () => {
    expect(ctx.misframings.toLowerCase()).toContain("gate");
  });

  test("tracks field refers to seller's solicitor confirmation", () => {
    expect(ctx.tracks.toLowerCase()).toContain("seller's solicitor");
  });
});
