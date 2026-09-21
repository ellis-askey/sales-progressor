// lib/prisma.ts
// Single Prisma client instance shared across the app.
// Next.js hot-reload in dev can create multiple instances without this pattern.
// Schema: Deploy A — MilestoneState enum, state column, dropped isActive/isNotRequired.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Pooled connection sizing (2026-09-21). The DATABASE_URL points at Supabase's
// pooler (pgbouncer=true, transaction mode), which multiplexes many client
// connections onto few server ones — so a low client-side connection_limit is
// what actually bites us: a single request's parallel queries queue behind it.
// The file shell fires ~20 queries per open (trunk + the parallel barrier);
// with the default limit (~3 on a 1-vCPU lambda) they serialised, so a
// "parallel" Promise.all barrier measured 4-8s in prod. Raising the limit lets
// them run concurrently. Only applied to the pooler URL, and only when the env
// hasn't already set an explicit limit, so an env override still wins.
function resolveDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (url.includes("pgbouncer=true") && !url.includes("connection_limit=")) {
    return url + (url.includes("?") ? "&" : "?") + "connection_limit=10";
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
