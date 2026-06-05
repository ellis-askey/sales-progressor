import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await requireSession();

  const DEMO = [
    {
      address: "14 Birchwood Avenue, Knutsford, WA16 8SJ",
      price: 42500000, // £425,000 in pence
      vendor: { name: "Robert & Claire Hartley", email: "r.hartley@email.com", phone: "07700 900123" },
      purchaser: { name: "James Whitmore", email: "jwhitmore@email.co.uk", phone: "07700 900456" },
    },
    {
      address: "7 The Maltings, Chester, CH1 2JD",
      price: 31000000, // £310,000 in pence
      vendor: { name: "Patricia Dennison", email: "p.dennison@webmail.com", phone: "07700 900789" },
      purchaser: { name: "Aisha & Tariq Hussain", email: "ahussain@proton.me", phone: "07700 900321" },
    },
  ];

  for (const d of DEMO) {
    // Phase 1: Round 1 + activeBuyerRoundId wired inside the create tx.
    const tx = await prisma.$transaction(async (ptx) => {
      const created = await ptx.propertyTransaction.create({
        data: {
          propertyAddress: d.address,
          agencyId: session.user.agencyId,
          assignedUserId: session.user.id,
          purchasePrice: d.price,
          status: "active",
        },
      });
      const round = await ptx.buyerRound.create({
        data: {
          transactionId: created.id,
          roundNumber: 1,
          status: "active",
          purchasePrice: created.purchasePrice,
        },
      });
      return ptx.propertyTransaction.update({
        where: { id: created.id },
        data: { activeBuyerRoundId: round.id },
      });
    });

    await prisma.contact.createMany({
      data: [
        {
          propertyTransactionId: tx.id,
          name: d.vendor.name,
          email: d.vendor.email,
          phone: d.vendor.phone,
          roleType: "vendor",
          buyerRoundId: null,
        },
        {
          propertyTransactionId: tx.id,
          name: d.purchaser.name,
          email: d.purchaser.email,
          phone: d.purchaser.phone,
          roleType: "purchaser",
          buyerRoundId: tx.activeBuyerRoundId,
        },
      ],
    });
  }

  return NextResponse.json({ ok: true });
}
