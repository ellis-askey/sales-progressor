import { commandDb } from "@/lib/command/prisma";
import { PageGallery, type GalleryGroup, type GalleryItem, type PreviewSet } from "@/components/command/PageGallery";

export const metadata = { title: "Page gallery · Command Centre" };
// Always re-resolve the seed tokens on load (don't cache them).
export const dynamic = "force-dynamic";

function keep(items: (GalleryItem | string | false | null | undefined)[]): GalleryItem[] {
  return items.filter((x): x is GalleryItem => !!x && typeof x === "object");
}

// The signed-off agent account surface (/agent/account/*) and the parallel
// external-business settings surface (/agent/settings/*). Previewed as the
// chosen sample user via ?__previewAs on the frame; labels only.
const AGENT_PAGES: GalleryGroup[] = [
  {
    category: "Account settings",
    items: [
      { label: "Billing", url: "/agent/account/billing" },
      { label: "Profile", url: "/agent/account/profile" },
      { label: "Team", url: "/agent/account/team" },
      { label: "Emails", url: "/agent/account/emails" },
      { label: "Email templates", url: "/agent/account/email-templates" },
      { label: "Automated chasing", url: "/agent/account/chasing" },
      { label: "Client portal", url: "/agent/account/client-portal" },
      { label: "Welcome call", url: "/agent/account/welcome-call" },
      { label: "Notifications", url: "/agent/account/notifications" },
      { label: "Connections", url: "/agent/account/connections" },
      { label: "Connect CRM", url: "/agent/account/connect-crm" },
      { label: "Security", url: "/agent/account/security" },
    ],
  },
];
const SALESPROG_PAGES: GalleryGroup[] = [
  {
    category: "Business settings",
    items: [
      { label: "Billing", url: "/agent/settings/billing" },
      { label: "Business", url: "/agent/settings/business" },
      { label: "Profile", url: "/agent/settings/profile" },
      { label: "Chases", url: "/agent/settings/chases" },
      { label: "Client portal", url: "/agent/settings/client-portal" },
      { label: "Email templates", url: "/agent/settings/email-templates" },
      { label: "Emails", url: "/agent/settings/emails" },
      { label: "Notifications", url: "/agent/settings/notifications" },
      { label: "Connections", url: "/agent/settings/connections" },
      { label: "Security", url: "/agent/settings/security" },
      { label: "Team", url: "/agent/team" },
    ],
  },
];

export default async function CommandPagesGallery() {
  // Resolve representative seed tokens across all data (commandDb — full access,
  // superadmin tool). Best-effort: a missing token just drops its links.
  const [tspContact, nonTspContact, claimLink, moveInvite, director, negotiator, bizOwner, bizProgressor] = await Promise.all([
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
    // Representative sample users for the logged-in-page preview — one per
    // (business type × role). Real users (nothing created / nothing to hide):
    // the frame borrows their session look-only. A null just disables that role.
    commandDb.user.findFirst({ where: { role: "director", agencyId: { not: null } }, select: { id: true }, orderBy: { createdAt: "asc" } }).catch(() => null),
    commandDb.user.findFirst({ where: { role: "negotiator", agencyId: { not: null } }, select: { id: true }, orderBy: { createdAt: "asc" } }).catch(() => null),
    commandDb.user.findFirst({ where: { progressionBusinessRole: "owner", progressionBusiness: { isTsp: false } }, select: { id: true }, orderBy: { createdAt: "asc" } }).catch(() => null),
    commandDb.user.findFirst({ where: { progressionBusinessRole: "progressor", progressionBusiness: { isTsp: false } }, select: { id: true }, orderBy: { createdAt: "asc" } }).catch(() => null),
  ]);

  const quoteTok = tspContact?.portalToken ?? null;
  const nonTspTok = nonTspContact?.portalToken ?? null;
  const claimTok = claimLink?.inviteToken ?? null;
  const moveTok = moveInvite?.token ?? null;

  const previewSets: PreviewSet[] = [
    {
      id: "agent",
      label: "Agent",
      roles: [
        { id: "director", label: "Director", userId: director?.id ?? null },
        { id: "negotiator", label: "Negotiator", userId: negotiator?.id ?? null },
      ],
      groups: AGENT_PAGES,
    },
    {
      id: "salesprog",
      label: "Sales-prog business",
      roles: [
        { id: "owner", label: "Owner", userId: bizOwner?.id ?? null },
        { id: "progressor", label: "Team member", userId: bizProgressor?.id ?? null },
      ],
      groups: SALESPROG_PAGES,
    },
  ];

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
          Click through every page and state, loaded live. Client pages resolve their seed tokens automatically; logged-in pages preview as a sample user of the business type and role you pick, look-only.
        </p>
      </div>
      <PageGallery groups={groups} preview={previewSets} heightCss="calc(100vh - 11rem)" />
    </div>
  );
}
