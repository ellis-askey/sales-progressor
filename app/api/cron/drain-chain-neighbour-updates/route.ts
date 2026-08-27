import { NextRequest, NextResponse } from "next/server";
import { drainChainNeighbourUpdates } from "@/lib/services/chain-neighbour-updates";

// Sends queued onward-neighbour updates (Note A). Runs every 10 min via Vercel
// Cron (see vercel.json), so several confirmations in the batching window drain
// into one email. Protected by CRON_SECRET.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await drainChainNeighbourUpdates();
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Drain error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
