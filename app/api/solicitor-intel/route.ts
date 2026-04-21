import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSolicitorIntel, getAllSolicitorIntel } from "@/lib/services/solicitor-intel";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const firmId = req.nextUrl.searchParams.get("firmId");

  if (firmId) {
    const intel = await getSolicitorIntel(firmId);
    if (!intel) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(intel);
  }

  const all = await getAllSolicitorIntel(session.user.agencyId);
  return NextResponse.json(all);
}
