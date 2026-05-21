// lib/chase/milestone-glossary.ts
//
// Parses docs/chase-generation/MILESTONE_GLOSSARY.md at module load and exposes
// per-milestone context for injection into the AI chase prompt (§6, PROMPT_SPEC.md).
//
// Runtime choice: fs.readFileSync at module initialisation rather than build-time
// codegen. Rationale: the glossary is updated by Ellis (not by a build step), so
// reading at startup means a Vercel redeploy always picks up the latest version
// without a separate generation script. On Vercel, Next.js API routes run in Node.js
// serverless functions with access to the full project directory at process.cwd(),
// so no special bundling config is required.
//
// Only four fields are exported — the runtime-prompt fields. Side, Blocks exchange,
// Who is responsible, and Typical chase context are human-reference fields and are
// deliberately excluded here.

import fs from "fs";
import path from "path";

export interface MilestoneContext {
  tracks: string;
  outstanding: string;
  alsoCalled: string;
  misframings: string;
}

function parseGlossary(content: string): Record<string, MilestoneContext> {
  const result: Record<string, MilestoneContext> = {};

  // Split on level-3 headings (### VMn — … or ### PMn — …)
  // Each section starts with the heading text (sans the leading "### ")
  const sections = content.split(/^### /m);

  for (const section of sections) {
    const firstLine = section.split("\n")[0];
    // Extract code like "VM1" or "PM25" from "VM1 — Seller has instructed…"
    const codeMatch = firstLine.match(/^((?:VM|PM)\d+)\s*—/);
    if (!codeMatch) continue;

    const code = codeMatch[1];
    const fields: Record<string, string> = {};

    for (const line of section.split("\n")) {
      if (!line.trimStart().startsWith("|")) continue;

      const parts = line.split("|");
      // Rows have at least 4 parts: ['', ' **Field** ', ' Value ', '']
      if (parts.length < 4) continue;

      // Strip bold markers from field names and values
      const rawField = parts[1].replace(/\*\*/g, "").trim();
      // Rejoin remaining parts in case the cell value itself contains "|"
      const rawValue = parts
        .slice(2, -1)
        .join("|")
        .replace(/\*\*/g, "")
        .trim();

      // Skip the header row and separator row
      if (
        !rawField ||
        rawField === "Field" ||
        rawField === "---" ||
        !rawValue ||
        rawValue === "Value" ||
        rawValue === "---"
      ) {
        continue;
      }

      fields[rawField] = rawValue;
    }

    const tracks = fields["What this milestone tracks"];
    const outstanding = fields['What "outstanding" means'];
    const alsoCalled = fields["Also called"];
    const misframings = fields["Common misframings to avoid"];

    if (tracks && outstanding && alsoCalled && misframings) {
      result[code] = { tracks, outstanding, alsoCalled, misframings };
    }
  }

  return result;
}

// Resolved once at module load. On Vercel, next.config.ts bundles this file via
// outputFileTracingIncludes for the /api/ai/generate-chase route.
const GLOSSARY_PATH = path.join(
  process.cwd(),
  "docs",
  "chase-generation",
  "MILESTONE_GLOSSARY.md"
);

const glossaryMap: Record<string, MilestoneContext> = (() => {
  try {
    const content = fs.readFileSync(GLOSSARY_PATH, "utf-8");
    const parsed = parseGlossary(content);
    return parsed;
  } catch (err) {
    console.warn("[milestone-glossary] Could not load glossary:", String(err));
    return {};
  }
})();

export function getMilestoneContext(code: string): MilestoneContext | null {
  return glossaryMap[code] ?? null;
}

// First quoted alias from the milestone's "Also called" row — the snappy
// label the agent would actually use ("searches ordered", "survey", "DCP").
// Reused by the chain bottleneck banner (Change 4 of the visibility-pass)
// so banner copy and chase-AI prompts stay on a single source of truth.
// Returns null if the milestone isn't in the glossary or its alsoCalled row
// has no quoted strings. Caller is responsible for grammar (the banner
// renders it in colon form: "Hold-up: {label}." — no article required).
export function getMilestoneShortLabel(code: string): string | null {
  const ctx = glossaryMap[code];
  if (!ctx) return null;
  const match = ctx.alsoCalled.match(/"([^"]+)"/);
  if (!match) return null;
  // Lowercase the first character so it reads cleanly after a colon.
  const first = match[1];
  return first.charAt(0).toLowerCase() + first.slice(1);
}

// Exported for unit-testing the parser without relying on the file path
export { parseGlossary };
