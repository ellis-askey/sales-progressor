// app/api/contacts/route.ts
// POST: create a contact on a transaction
// DELETE: remove a contact

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createContact, deleteContact } from "@/lib/services/contacts";
import { ContactRole } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json();
  const { propertyTransactionId, name, phone, email, roleType } = body;

  if (!propertyTransactionId || !name || !roleType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!Object.values(ContactRole).includes(roleType)) {
    return NextResponse.json({ error: "Invalid role type" }, { status: 400 });
  }

  try {
    const contact = await createContact(
      { propertyTransactionId, name, phone, email, roleType },
      session.user.agencyId
    );
    return NextResponse.json(contact, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create contact";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("id");

  if (!contactId) {
    return NextResponse.json({ error: "Missing contact id" }, { status: 400 });
  }

  try {
    await deleteContact(contactId, session.user.agencyId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete contact";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
