import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifySession, COOKIE_NAME } from "@/lib/command/session";
import { STEP_UP_MAX_AGE_MS } from "@/lib/command/config";
import { recordAdminAction } from "@/lib/command/audit/write";
import { deleteFromStorage } from "@/lib/supabase-storage";
import { cookies, headers } from "next/headers";

// POST /api/command/agencies/[agencyId]/offboard
//
// Offboard a customer agency. Superadmin + step-up + reason, mirroring
// /api/gdpr/delete. Two modes:
//   - "close": reversible. Archives and locks the agency (undoable).
//   - "purge": permanent, requires confirmPurge. Removes the agency's operational
//     data — for each sale, its stored documents are deleted and the sale is
//     deleted (cascading its contacts, messages, tasks and document rows) — then
//     the agency's staff are anonymised and the agency shell is archived. Invoices
//     and billing records are deliberately kept for tax/retention. Internal / TSP
//     agencies are blocked. Audit-logged.

export const dynamic = "force-dynamic";

function stepUpValid(cookie: string): boolean {
  const payload = verifySession(cookie);
  if (!payload) return false;
  return Date.now() - payload.stepUpAt <= STEP_UP_MAX_AGE_MS;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ agencyId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const cookieStore = await cookies();
  if (!stepUpValid(cookieStore.get(COOKIE_NAME)?.value ?? "")) {
    return NextResponse.json({ error: "Step-up authentication required" }, { status: 403 });
  }

  const { agencyId } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { mode, confirmPurge, reason } = body;
  if (mode !== "close" && mode !== "purge") {
    return NextResponse.json({ error: "mode must be 'close' or 'purge'" }, { status: 400 });
  }
  if (typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { id: true, name: true, isInternal: true, archivedAt: true },
  });
  if (!agency) return NextResponse.json({ error: "Agency not found" }, { status: 404 });
  if (agency.isInternal) {
    return NextResponse.json({ error: "Internal agencies can't be offboarded." }, { status: 400 });
  }

  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const ua = headerStore.get("user-agent") ?? undefined;

  if (mode === "close") {
    await prisma.agency.update({
      where: { id: agencyId },
      data: { archivedAt: agency.archivedAt ?? new Date(), archivedReason: reason.trim() },
    });
    await recordAdminAction({
      adminUserId: session.user.id,
      action: "agency.close",
      targetType: "agency",
      targetId: agencyId,
      beforeValue: { name: agency.name, archivedAt: agency.archivedAt },
      afterValue: { archived: true },
      reason: reason.trim(),
      ipAddress: ip,
      userAgent: ua,
    });
    return NextResponse.json({ ok: true, action: "closed" });
  }

  // purge (permanent)
  if (confirmPurge !== true) {
    return NextResponse.json({ error: "confirmPurge must be true to remove all data" }, { status: 400 });
  }

  const txs = await prisma.propertyTransaction.findMany({
    where: { agencyId },
    select: { id: true, photoStoragePath: true },
  });
  const txIds = txs.map((t) => t.id);

  // Remove storage objects first (a DB cascade won't touch storage).
  if (txIds.length > 0) {
    const docs = await prisma.transactionDocument.findMany({
      where: { transactionId: { in: txIds } },
      select: { storagePath: true },
    });
    for (const d of docs) {
      try {
        await deleteFromStorage(d.storagePath);
      } catch {
        /* best-effort */
      }
    }
  }
  for (const t of txs) {
    if (t.photoStoragePath) {
      try {
        await deleteFromStorage(t.photoStoragePath);
      } catch {
        /* best-effort */
      }
    }
  }

  // Delete each sale (cascades its contacts, messages, tasks and document rows).
  // Per-sale so one problematic row can't abort the whole purge; re-runnable.
  let deleted = 0;
  let failed = 0;
  for (const t of txs) {
    try {
      await prisma.propertyTransaction.delete({ where: { id: t.id } });
      deleted++;
    } catch {
      failed++;
    }
  }

  // Agency-level restricted children (same set the self-serve account-delete handles).
  await prisma.agencyRecommendedSolicitor.deleteMany({ where: { agencyId } });
  await prisma.propertyChain.deleteMany({ where: { agencyId } });

  // Anonymise the agency's staff: keep the rows for audit attribution, strip PII
  // and disable login.
  const users = await prisma.user.findMany({ where: { agencyId }, select: { id: true } });
  for (const u of users) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: u.id },
        data: {
          name: "Anonymised User",
          email: `anon-${u.id}@deleted.invalid`,
          phone: null,
          password: null,
          totpSecret: null,
          totpActivatedAt: null,
          retentionEmailOptOut: true,
        },
      });
      await tx.session.deleteMany({ where: { userId: u.id } });
      await tx.account.deleteMany({ where: { userId: u.id } });
    });
  }

  // Archive the (now-empty) agency shell. Invoices / billing records are kept.
  await prisma.agency.update({
    where: { id: agencyId },
    data: { archivedAt: new Date(), archivedReason: `Data removed: ${reason.trim()}` },
  });

  await recordAdminAction({
    adminUserId: session.user.id,
    action: "agency.purge",
    targetType: "agency",
    targetId: agencyId,
    beforeValue: { name: agency.name, transactions: txs.length, users: users.length },
    afterValue: { transactionsDeleted: deleted, transactionsFailed: failed, usersAnonymised: users.length },
    reason: reason.trim(),
    ipAddress: ip,
    userAgent: ua,
  });

  return NextResponse.json({
    ok: true,
    action: "purged",
    transactionsDeleted: deleted,
    transactionsFailed: failed,
    usersAnonymised: users.length,
  });
}
