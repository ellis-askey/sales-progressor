import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChainV2, addChainLink } from "@/lib/services/chains";
import { canAddAbove, canAddBelow, canViewChain } from "@/lib/chain/permissions";
import { prisma } from "@/lib/prisma";
import { sendChainInvite } from "@/lib/chain/invite";
import { normaliseAddressString } from "@/lib/utils/address";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/chains/[id]/links — add a stub link above or below
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id: chainId } = await params;
  const chain = await getChainV2(chainId);
  if (!chain) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Must be a chain participant to add links
  const allLinks = chain.links.map((l) => ({
    claimedByUserId: l.claimedByUserId,
    createdByUserId: l.createdByUserId,
  }));
  if (!canViewChain(allLinks, session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    direction: "above" | "below";
    stubPropertyAddress: string;
    stubAgencyName: string;
    stubAgentEmail?: string | null;
    stubAgentName?: string | null;
    stubAgentPhone?: string | null;
    stubNotes?: string | null;
    sendInviteNow?: boolean;
  };

  if (!body.direction || !body.stubPropertyAddress || !body.stubAgencyName) {
    return NextResponse.json(
      { error: "direction, stubPropertyAddress and stubAgencyName are required" },
      { status: 400 },
    );
  }

  // Find the user's own link to determine if they have add permission
  const usersOwnLink = chain.links.find(
    (l) => l.claimedByUserId === session.user.id || l.createdByUserId === session.user.id,
  );

  if (!usersOwnLink) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.direction === "above" && !canAddAbove(usersOwnLink, session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.direction === "below" && !canAddBelow(usersOwnLink, session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Normalise the postcode portion of the stub address before persisting
  // so chain-invite emails and downstream displays never render "bs1 4pn"
  // style garbage. Leaves street/city untouched — postcode is the only
  // segment with a canonical form.
  const updatedChain = await addChainLink({
    chainId,
    userId: session.user.id,
    direction: body.direction,
    stubPropertyAddress: normaliseAddressString(body.stubPropertyAddress),
    stubAgencyName: body.stubAgencyName,
    stubAgentEmail: body.stubAgentEmail ?? null,
    stubAgentName: body.stubAgentName ?? null,
    stubAgentPhone: body.stubAgentPhone ?? null,
    stubNotes: body.stubNotes ?? null,
  });

  // Auto-send invite when client requested it AND a valid email is present.
  // Mirrors the client's EMAIL_RE so the auto-send + the manual "Send invite"
  // button accept the same set of addresses.
  let inviteSent = false;
  const email = body.stubAgentEmail?.trim().toLowerCase() ?? "";
  if (body.sendInviteNow && email && EMAIL_RE.test(email)) {
    const newLink = await prisma.chainLink.findFirst({
      where: {
        chainId,
        createdByUserId: session.user.id,
        stubAgentEmail: email,
        transactionId: null,
        inviteStatus: "NOT_SENT",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        stubAgentEmail: true,
        stubAgentName: true,
        stubPropertyAddress: true,
        stubAgencyName: true,
        inviteStatus: true,
        inviteResendCount: true,
        chain: {
          select: {
            createdByUserId: true,
            links: {
              orderBy: { position: "asc" },
              select: {
                position: true,
                transactionId: true,
                stubPropertyAddress: true,
                transaction: { select: { propertyAddress: true } },
              },
            },
          },
        },
      },
    });

    if (newLink) {
      try {
        await sendChainInvite({
          link: newLink,
          sentByUserId: session.user.id,
          sentByName: session.user.name ?? "",
        });
        inviteSent = true;
      } catch (err) {
        // Don't fail the POST if the invite send itself errors — the stub is
        // already created and the agent can retry via the manual resend button.
        console.error("sendChainInvite failed", err);
      }
    }
  }

  return NextResponse.json({ chain: updatedChain, inviteSent }, { status: 201 });
}
