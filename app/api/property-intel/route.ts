import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  extractPostcode,
  fetchPricePaid,
  fetchEpc,
  buildRightmoveUrl,
  buildZooplaUrl,
} from "@/lib/services/property-intel";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const transactionId = req.nextUrl.searchParams.get("transactionId");
  if (!transactionId) return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });

  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
    select: { propertyAddress: true },
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const postcode = extractPostcode(tx.propertyAddress);
  if (!postcode) return NextResponse.json({ postcode: null, pricePaid: [], epc: null, links: null });

  const [pricePaid, epc] = await Promise.all([
    fetchPricePaid(postcode).catch(() => []),
    fetchEpc(postcode).catch(() => null),
  ]);

  return NextResponse.json({
    postcode,
    address: tx.propertyAddress,
    pricePaid,
    epc,
    epcConfigured: !!(process.env.EPC_API_EMAIL && process.env.EPC_API_KEY),
    links: {
      rightmove: buildRightmoveUrl(tx.propertyAddress, postcode),
      zoopla: buildZooplaUrl(postcode),
      landReg: `https://www.gov.uk/search-house-prices?postcode=${encodeURIComponent(postcode)}`,
    },
  });
}
