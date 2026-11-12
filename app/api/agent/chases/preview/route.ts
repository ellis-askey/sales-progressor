// GET /api/agent/chases/preview?code=VM1&side=seller
//
// Returns the client-chase email EXACTLY as it would send for one step, for the
// "what your client receives" preview on the chasing settings page. Scoped to
// the caller's own agency (the branding + copy are theirs). See
// lib/email/client-chase-preview.ts.

import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/session";
import { getClientChasePreview } from "@/lib/email/client-chase-preview";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  const p = req.nextUrl.searchParams;
  const code = p.get("code");
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  const side = p.get("side") === "buyer" ? "buyer" : "seller";

  const preview = await getClientChasePreview({
    agencyId: session.user.agencyId ?? null,
    progressionBusinessId: session.user.progressionBusinessId ?? null,
    code,
    side,
  });

  return NextResponse.json(preview);
}
