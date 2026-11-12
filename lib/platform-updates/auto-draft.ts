import "server-only";
import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/anthropic";
import type { PlatformUpdateCategory, PlatformUpdateAudience } from "@prisma/client";
import { fetchCommitsBetween, type ReleaseCommit } from "./github";
import { filterNoise } from "./classify";

// Phase 3 core: turn ONE production release into HIDDEN auto-drafts. Pure
// orchestration; dedup + scheduling live in the cron. The ONLY thing that throws
// here is a GitHub fetch failure (so the cron can retry without recording). All
// other outcomes return a result with record=true so the release is marked done.

const CATEGORIES: PlatformUpdateCategory[] = ["new_feature", "improvement", "moved"];
const AUDIENCES: PlatformUpdateAudience[] = ["everyone", "agency_staff", "progression_business", "tsp_internal"];
const MAX_COMMITS_TO_AI = 60; // cap tokens on a very large release

export type ProcessResult = {
  drafts: number;
  considered: number;
  note: string;
  // Whether the cron should mark this release processed. False only when there's
  // no token yet (so nothing is lost — it catches up once the token is added).
  record: boolean;
};

type AiFeature = {
  title: string;
  description: string;
  category: string;
  audience: string;
  commitShas: string[];
};

const SYSTEM = `You turn a software team's git commits into DRAFT product announcements for a UK estate-agency SaaS called The Sales Progressor. Its users are estate agents and independent sales progressors (NOT home buyers or sellers).

Rules:
- GROUP related commits into FEATURES. One announcement per feature, never one per commit.
- Decide what is worth telling users about based on USER-FACING IMPACT, not the commit type. A "fix" or "refactor" that changes what users see or do CAN be worth announcing; a purely internal change is NOT.
- OUTPUT NOTHING for: internal refactors with no visible change, tests/CI/build/tooling, dependency changes, security fixes, infrastructure, and anything where you are not confident a real user-facing change shipped.
- Write plain, friendly English. Describe ONLY what the commits actually say was done. NEVER invent features, benefits, or numbers.
- category: "new_feature" (something new), "improvement" (an existing thing got better), or "moved" (something relocated or renamed).
- audience: "everyone" (all app users), "agency_staff" (estate agents), "progression_business" (independent progression companies), or "tsp_internal" (internal staff only). Use "everyone" unless a change clearly affects only one group; internal-only tools are "tsp_internal".
- commitShas: the short SHAs (from the list) that make up each feature.

Respond with STRICT JSON only, no prose, no code fences:
{"features":[{"title":"...","description":"...","category":"improvement","audience":"everyone","commitShas":["abc12345"]}]}
If nothing is worth announcing, respond {"features":[]}. Titles under 60 characters; descriptions 1 to 2 sentences.`;

function buildUserMessage(commits: ReleaseCommit[]): string {
  const lines = commits.slice(0, MAX_COMMITS_TO_AI).map((c) => {
    const body = c.body ? ` -- ${c.body.replace(/\s+/g, " ").slice(0, 220)}` : "";
    return `- [${c.sha.slice(0, 8)}] ${c.subject}${body}`;
  });
  return `These commits shipped to production. Group them and draft announcements per the rules.\n\n${lines.join("\n")}`;
}

function parseFeatures(raw: string): AiFeature[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return [];
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as { features?: unknown };
    const feats = Array.isArray(obj.features) ? obj.features : [];
    const out: AiFeature[] = [];
    for (const f of feats) {
      if (!f || typeof f !== "object") continue;
      const r = f as Record<string, unknown>;
      const title = typeof r.title === "string" ? r.title.trim() : "";
      if (!title) continue;
      out.push({
        title,
        description: typeof r.description === "string" ? r.description : "",
        category: typeof r.category === "string" ? r.category : "improvement",
        audience: typeof r.audience === "string" ? r.audience : "everyone",
        commitShas: Array.isArray(r.commitShas) ? r.commitShas.map((s) => String(s)) : [],
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function processProductionRelease(opts: {
  headSha: string;
  baseSha: string | null;
}): Promise<ProcessResult> {
  const { headSha, baseSha } = opts;

  // First ever run: set the baseline only. Never draft the whole history.
  if (!baseSha) {
    return { drafts: 0, considered: 0, note: "baseline set (first run)", record: true };
  }

  // May throw (GitHub down) — intentionally propagates so the cron retries
  // without recording. null = no token: do NOT record, so it catches up later.
  const commits = await fetchCommitsBetween(baseSha, headSha);
  if (commits === null) {
    return { drafts: 0, considered: 0, note: "no GitHub token yet", record: false };
  }

  const meaningful = filterNoise(commits);
  if (meaningful.length === 0) {
    return { drafts: 0, considered: 0, note: `${commits.length} commits, all filtered`, record: true };
  }

  // AI failures (incl. the global AI kill-switch) are swallowed: record the
  // release so we don't re-spend tokens on the same range next run.
  let features: AiFeature[] = [];
  try {
    const out = await callClaude(SYSTEM, buildUserMessage(meaningful), 1500);
    features = parseFeatures(out);
  } catch {
    return { drafts: 0, considered: meaningful.length, note: "AI unavailable (recorded)", record: true };
  }

  let drafts = 0;
  for (const f of features) {
    const category = (CATEGORIES.includes(f.category as PlatformUpdateCategory) ? f.category : "improvement") as PlatformUpdateCategory;
    const audience = (AUDIENCES.includes(f.audience as PlatformUpdateAudience) ? f.audience : "everyone") as PlatformUpdateAudience;
    const shas = f.commitShas.slice(0, 50);
    // Internal-only technical note: the raw commit subjects for this feature.
    const matched = meaningful.filter((c) =>
      shas.some((s) => c.sha.startsWith(s) || s.startsWith(c.sha.slice(0, 8))),
    );
    const tech = (matched.length ? matched : meaningful)
      .map((c) => `${c.sha.slice(0, 8)} ${c.subject}`)
      .join("\n")
      .slice(0, 5000);

    await prisma.platformUpdate.create({
      data: {
        title: f.title.slice(0, 200),
        body: f.description.trim().slice(0, 5000),
        category,
        audience,
        status: "draft", // Hidden — never auto-published
        origin: "auto",
        sourceReleaseSha: headSha,
        sourceShas: shas,
        technicalSummary: tech,
        publishedAt: null,
      },
    });
    drafts++;
  }

  return {
    drafts,
    considered: meaningful.length,
    note: `${commits.length} commits, ${meaningful.length} meaningful, ${drafts} drafts`,
    record: true,
  };
}
