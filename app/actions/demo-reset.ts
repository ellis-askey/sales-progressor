"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import {
  assertDemoSafe,
  resolveDemoTargetUrl,
  isDemoTargetDirectUrl,
  runSeedDemo,
  DEMO_AGENCY_NAME,
  DEMO_DIRECTOR_EMAIL,
  DEMO_DIRECTOR_PASSWORD,
  DEMO_NEGOTIATOR_EMAIL,
  DEMO_NEGOTIATOR_PASSWORD,
} from "@/scripts/seed-demo";

const STAGING_PROJECT_ID = "etidawkbqctarmsdjoxp";

/**
 * Add PgBouncer-compatibility params to a Prisma datasource URL when the
 * target is a POOLED Supabase connection (port 6543 / pooler.supabase.co).
 *
 * On a pooled URL Prisma without these flags hits two failure modes:
 *
 *   - Prepared statement caching: transaction-mode pooling multiplexes
 *     statements across backend connections. Prisma prepares `sN`,
 *     the next query lands on a different backend, and Postgres
 *     returns "prepared statement \"sN\" does not exist" (code 26000).
 *
 *   - Concurrent query queueing: with `connection_limit=1` any burst of
 *     parallel queries queues on a single connection and hits
 *     `pool_timeout`, killing long batches.
 *
 * The flags:
 *   - `pgbouncer=true` (skip prepared statement caching, safe for tx pooling)
 *   - `connection_limit=5` (allow modest parallelism from Promise.all bursts)
 *   - `pool_timeout=30` (30s to acquire a connection, up from Prisma's 10s
 *     default; long enough for the seed's 15-fixture loop to complete)
 *
 * Skipped entirely when the URL is the DIRECT connection - there PgBouncer
 * isn't in the path and the flags would just clutter the URL.
 *
 * Idempotent - flags already present in the URL aren't re-appended.
 */
function withPgBouncerFlags(url: string): string {
  if (!url) return url;
  const parts: string[] = [];
  if (!/[?&]pgbouncer=/.test(url)) parts.push("pgbouncer=true");
  if (!/[?&]connection_limit=/.test(url)) parts.push("connection_limit=5");
  if (!/[?&]pool_timeout=/.test(url)) parts.push("pool_timeout=30");
  if (parts.length === 0) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${parts.join("&")}`;
}

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) redirect("/dashboard");
  return session;
}

export type ResetDemoResult =
  | {
      ok: true;
      agencyName: string;
      fixtureCount: number;
      logins: {
        director:   { email: string; password: string };
        negotiator: { email: string; password: string };
      };
    }
  | { ok: false; error: string };

/**
 * Reset Demo server action. Wraps scripts/seed-demo.ts:runSeedDemo with the
 * same safety rails plus a typed "RESET" confirmation. Superadmin only.
 *
 * Returning the manifest (not redirecting) lets the client form render the
 * fresh credentials inline so the demoer can copy them without leaving the
 * Command Centre.
 */
export async function resetDemoAction(confirmText: string): Promise<ResetDemoResult> {
  await requireSuperAdmin();

  if (confirmText !== "RESET") {
    return { ok: false, error: 'Type "RESET" exactly (uppercase) to confirm.' };
  }

  const targetUrl = resolveDemoTargetUrl();

  try {
    assertDemoSafe(targetUrl);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // Audit line so each reset is traceable in Vercel runtime logs.
  // Identifies cross-env triggers (production runtime hitting staging DB)
  // vs. staging-runtime triggers (same DB the rest of the app uses).
  console.info(
    `[resetDemoAction] targeting ${targetUrl.includes(STAGING_PROJECT_ID) ? "STAGING" : "UNKNOWN"} from runtime=${
      process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "local"
    }; source=${process.env.STAGING_DATABASE_URL ? "STAGING_DATABASE_URL" : "DATABASE_URL"}`,
  );

  // Explicit datasourceUrl routes this client to the resolved URL, NOT the
  // default DATABASE_URL. On production runtime that means we connect to
  // staging via STAGING_DIRECT_URL / STAGING_DATABASE_URL — the only
  // cross-env connection in the app. Every other surface continues to
  // use lib/prisma.ts (which reads DATABASE_URL) and stays on its own
  // environment.
  //
  // 2026-07-07: prefer the direct URL when available (STAGING_DIRECT_URL,
  // the same DIRECT_URL pattern prisma/schema.prisma uses for migrations)
  // - it handles prepared statements and concurrent queries natively.
  // Only apply the PgBouncer-compat flags when we're on the pooled URL.
  const useDirectUrl = isDemoTargetDirectUrl();
  const clientUrl = useDirectUrl ? targetUrl : withPgBouncerFlags(targetUrl);
  console.info(
    `[resetDemoAction] using ${useDirectUrl ? "DIRECT" : "POOLED (with pgbouncer flags)"} connection`,
  );
  const prisma = new PrismaClient({ datasourceUrl: clientUrl });
  try {
    const manifest = await runSeedDemo(prisma);
    revalidatePath("/command/admin/demo");
    return {
      ok: true,
      agencyName: DEMO_AGENCY_NAME,
      fixtureCount: manifest.fixtures.length,
      logins: {
        director:   { email: DEMO_DIRECTOR_EMAIL,   password: DEMO_DIRECTOR_PASSWORD },
        negotiator: { email: DEMO_NEGOTIATOR_EMAIL, password: DEMO_NEGOTIATOR_PASSWORD },
      },
    };
  } catch (e) {
    return { ok: false, error: `Reset failed: ${(e as Error).message}` };
  } finally {
    await prisma.$disconnect();
  }
}
