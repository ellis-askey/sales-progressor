#!/usr/bin/env node
// Vercel build helper: chooses the right Prisma command based on environment.
// - Production: `prisma migrate deploy` (applies new migrations to live DB)
// - Preview/staging: `prisma db push --accept-data-loss --skip-generate` (syncs schema, no migration history needed)
// - Local: skip entirely

import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

if (!env) {
  console.log("[db-deploy] Not on Vercel — skipping DB sync");
  process.exit(0);
}

const cmd =
  env === "production"
    ? "npx prisma migrate deploy"
    : "npx prisma db push --accept-data-loss --skip-generate";

console.log(`[db-deploy] VERCEL_ENV=${env} → running: ${cmd}`);
execSync(cmd, { stdio: "inherit" });
