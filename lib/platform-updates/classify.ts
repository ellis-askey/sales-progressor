import type { ReleaseCommit } from "./github";

// Cheap, deterministic pre-filter so Haiku is never spent on obviously
// irrelevant commits (requirement: avoid unnecessary AI cost). Deliberately
// CONSERVATIVE — it only drops the clearly mechanical/internal. feat, fix,
// refactor, perf and anything else go through to the AI, which judges actual
// USER-FACING impact (a "fix" or "refactor" CAN be worth announcing). Security /
// infrastructure are kept out of user copy by the AI prompt, not dropped here,
// so they're still noticed but never announced with detail.

// Conventional-commit types that are never user-facing announcements.
const NOISE_PREFIX = /^(chore|docs|test|tests|ci|build|style|release|revert|merge|deps|dependabot|renovate|wip)(\(|:|\/|\s|!)/i;
// Phrases that mark a mechanical commit regardless of prefix.
const NOISE_CONTAINS = /\b(wip|lint|prettier|eslint|typo|formatting|bump version|version bump|merge branch|merge pull request|co-authored-by)\b/i;

export function isObviousNoise(c: ReleaseCommit): boolean {
  if (c.isMerge) return true;
  const s = c.subject.trim();
  if (!s) return true;
  if (NOISE_PREFIX.test(s)) return true;
  if (NOISE_CONTAINS.test(s)) return true;
  return false;
}

export function filterNoise(commits: ReleaseCommit[]): ReleaseCommit[] {
  return commits.filter((c) => !isObviousNoise(c));
}
