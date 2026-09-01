import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { moveChainLinkAdjacent } from "@/lib/services/chains";

type RouteParams = { params: Promise<{ id: string; linkId: string }> };

// POST /api/chains/[id]/links/[linkId]/move — move a link one step up/down within
// its ladder. Permitted only while the chain is entirely the creator's own,
// unclaimed stubs (enforced in moveChainLinkAdjacent).
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id, linkId } = await params;
  const body = (await req.json().catch(() => ({}))) as { direction?: "up" | "down" };
  if (body.direction !== "up" && body.direction !== "down") {
    return NextResponse.json({ error: "direction must be 'up' or 'down'" }, { status: 400 });
  }

  const result = await moveChainLinkAdjacent(id, linkId, body.direction, session.user.id);
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : result.reason === "locked" ? 403 : 409;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json({ ok: true });
}
