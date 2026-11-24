import { commandDb } from "@/lib/command/prisma";
import { PageGallery, type GalleryGroup, type GalleryItem } from "@/components/command/PageGallery";

export const metadata = { title: "Page gallery · Command Centre" };
// Always re-resolve the seed tokens on load (don't cache them).
export const dynamic = "force-dynamic";

function keep(items: (GalleryItem | string | false | null | undefined)[]): GalleryItem[] {
  return items.filter((x): x is GalleryItem => !!x && typeof x === "object");
}

export default async function CommandPagesGallery() {
  // Resolve representative seed tokens across all data (commandDb — full access,
  // superadmin tool). Best-effort: a missing token just drops its links.
  const [tspContact, nonTspContact, claimLink, moveInvite] = await Promise.all([
    commandDb.contact
      .findFirst({ where: { portalToken: { not: null }, transaction: { progressionBusiness: { isTsp: true } } }, select: { portalToken: true }, orderBy: { updatedAt: "desc" } })
      .catch(() => null),
    commandDb.contact
      .findFirst({ where: { portalToken: { not: null }, transaction: { OR: [{ progressionBusiness: null }, { progressionBusiness: { isTsp: false } }] } }, select: { portalToken: true }, orderBy: { updatedAt: "desc" } })
      .catch(() => null),
    commandDb.chainLink
      .findFirst({ where: { transactionId: null, inviteStatus: { not: "CLAIMED" }, inviteToken: { not: null }, OR: [{ inviteTokenExpiresAt: null }, { inviteTokenExpiresAt: { gt: new Date() } }] }, select: { inviteToken: true }, orderBy: { createdAt: "desc" } })
      .catch(() => null),
    commandDb.negotiatorInvitation
      .findFirst({ where: { acceptedAt: null, cancelledAt: null }, select: { token: true }, orderBy: { createdAt: "desc" } })
      .catch(() => null),
  ]);

  const quoteTok = tspContact?.portalToken ?? null;
  const nonTspTok = nonTspContact?.portalToken ?? null;
  const claimTok = claimLink?.inviteToken ?? null;
  const moveTok = moveInvite?.token ?? null;

  const groups: GalleryGroup[] = [
    {
      category: "Client notices",
      blurb: "Email-link pages. Tokens + params seeded automatically.",
      items: keep([
        quoteTok && { label: "Feedback survey", url: `/feedback/${quoteTok}/survey` },
        { label: "Chases paused · confirm", url: "/chases-paused?t=preview" },
        { label: "Chases paused · paused (date)", url: "/chases-paused?status=ok&until=2026-12-01" },
        { label: "Chases paused · paused", url: "/chases-paused?status=ok" },
        { label: "Chases paused · link expired", url: "/chases-paused?status=expired" },
        { label: "Unsubscribe · confirm (buyer/seller)", url: "/unsubscribed?t=preview&type=contact" },
        { label: "Unsubscribe · confirm (sender)", url: "/unsubscribed?t=preview" },
        { label: "Unsubscribe · done (buyer/seller)", url: "/unsubscribed?status=ok&type=contact" },
        { label: "Unsubscribe · done (sender)", url: "/unsubscribed?status=ok" },
        { label: "Unsubscribe · not recognised", url: "/unsubscribed" },
      ]),
    },
    {
      category: "Invite / claim",
      blurb: claimTok ? undefined : "No live invite token found in the database.",
      items: keep([
        claimTok && { label: "Claim landing", url: `/claim?token=${claimTok}` },
        claimTok && { label: "Claim signup", url: `/claim/signup?token=${claimTok}` },
        claimTok && { label: "Claim login", url: `/claim/login?token=${claimTok}`, note: "redirects to confirm when logged in" },
        claimTok && { label: "Claim confirm", url: `/claim/confirm?token=${claimTok}`, note: "needs a logged-in agent" },
        claimTok && { label: "Claim decline", url: `/claim/decline?token=${claimTok}`, note: "visiting declines this invite" },
      ]),
    },
    {
      category: "Quote",
      blurb: quoteTok ? undefined : "No TSP-progressed contact found.",
      items: keep([
        quoteTok && { label: "Quote flow", url: `/quote/${quoteTok}` },
        quoteTok && { label: "Quote · onward mode", url: `/quote/${quoteTok}?onward=1` },
        nonTspTok && { label: "Quote · dead-end (non-TSP)", url: `/quote/${nonTspTok}` },
      ]),
    },
    {
      category: "Sign-in",
      blurb: "These redirect when you're logged in. Use New tab (private window).",
      items: keep([
        { label: "Login", url: "/login", note: "redirects when logged in" },
        { label: "Register", url: "/register", note: "redirects when logged in" },
        { label: "Forgot password", url: "/forgot-password", note: "redirects when logged in" },
        { label: "Reset password", url: "/reset-password?token=preview&email=test@x.co", note: "redirects when logged in" },
      ]),
    },
    {
      category: "Move agency",
      items: keep([
        moveTok
          ? { label: "Move invite", url: `/move-invite/${moveTok}`, note: "flag-gated; redirects when the feature is off" }
          : { label: "Move invite", url: "/move-invite/none", note: "no live invite found; flag-gated" },
      ]),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#fafafa", letterSpacing: "-0.01em" }}>Page gallery</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#737373", lineHeight: 1.5 }}>
          Click through every client-facing page and state, loaded live. Seed tokens resolve automatically, so there&apos;s nothing to set up.
        </p>
      </div>
      <PageGallery groups={groups} heightCss="calc(100vh - 11rem)" />
    </div>
  );
}
