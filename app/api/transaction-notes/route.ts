import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNote, deleteNote } from "@/lib/services/transaction-notes";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { transactionId, content } = await req.json();
  if (!transactionId || !content?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, agentUserId: true },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  // Negotiators without canViewAllFiles may only add notes to their own files
  if (session.user.role === "negotiator") {
    const actor = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { canViewAllFiles: true },
    });
    if (!actor?.canViewAllFiles && tx.agentUserId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const note = await createNote(transactionId, content.trim(), session.user.id);
  return NextResponse.json(note, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const scope = getAccessScope(session);
  const noteWhere =
    scope.kind === "all"      ? { id } :
    scope.kind === "assigned" ? { id, transaction: { assignedUserId: scope.userId } } :
                                 { id, transaction: { agencyId: scope.agencyIds[0] } };
  const note = await prisma.transactionNote.findFirst({
    where: noteWhere,
    select: { id: true },
  });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteNote(id);
  return NextResponse.json({ ok: true });
}
