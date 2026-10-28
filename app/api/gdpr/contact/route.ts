import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifySession, COOKIE_NAME } from "@/lib/command/session";
import { STEP_UP_MAX_AGE_MS } from "@/lib/command/config";
import { recordAdminAction } from "@/lib/command/audit/write";
import { deleteFromStorage } from "@/lib/supabase-storage";
import { cookies, headers } from "next/headers";

// POST /api/gdpr/contact
//
// Right-to-erasure for a buyer / seller / solicitor. The agency is the data
// controller and requests it; we (processor) execute it. Superadmin + a valid
// Command-Centre step-up + a reason, mirroring /api/gdpr/delete (which covers
// User accounts). Scoped to one agency and keyed by email, so it erases every
// contact record for that person within the agency: anonymises their details,
// kills their portal link, removes their uploaded documents, and scrubs their
// identifiable details from message recipients. Audit-logged.

export const dynamic = "force-dynamic";

function stepUpValid(cookie: string): boolean {
  const payload = verifySession(cookie);
  if (!payload) return false;
  return Date.now() - payload.stepUpAt <= STEP_UP_MAX_AGE_MS;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const cookieStore = await cookies();
  if (!stepUpValid(cookieStore.get(COOKIE_NAME)?.value ?? "")) {
    return NextResponse.json({ error: "Step-up authentication required" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { agencyId, email, reason } = body;
  if (typeof agencyId !== "string" || !agencyId) {
    return NextResponse.json({ error: "agencyId is required" }, { status: 400 });
  }
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }
  if (typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  const target = email.trim().toLowerCase();
  const contacts = await prisma.contact.findMany({
    where: { email: { equals: target, mode: "insensitive" }, transaction: { agencyId } },
    select: { id: true, propertyTransactionId: true },
  });
  if (contacts.length === 0) {
    return NextResponse.json({ error: "No contacts found with that email in this agency." }, { status: 404 });
  }

  const contactIds = contacts.map((c) => c.id);
  const txIds = [...new Set(contacts.map((c) => c.propertyTransactionId))];

  // 1. Remove their uploaded documents from storage, then delete the DB rows.
  const docs = await prisma.transactionDocument.findMany({
    where: { contactId: { in: contactIds } },
    select: { storagePath: true },
  });
  for (const d of docs) {
    try {
      await deleteFromStorage(d.storagePath);
    } catch {
      // best-effort: a storage failure must not abort the erasure
    }
  }
  await prisma.transactionDocument.deleteMany({ where: { contactId: { in: contactIds } } });

  // 2. Anonymise each contact record (PII + kill the portal link). portalToken is
  // @unique, but Postgres treats NULLs as distinct, so a bulk set to null is fine.
  await prisma.contact.updateMany({
    where: { id: { in: contactIds } },
    data: { name: "Anonymised contact", email: null, phone: null, portalToken: null },
  });

  // 3. Scrub their identifiable details from messages on those transactions.
  await prisma.outboundMessage.updateMany({
    where: { transactionId: { in: txIds }, recipientEmail: { equals: target, mode: "insensitive" } },
    data: { recipientEmail: null, recipientName: null },
  });

  const headerStore = await headers();
  await recordAdminAction({
    adminUserId: session.user.id,
    action: "gdpr.contact.anonymise",
    targetType: "contact",
    targetId: contactIds.join(","),
    beforeValue: { email: target, agencyId, contacts: contactIds.length },
    afterValue: { anonymised: contactIds.length, documentsRemoved: docs.length },
    reason: reason.trim(),
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: headerStore.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ ok: true, contacts: contactIds.length, documentsRemoved: docs.length });
}
