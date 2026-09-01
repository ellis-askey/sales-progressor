import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import {
  extractPostcode,
  extractPaon,
  fetchPricePaid,
  fetchEpcStatus,
  buildRightmoveUrl,
  buildZooplaUrl,
  buildLandRegUrl,
} from "@/lib/services/property-intel";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const transactionId = req.nextUrl.searchParams.get("transactionId");
  if (!transactionId) return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });

  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { propertyAddress: true },
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const postcode = extractPostcode(tx.propertyAddress);
  if (!postcode) return NextResponse.json({ postcode: null, pricePaid: [], epc: null, links: null });

  const paon = extractPaon(tx.propertyAddress);

  const [pricePaid, epcResult] = await Promise.all([
    fetchPricePaid(postcode, paon).catch(() => []),
    fetchEpcStatus(postcode, paon).catch(() => ({ status: "error" as const })),
  ]);

  return NextResponse.json({
    postcode,
    address: tx.propertyAddress,
    pricePaid,
    epc: epcResult.status === "ok" ? epcResult.data : null,
    // True only when the lookup itself failed (network / register down), so the
    // card can say "couldn't reach the register" rather than "no certificate".
    epcError: epcResult.status === "error",
    epcConfigured: !!(process.env.EPC_API_EMAIL && process.env.EPC_API_KEY),
    links: {
      rightmove: buildRightmoveUrl(tx.propertyAddress, postcode),
      zoopla: buildZooplaUrl(postcode),
      landReg: buildLandRegUrl(postcode),
    },
  });
}
