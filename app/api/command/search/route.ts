import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// Global Command Centre search — superadmin only. A read-only cross-tenant
// lookup over the four entities that have a Command Centre destination. Uses
// commandDb (the superadmin cross-tenant client) behind the same gate as the
// /command layout; it changes no isolation rule and exposes nothing a
// superadmin can't already reach by navigating. Bounded (small takes), with a
// 2-char minimum enforced here as well as client-side.
export type CommandSearchResult = {
  agencies: { id: string; name: string; mode: string }[];
  businesses: { id: string; name: string; shortName: string | null; subscribed: boolean }[];
  people: { id: string; name: string; email: string | null; role: string; org: string | null }[];
  files: { id: string; address: string; status: string; agencyName: string | null }[];
};

const EMPTY: CommandSearchResult = { agencies: [], businesses: [], people: [], files: [] };

const LIVE_STATUSES = ["active", "on_hold"] as const;
// With the toggle on, add closed files (completed + withdrawn). `draft` is NEVER
// included — drafts are incomplete, unsubmitted files and would be noise (the
// agent search excludes them for the same reason).
const CLOSED_STATUSES = ["active", "on_hold", "completed", "withdrawn"] as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json(EMPTY);
  const includeArchived = req.nextUrl.searchParams.get("archived") === "1";

  const contains = { contains: q, mode: "insensitive" as const };

  // Mirrors lib/command/files.ts LIVE_FILE_WHERE (active/on_hold, non-demo,
  // non-internal agency). With `archived=1` the status restriction is dropped so
  // withdrawn/completed files are included for investigations.
  const fileWhere: Prisma.PropertyTransactionWhereInput = {
    isDemo: false,
    agency: { isInternal: false },
    propertyAddress: contains,
    status: { in: includeArchived ? [...CLOSED_STATUSES] : [...LIVE_STATUSES] },
  };

  const [agencies, businesses, people, files] = await Promise.all([
    commandDb.agency.findMany({
      where: { isInternal: false, name: contains },
      orderBy: { name: "asc" },
      take: 6,
      select: { id: true, name: true, modeProfile: true },
    }),
    commandDb.progressionBusiness.findMany({
      where: { isTsp: false, OR: [{ name: contains }, { shortName: contains }] },
      orderBy: { name: "asc" },
      take: 6,
      select: { id: true, name: true, shortName: true, stripeSubscriptionId: true },
    }),
    // Only users with a Command Centre destination (agency staff or external-
    // business members) — they have an org to show and a person page at
    // /command/agencies/[userId]. Pure internal TSP staff (no agency/business)
    // have no distinct CC person page, so they're excluded. Demo users excluded.
    commandDb.user.findMany({
      where: {
        isDemo: false,
        OR: [{ name: contains }, { email: contains }],
        AND: [{ OR: [{ agencyId: { not: null } }, { progressionBusinessId: { not: null } }] }],
      },
      orderBy: { name: "asc" },
      take: 6,
      select: {
        id: true, name: true, email: true, role: true,
        agency: { select: { name: true } },
        progressionBusiness: { select: { name: true } },
      },
    }),
    commandDb.propertyTransaction.findMany({
      where: fileWhere,
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, propertyAddress: true, status: true, agency: { select: { name: true } } },
    }),
  ]);

  const result: CommandSearchResult = {
    agencies: agencies.map((a) => ({ id: a.id, name: a.name, mode: a.modeProfile })),
    businesses: businesses.map((b) => ({
      id: b.id, name: b.name, shortName: b.shortName, subscribed: !!b.stripeSubscriptionId,
    })),
    people: people.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email ?? null,
      role: u.role,
      org: u.agency?.name ?? u.progressionBusiness?.name ?? null,
    })),
    files: files.map((f) => ({
      id: f.id, address: f.propertyAddress, status: f.status, agencyName: f.agency?.name ?? null,
    })),
  };

  return NextResponse.json(result);
}
