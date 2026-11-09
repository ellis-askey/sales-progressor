import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeTransactionWhere } from "@/lib/security/access-scope";

// GET /api/chains/link-candidates?q=&direction=&exclude= — the caller's OWN live
// files that could be dropped into a NEW sale's chain. The chainless sibling of
// /api/chains/[id]/link-candidates: during New Sale there is no chain yet, so we
// can't scope "other than this chain". Agency-scoped via the access-scope helper
// (Law 7).
//
// `direction` guards the merge: a file that already has its own chain only folds
// in cleanly when it sits at the SAFE END for the chosen direction — adding it
// ABOVE the new sale needs nothing below it in its own chain; adding it BELOW
// needs nothing above it. Otherwise the fold would wedge its other sales into
// the wrong place, so the file is marked not-joinable. `exclude` drops files
// already picked in the form.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const direction = req.nextUrl.searchParams.get("direction") === "below" ? "below" : "above";
  const exclude = (req.nextUrl.searchParams.get("exclude") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const scope = getAccessScope(session);

  const rows = await prisma.propertyTransaction.findMany({
    where: {
      AND: [
        scopeTransactionWhere(scope),
        { status: { in: ["active", "on_hold"] } },
        exclude.length ? { id: { notIn: exclude } } : {},
        q ? { propertyAddress: { contains: q, mode: "insensitive" } } : {},
      ],
    },
    select: {
      id: true,
      propertyAddress: true,
      chainLink: {
        select: {
          position: true,
          branchKey: true,
          chain: { select: { links: { select: { transactionId: true, position: true, branchKey: true } } } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  // Authorise every companion sale in one scope query — a merge may only fold in
  // a chain whose other joined sales are all the caller's to move (Law 7).
  const companionIds = Array.from(
    new Set(
      rows.flatMap((r) =>
        (r.chainLink?.chain.links ?? [])
          .map((l) => l.transactionId)
          .filter((id): id is string => Boolean(id) && id !== r.id),
      ),
    ),
  );
  const inScope = new Set(
    companionIds.length === 0
      ? []
      : (
          await prisma.propertyTransaction.findMany({
            where: { AND: [scopeTransactionWhere(scope), { id: { in: companionIds } }] },
            select: { id: true },
          })
        ).map((t) => t.id),
  );

  const files = rows.map((r) => {
    if (!r.chainLink) return { id: r.id, propertyAddress: r.propertyAddress, chain: null };
    const spine = r.chainLink.chain.links.filter((l) => (l.branchKey ?? "") === "");
    const companions = r.chainLink.chain.links
      .map((l) => l.transactionId)
      .filter((id): id is string => Boolean(id) && id !== r.id);
    const onSpine = (r.chainLink.branchKey ?? "") === "";
    const companionsOk = companions.every((id) => inScope.has(id));
    // Higher position = further DOWN the chain (createChainV2 puts above-stubs at
    // low positions, below-stubs at high). So "nothing below" = this file is the
    // max position on its spine; "nothing above" = the min.
    const positions = spine.map((l) => l.position);
    const atSafeEnd =
      direction === "above"
        ? r.chainLink.position === Math.max(...positions)
        : r.chainLink.position === Math.min(...positions);
    const joinable = onSpine && companionsOk && atSafeEnd;
    return { id: r.id, propertyAddress: r.propertyAddress, chain: { others: r.chainLink.chain.links.length - 1, joinable } };
  });

  return NextResponse.json({ files });
}
