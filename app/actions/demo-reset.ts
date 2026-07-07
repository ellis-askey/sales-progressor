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
  runSeedDemo,
  DEMO_AGENCY_NAME,
  DEMO_DIRECTOR_EMAIL,
  DEMO_DIRECTOR_PASSWORD,
  DEMO_NEGOTIATOR_EMAIL,
  DEMO_NEGOTIATOR_PASSWORD,
} from "@/scripts/seed-demo";

const STAGING_PROJECT_ID = "etidawkbqctarmsdjoxp";

/**
 * Add PgBouncer-compatibility params to a Prisma datasource URL.
 *
 * Supabase's pooled connection URLs (port 6543 / pooler.supabase.co) run
 * in transaction-mode pooling, which multiplexes prepared statements
 * across backend connections. Prisma's default prepared-statement
 * caching then hits `prepared statement "sN" does not exist` errors
 * mid-run because the statement was prepared on a different backend.
 *
 * `pgbouncer=true` tells Prisma to skip prepared-statement caching
 * (safe with transaction pooling). `connection_limit=1` prevents
 * concurrent queries from clashing on the same backend during long
 * batch operations like the demo seed.
 *
 * Idempotent - if either flag is already present the URL is returned
 * unchanged.
 */
function withPgBouncerFlags(url: string): string {
  if (!url) return url;
  const parts: string[] = [];
  if (!/[?&]pgbouncer=/.test(url)) parts.push("pgbouncer=true");
  if (!/[?&]connection_limit=/.test(url)) parts.push("connection_limit=1");
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
  // staging via STAGING_DATABASE_URL — the only cross-env connection in
  // the app. Every other surface continues to use lib/prisma.ts (which
  // reads DATABASE_URL) and stays on its own environment.
  //
  // 2026-07-07 fix: append PgBouncer-compatible query params before
  // instantiating. Supabase's default pooled URL uses transaction-mode
  // pooling (port 6543 or pooler.supabase.co), which multiplexes
  // prepared statements across connections and breaks Prisma's default
  // behaviour with `prepared statement "sN" does not exist` errors
  // (Postgres code 26000). `pgbouncer=true` disables prepared statement
  // caching; `connection_limit=1` prevents concurrent queries from
  // clashing on the same backend. Idempotent - won't double-append if
  // the URL already has one of these.
  const prisma = new PrismaClient({ datasourceUrl: withPgBouncerFlags(targetUrl) });
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
