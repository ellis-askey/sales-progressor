// Prod-only runner for the v4 terms rephrase.
//
// Mirrors the .env.production-loading + prod-project-id guard pattern from
// migrate-prod.mjs. Loads .env.production (NOT shell env, NOT .env), checks
// the resolved DATABASE_URL points at the prod Supabase project, then
// exec's the idempotent rephrase script with DATABASE_URL set in env.
//
// The rephrase itself lives in scripts/update-v4-terms-rephrase-2026-06-01.ts
// (compare-and-swap, no-ops if bodySections already match). This wrapper
// exists so the user doesn't have to copy/paste the prod URL into a shell.
//
// Usage:  node scripts/update-prod-v4-terms-rephrase.mjs

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const EXPECTED_PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";
const ENV_PROD = resolve(".", ".env.production");
const REPHRASE_SCRIPT = "scripts/update-v4-terms-rephrase-2026-06-01.ts";

if (!existsSync(ENV_PROD)) {
  console.error(`ABORT: ${ENV_PROD} does not exist.`);
  process.exit(1);
}

const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);
const text = stripBom(readFileSync(ENV_PROD, "utf8"));

function getVar(content, key) {
  const re = new RegExp(`^${key}\\s*=\\s*(.+)$`, "m");
  const m = content.match(re);
  if (!m) return null;
  return m[1].replace(/^["']|["']$/g, "");
}

const PROJECT_ID_RE = /(?:postgres\.|db\.)([a-z0-9]{20})/;
function projectIdOf(url) {
  const m = url?.match(PROJECT_ID_RE);
  return m ? m[1] : "UNKNOWN";
}

const dbUrl = getVar(text, "DATABASE_URL");
if (!dbUrl) {
  console.error("ABORT: DATABASE_URL not found in .env.production.");
  process.exit(1);
}
const proj = projectIdOf(dbUrl);
if (proj !== EXPECTED_PROD_PROJECT_ID) {
  console.error(`ABORT: resolved project id (${proj}) is not prod (${EXPECTED_PROD_PROJECT_ID}).`);
  process.exit(1);
}

console.log("");
console.log("=========================================================");
console.log(`  Rephrasing v4 TermsVersion on PRODUCTION (${proj})`);
console.log("=========================================================");

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  [
    "ts-node",
    "--compiler-options",
    JSON.stringify({
      module: "CommonJS",
      esModuleInterop: true,
      baseUrl: ".",
      paths: { "@/*": ["./*"] },
    }),
    "--require",
    "tsconfig-paths/register",
    REPHRASE_SCRIPT,
  ],
  {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  },
);

process.exit(result.status ?? 1);
