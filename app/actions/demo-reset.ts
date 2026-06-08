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
  const prisma = new PrismaClient({ datasourceUrl: targetUrl });
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
