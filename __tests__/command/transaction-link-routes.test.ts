/**
 * @jest-environment node
 *
 * Regression guard for the Slice-1 broken-link fix.
 *
 * The Command Centre is used by superadmin / hybrid-superadmin accounts. The
 * middleware only redirects the bare `/transactions/:id` path to
 * `/agent/transactions/:id` for `director`/`negotiator` (who cannot even reach
 * `/command/*`). So any bare `/transactions/${...}` link in a Command Centre
 * surface 404s for its actual audience. Every such link must be written as
 * `/agent/transactions/${...}` (the canonical file view, reachable by all
 * authenticated roles). This test fails if a bare one is ever (re)introduced.
 */

import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const ROOTS = ["app/command", "components/command"];
const NEEDLE = "/transactions/${";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("Command Centre file links resolve for superadmin/hybrid users", () => {
  it("has no bare /transactions/${...} links (all must be /agent/transactions/...)", () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const src = readFileSync(file, "utf8");
        let i = src.indexOf(NEEDLE);
        while (i !== -1) {
          const before = src.slice(Math.max(0, i - "/agent".length), i);
          if (before !== "/agent") offenders.push(file);
          i = src.indexOf(NEEDLE, i + 1);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
