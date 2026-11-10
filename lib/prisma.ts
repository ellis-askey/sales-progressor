// lib/prisma.ts
// Single Prisma client instance shared across the app.
// Next.js hot-reload in dev can create multiple instances without this pattern.
// Schema: Deploy A — MilestoneState enum, state column, dropped isActive/isNotRequired.

import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Pooled connection sizing. The DATABASE_URL points at Supabase's pooler
// (pgbouncer=true, transaction mode). Each warm serverless instance holds up to
// `connection_limit` open client connections, so the live total is
// instances x connection_limit. The pooler caps CLIENT connections at 200, so a
// high per-instance limit is dangerous under instance churn.
//
// 2026-11-10 incident: at connection_limit=10, deploy churn + the 15-min mailbox
// cron + traffic pushed the total past 200, and queries FAILED app-wide with
// FATAL (EMAXCONN) — the portal, hub, comms and command all 500'd. Cut to 3 so
// ~66 instances are needed to saturate instead of ~20. The cost is the file
// shell's ~20 parallel queries run in smaller batches (a little slower), which
// beats the whole app being down. RESTORE toward 10 once the Supabase pooler's
// max client connections is raised (founder action, see ELLIS_MANUAL_TODO).
// An explicit env connection_limit still wins.
function resolveDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (url.includes("pgbouncer=true") && !url.includes("connection_limit=")) {
    return url + (url.includes("?") ? "&" : "?") + "connection_limit=3";
  }
  return url;
}

const resolvedUrl = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(resolvedUrl ? { datasources: { db: { url: resolvedUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// A transient "couldn't get a database connection" error — thrown when the
// pooler is momentarily full. The classic cause is a deploy: for a few seconds
// the old servers and the new ones are both live, and together they briefly
// exceed the pooler's client-connection ceiling. The query never ran (no
// connection was established), so waiting and retrying is always safe.
export function isTransientConnectionError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /max client connections|too many connections|Can't reach database server|Timed out fetching a new connection/i.test(msg);
}

// Warm a pooled connection before a batch of work, riding out a transient
// pool-full blip with a short backoff (~0.5s, then ~1.5s). Once this returns,
// Prisma holds a client connection the rest of the work reuses. `SELECT 1` has
// no side effects, so this is safe to call anywhere. If the pool is genuinely
// saturated it still throws after the final attempt.
export async function ensureDbConnection(attempts = 3): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (err) {
      if (i === attempts - 1 || !isTransientConnectionError(err)) throw err;
      await new Promise((r) => setTimeout(r, 500 + i * 1000));
    }
  }
}
