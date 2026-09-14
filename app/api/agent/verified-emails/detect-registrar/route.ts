import { NextRequest, NextResponse } from "next/server";
import { promises as dns } from "node:dns";
import { requireSession } from "@/lib/session";
import { detectRegistrarFromNameservers } from "@/lib/verified-emails/registrar-detect";

// Looks up a domain's authoritative nameservers and maps them to a known DNS
// provider, so the DNS-setup screen can pre-select the right step-guide. Best
// effort: any failure (no NS, lookup error, unknown provider) returns
// { registrar: null } and the UI just falls back to the manual picker.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await requireSession();

  let domain: unknown;
  try {
    ({ domain } = await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!domain || typeof domain !== "string") {
    return NextResponse.json({ error: "Missing domain" }, { status: 400 });
  }

  // Only allow a plausible hostname (no scheme/path/spaces) to avoid using this
  // as an arbitrary resolver.
  const host = domain.trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
    return NextResponse.json({ registrar: null, nameservers: [] });
  }

  try {
    const nameservers = await dns.resolveNs(host);
    return NextResponse.json({ registrar: detectRegistrarFromNameservers(nameservers), nameservers });
  } catch {
    return NextResponse.json({ registrar: null, nameservers: [] });
  }
}
