import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getChainActivity } from "@/lib/services/chains";
import { canViewChain } from "@/lib/chain/permissions";
import { externalMemberChainAccess } from "@/lib/chain/external-scope";
import type { Session } from "next-auth";

// Fetches the chain's participant list for the permission gate. Returns null
// when the chain doesn't exist or the viewer isn't allowed to see it.
async function assertParticipant(session: Session, chainId: string): Promise<boolean> {
  // An external business member is scoped to chains their own sales are in (B1),
  // not the internal-staff shortcut in canViewChain.
  const ext = await externalMemberChainAccess(session, chainId);
  if (ext) return ext.participates;
  const chain = await prisma.propertyChain.findUnique({
    where: { id: chainId },
    select: {
      links: { select: { claimedByUserId: true, createdByUserId: true } },
    },
  });
  if (!chain) return false;
  return canViewChain(chain.links, session.user.id, session.user.role);
}

// GET /api/chains/activity?chainId=... — the viewer's opt-in state + the feed.
// Events are only returned when the viewer has opted in; the card renders the
// off-state copy otherwise.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const chainId = req.nextUrl.searchParams.get("chainId");
  if (!chainId) return NextResponse.json({ error: "Missing chainId" }, { status: 400 });

  if (!(await assertParticipant(session as Session, chainId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { chainActivityOptIn: true },
  });
  const optedIn = me?.chainActivityOptIn ?? false;

  const events = optedIn ? await getChainActivity(chainId, session.user.id) : [];
  return NextResponse.json({ optedIn, events });
}

// POST /api/chains/activity — flip the viewer's activity-feed opt-in.
// Body: { enabled: boolean }. The preference is per-agent and persists across
// every chain they view.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const enabled = body?.enabled === true;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { chainActivityOptIn: enabled },
  });

  const chainId = typeof body?.chainId === "string" ? body.chainId : null;
  let events: Awaited<ReturnType<typeof getChainActivity>> = [];
  if (enabled && chainId) {
    if (await assertParticipant(session as Session, chainId)) {
      events = await getChainActivity(chainId, session.user.id);
    }
  }

  return NextResponse.json({ optedIn: enabled, events });
}
