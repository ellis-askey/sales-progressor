import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ONE-TIME dev seed endpoint — delete after use
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const agencyId = "cmo6cx07s0000i8858x1v2zmv";

  const agent = await prisma.user.upsert({
    where: { email: "ellisaskey+agent@googlemail.com" },
    update: { role: "negotiator", agencyId, name: "Ellis (Agent View)" },
    create: {
      id: "agent-ellis-test-001",
      name: "Ellis (Agent View)",
      email: "ellisaskey+agent@googlemail.com",
      role: "negotiator",
      agencyId,
    },
  });

  const agentTxIds = [
    "cmo6cx9o8004ti885pf9il3p3",
    "cmo6cxety0083i8854yc61i4o",
    "cmo6cxj7r00bdi885nn00wldz",
    "cmo6cxmqe00dvi885bpup7in8",
    "cmo6cxpqh00fvi885dx0wu9w2",
  ];

  await prisma.propertyTransaction.updateMany({
    where: { id: { in: agentTxIds } },
    data: { agentUserId: agent.id, progressedBy: "agent" },
  });

  await prisma.propertyTransaction.updateMany({
    where: { id: { notIn: agentTxIds } },
    data: { progressedBy: "progressor" },
  });

  return NextResponse.json({
    ok: true,
    agentUserId: agent.id,
    agentEmail: agent.email,
    agentTxCount: agentTxIds.length,
  });
}
