// app/api/comms/route.ts
// POST: create a communication record
// DELETE: remove a communication record
// Sprint 7: added chaseTaskId, generatedText, tone, wasAiGenerated, wasEdited

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCommunicationRecord, deleteCommunicationRecord } from "@/lib/services/comms";
import type { CommType, CommMethod } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const {
    transactionId,
    chaseTaskId,
    type,
    method,
    contactIds,
    content,
    ccEmails,
    generatedText,
    tone,
    wasAiGenerated,
    wasEdited,
    visibleToClient,
  } = body;

  if (!transactionId || !type || !content?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if ((type === "inbound" || type === "outbound") && !method) {
    return NextResponse.json({ error: "Method required for inbound/outbound" }, { status: 400 });
  }

  try {
    const record = await createCommunicationRecord({
      transactionId,
      chaseTaskId: chaseTaskId ?? null,
      type: type as CommType,
      method: method as CommMethod | null,
      contactIds: contactIds ?? [],
      content,
      ccEmails,
      generatedText: generatedText ?? null,
      tone: tone ?? null,
      wasAiGenerated: wasAiGenerated ?? false,
      wasEdited: wasEdited ?? false,
      visibleToClient: visibleToClient ?? false,
      createdById: session.user.id,
      agencyId: session.user.agencyId,
    });
    return NextResponse.json(record, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create record";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    await deleteCommunicationRecord(id, session.user.agencyId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
