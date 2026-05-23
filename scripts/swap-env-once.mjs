// One-shot swap: make .env staging-by-default; move prod URLs to .env.production.
// Prisma CLI reads .env (not .env.local), which was sending every `prisma migrate
// deploy` to PROD because .env had prod URLs. After this swap:
//   .env             → staging DB URLs (safe default for `prisma migrate deploy`)
//   .env.production  → prod DB URLs (only via the guarded scripts/migrate-prod.mjs)
//   .env.local       → unchanged (Next.js runtime override; already staging)
//
// Run once. Then delete.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(".");
const ENV = resolve(ROOT, ".env");
const ENV_LOCAL = resolve(ROOT, ".env.local");
const ENV_PROD = resolve(ROOT, ".env.production");

const PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";
const STAG_PROJECT_ID = "etidawkbqctarmsdjoxp";

// Handles both Supabase URL formats:
//   pooler:  postgresql://postgres.<PROJECT_ID>:pw@aws-0-...pooler.supabase.com
//   direct:  postgresql://postgres:pw@db.<PROJECT_ID>.supabase.co
const PROJECT_ID_RE = /(?:postgres\.|db\.)([a-z0-9]{20})/;

function projectIdOf(url) {
  const m = url?.match(PROJECT_ID_RE);
  return m ? m[1] : "UNKNOWN";
}

function getVar(content, key) {
  const re = new RegExp(`^${key}\\s*=\\s*(.+)$`, "m");
  const m = content.match(re);
  if (!m) return null;
  return m[1].replace(/^["']|["']$/g, "");
}

function setVar(content, key, value) {
  const re = new RegExp(`^${key}\\s*=.*$`, "m");
  const line = `${key}="${value}"`;
  if (re.test(content)) return content.replace(re, line);
  return content + `\n${line}\n`;
}

// ─── Safety: don't overwrite .env.production if it already exists ────────
if (existsSync(ENV_PROD)) {
  console.error(`ABORT: ${ENV_PROD} already exists. Inspect manually.`);
  process.exit(1);
}

// Strip UTF-8 BOM if present — .env was written with a BOM on Windows and
// the leading ﻿ breaks the `^` anchor in our regex matches.
const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);
const envOrig = stripBom(readFileSync(ENV, "utf8"));
const localOrig = stripBom(readFileSync(ENV_LOCAL, "utf8"));

const prodDbUrl = getVar(envOrig, "DATABASE_URL");
const prodDirectUrl = getVar(envOrig, "DIRECT_URL");
const stagDbUrl = getVar(localOrig, "DATABASE_URL");
const stagDirectUrl = getVar(localOrig, "DIRECT_URL");
const stagNextSupaUrl = getVar(localOrig, "NEXT_PUBLIC_SUPABASE_URL");
const stagSupaServiceKey = getVar(localOrig, "SUPABASE_SERVICE_ROLE_KEY");

// ─── Validate the source files match what we expect ──────────────────────
const checks = [
  [".env DATABASE_URL", projectIdOf(prodDbUrl), PROD_PROJECT_ID],
  [".env DIRECT_URL", projectIdOf(prodDirectUrl), PROD_PROJECT_ID],
  [".env.local DATABASE_URL", projectIdOf(stagDbUrl), STAG_PROJECT_ID],
  [".env.local DIRECT_URL", projectIdOf(stagDirectUrl), STAG_PROJECT_ID],
];
for (const [label, got, want] of checks) {
  if (got !== want) {
    console.error(`ABORT: ${label} project id = ${got}, expected ${want}`);
    process.exit(1);
  }
}
if (!stagNextSupaUrl || !stagNextSupaUrl.includes(STAG_PROJECT_ID)) {
  console.error("ABORT: .env.local NEXT_PUBLIC_SUPABASE_URL missing or not staging");
  process.exit(1);
}
if (!stagSupaServiceKey) {
  console.error("ABORT: .env.local SUPABASE_SERVICE_ROLE_KEY missing");
  process.exit(1);
}

// ─── Write .env.production = full prod env (preserves all current secrets) ──
writeFileSync(ENV_PROD, envOrig, "utf8");

// ─── Rewrite .env: swap DB-related vars to staging values; keep the rest ──
let next = envOrig;
next = setVar(next, "DATABASE_URL", stagDbUrl);
next = setVar(next, "DIRECT_URL", stagDirectUrl);
next = setVar(next, "NEXT_PUBLIC_SUPABASE_URL", stagNextSupaUrl);
next = setVar(next, "SUPABASE_SERVICE_ROLE_KEY", stagSupaServiceKey);

// Tag the new .env so future readers know it's staging-by-default.
const banner = `# DB URLs in this file point to STAGING (etidawkbqctarmsdjoxp).\n# Prod URLs live in .env.production and are only used by scripts/migrate-prod.mjs.\n# Updated: env-swap on 2026-05-23.\n`;
if (!next.startsWith("# DB URLs")) next = banner + next;

writeFileSync(ENV, next, "utf8");

console.log("OK — swap complete.");
console.log(`  .env             → staging (${STAG_PROJECT_ID})`);
console.log(`  .env.production  → prod    (${PROD_PROJECT_ID})`);
