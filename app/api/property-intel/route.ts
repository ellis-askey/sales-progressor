import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import {
  extractPostcode,
  buildRightmoveUrl,
  buildZooplaUrl,
  buildLandRegUrl,
} from "@/lib/services/property-intel";
import { getPropertyEnrichmentCached } from "@/lib/services/property-enrichment";

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

  // One enrichment call fans out (failure-isolated) to EPC + Land Registry +
  // postcodes.io + planning.data.gov.uk, each cached at the fetch layer with its
  // own TTL. Never blocks or throws — a missing postcode still returns a usable
  // (empty) payload.
  const enrichment = await getPropertyEnrichmentCached(tx.propertyAddress);
  const postcode = extractPostcode(tx.propertyAddress);

  return NextResponse.json({
    ...enrichment,
    links: postcode
      ? {
          rightmove: buildRightmoveUrl(tx.propertyAddress, postcode),
          zoopla: buildZooplaUrl(postcode),
          landReg: buildLandRegUrl(postcode),
        }
      : null,
  });
}
