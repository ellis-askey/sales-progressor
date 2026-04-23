// app/api/transactions/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createTransaction } from "@/lib/services/transactions";
import { evaluateTransactionReminders } from "@/lib/services/reminders";
import { prisma } from "@/lib/prisma";
import type { Tenure, PurchaseType, ContactRole } from "@prisma/client";

type ContactInput = { name: string; phone?: string; email?: string; roleType: ContactRole };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const {
    propertyAddress,
    expectedExchangeDate,
    purchasePrice,
    tenure,
    purchaseType,
    contacts,
    notes,
    progressedBy,
    vendorSolicitorFirmId,
    vendorSolicitorContactId,
    purchaserSolicitorFirmId,
    purchaserSolicitorContactId,
  } = body;

  if (!propertyAddress) return NextResponse.json({ error: "Address required" }, { status: 400 });

  const isAgent = session.user.role === "negotiator" || session.user.role === "director";
  const resolvedProgressedBy = isAgent ? (progressedBy === "agent" ? "agent" : "progressor") : "progressor";

  try {
    const tx = await createTransaction({
      propertyAddress,
      agencyId: session.user.agencyId,
      assignedUserId: isAgent && resolvedProgressedBy === "agent" ? session.user.id : (isAgent ? undefined : session.user.id),
      agentUserId: isAgent ? session.user.id : null,
      progressedBy: resolvedProgressedBy,
      expectedExchangeDate: expectedExchangeDate ? new Date(expectedExchangeDate) : null,
      purchasePrice: purchasePrice ?? null,
      tenure: (tenure as Tenure) ?? null,
      purchaseType: (purchaseType as PurchaseType) ?? null,
      notes: notes ?? null,
      vendorSolicitorFirmId: vendorSolicitorFirmId ?? null,
      vendorSolicitorContactId: vendorSolicitorContactId ?? null,
      purchaserSolicitorFirmId: purchaserSolicitorFirmId ?? null,
      purchaserSolicitorContactId: purchaserSolicitorContactId ?? null,
    });

    if (Array.isArray(contacts) && contacts.length > 0) {
      await prisma.contact.createMany({
        data: (contacts as ContactInput[]).map((c) => ({
          propertyTransactionId: tx.id,
          name: c.name.trim(),
          phone: c.phone?.trim() || null,
          email: c.email?.trim() || null,
          roleType: c.roleType,
        })),
      });
    }

    // Seed reminder logs before redirect so they exist on first page load
    await evaluateTransactionReminders(tx.id).catch((err) => {
      console.error(`[reminders] Failed to evaluate on creation for tx ${tx.id}:`, err);
    });

    return NextResponse.json(tx, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
