import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChainForTransaction, createChain, upsertChainLink } from "@/lib/services/chains";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const transactionId = req.nextUrl.searchParams.get("transactionId");
  if (!transactionId) return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });

  const chain = await getChainForTransaction(transactionId);
  return NextResponse.json({ chain });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { transactionId, name, links } = body as {
    transactionId: string;
    name?: string | null;
    links: Array<{
      position: number;
      transactionId?: string | null;
      externalAddress?: string | null;
      externalStatus?: string | null;
    }>;
  };

  const chain = await createChain(session.user.agencyId, name ?? null);

  for (const link of links) {
    await upsertChainLink(chain.id, link.position, {
      transactionId: link.transactionId ?? null,
      externalAddress: link.externalAddress ?? null,
      externalStatus: link.externalStatus ?? null,
    });
  }

  const result = await getChainForTransaction(transactionId);
  return NextResponse.json({ chain: result });
}
