// scripts/migrate-prod.mjs
//
// Guarded prod migration runner. Loads .env.production (NOT shell env, NOT .env),
// validates the resolved DATABASE_URL points at the expected prod project, prints
// the target loudly, and requires explicit "yes" confirmation before exec'ing
// `prisma migrate deploy`.
//
// Background: 2026-05-23, two migrations went straight to prod because the
// Prisma CLI reads .env (which had prod URLs) — staging-first was an illusion.
// .env now points at staging; prod URLs live in .env.production; the ONLY path
// to a prod migration is through this script.
//
// Usage:  node scripts/migrate-prod.mjs        # interactive 'yes' prompt
//         npm run db:migrate:prod              # same, via package.json

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import readline from "node:readline";

const EXPECTED_PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";
const ENV_PROD = resolve(".", ".env.production");

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
const directUrl = getVar(text, "DIRECT_URL");
const dbProj = projectIdOf(dbUrl);
const directProj = projectIdOf(directUrl);

if (dbProj !== EXPECTED_PROD_PROJECT_ID || directProj !== EXPECTED_PROD_PROJECT_ID) {
  console.error(
    `ABORT: .env.production project ids don't match expected prod (${EXPECTED_PROD_PROJECT_ID}).`
  );
  console.error(`  DATABASE_URL → ${dbProj}`);
  console.error(`  DIRECT_URL   → ${directProj}`);
  process.exit(1);
}

// ─── Loud banner so prod migrations are never silent ────────────────────
console.log("");
console.log("================================================================");
console.log("  PRISMA MIGRATE DEPLOY — TARGETING PRODUCTION");
console.log("================================================================");
console.log(`  Project ID : ${dbProj}`);
console.log(`  Pooled URL : ${dbUrl.replace(/:[^:@]+@/, ":***@")}`);
console.log(`  Direct URL : ${directUrl.replace(/:[^:@]+@/, ":***@")}`);
console.log("================================================================");
console.log("");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = await new Promise((res) =>
  rl.question('Type "yes" to apply pending migrations to PRODUCTION: ', res)
);
rl.close();

if (answer.trim().toLowerCase() !== "yes") {
  console.log("Cancelled — no migration applied.");
  process.exit(1);
}

console.log("");
console.log("Applying migrations to production…");

// dotenv-cli with --override defeats any shell-env DATABASE_URL/DIRECT_URL.
const result = spawnSync(
  "npx",
  ["dotenv", "-e", ".env.production", "--override", "--", "prisma", "migrate", "deploy"],
  { stdio: "inherit", shell: true }
);
process.exit(result.status ?? 1);
