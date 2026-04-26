import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { evaluateTransactionReminders } from "@/lib/services/reminders";

// POST /api/seed-demo — creates a demo agent + midway-through transaction for testing
// Idempotent: safe to call multiple times (skips user creation if already exists)
export async function POST() {
  const agency = await prisma.agency.findFirst();
  if (!agency) return NextResponse.json({ error: "No agency configured" }, { status: 500 });

  const EMAIL = "demo@agent.com";
  const PASSWORD = "Demo1234!";

  // Create user if not already present
  let user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Demo Agent",
        email: EMAIL,
        password: await hash(PASSWORD, 12),
        role: "negotiator",
        agencyId: agency.id,
        firmName: agency.name ?? "Demo Agency",
      },
    });
  }

  // Fetch milestone definition IDs for the milestones we'll complete
  const COMPLETE_CODES = [
    "VM1","VM2","VM3","VM14","VM15","VM4","VM5",
    "PM1","PM2","PM14a","PM15a","PM4","PM5","PM3","PM9",
  ];
  const defs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: COMPLETE_CODES } },
    select: { id: true, code: true },
  });
  const defIdMap = new Map(defs.map((d) => [d.code, d.id]));

  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86_400_000);

  // Transaction created 28 days ago, exchange target 6 weeks away
  const tx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "42 Hawthorn Road, Bristol, BS6 7NR",
      agencyId: agency.id,
      assignedUserId: user.id,
      agentUserId: user.id,
      purchasePrice: 35_000_000,
      status: "active",
      tenure: "freehold",
      purchaseType: "mortgage",
      progressedBy: "agent",
      serviceType: "self_managed",
      expectedExchangeDate: daysAgo(-42),
      createdAt: daysAgo(28),
    },
  });

  // Contacts
  await prisma.contact.createMany({
    data: [
      {
        propertyTransactionId: tx.id,
        name: "David & Sarah Mitchell",
        email: "mitchell.demo@example.com",
        phone: "07700 900111",
        roleType: "vendor",
        portalToken: randomUUID(),
      },
      {
        propertyTransactionId: tx.id,
        name: "Tom & Emma Clarke",
        email: "clarkes.demo@example.com",
        phone: "07700 900222",
        roleType: "purchaser",
        portalToken: randomUUID(),
      },
    ],
  });

  // Complete milestones spread across the last 26 days (oldest first)
  for (let i = 0; i < COMPLETE_CODES.length; i++) {
    const code = COMPLETE_CODES[i];
    const defId = defIdMap.get(code);
    if (!defId) continue;
    const completedDaysAgo = Math.round(26 - (i / (COMPLETE_CODES.length - 1)) * 24);
    await prisma.milestoneCompletion.create({
      data: {
        transactionId: tx.id,
        milestoneDefinitionId: defId,
        isActive: true,
        completedAt: daysAgo(completedDaysAgo),
        completedById: user.id,
        summaryText: null,
      },
    });
  }

  // Run the engine — creates reminder logs + pending chase tasks for incomplete milestones
  await evaluateTransactionReminders(tx.id);

  return NextResponse.json({
    ok: true,
    credentials: { email: EMAIL, password: PASSWORD },
    transactionUrl: `/agent/transactions/${tx.id}`,
    message: "Demo agent and midway transaction created. Chase buttons should be visible immediately.",
  });
}
