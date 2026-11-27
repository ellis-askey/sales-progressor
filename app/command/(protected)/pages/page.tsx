import { commandDb } from "@/lib/command/prisma";
import { FOUNDER_EMAILS } from "@/lib/security/founder";
import { PageGallery, type GalleryGroup, type GalleryItem, type PreviewSet } from "@/components/command/PageGallery";

export const metadata = { title: "Page gallery · Command Centre" };
// Always re-resolve the seed tokens on load (don't cache them).
export const dynamic = "force-dynamic";

function keep(items: (GalleryItem | string | false | null | undefined)[]): GalleryItem[] {
  return items.filter((x): x is GalleryItem => !!x && typeof x === "object");
}

// Everything that was already in the gallery is founder-signed-off; tag those
// groups so they render with a filled tick. Newly-added (to-review) groups omit
// signedOff and render a hollow click-to-approve ring instead.
function signed(items: GalleryItem[]): GalleryItem[] {
  return items.map((it) => ({ ...it, signedOff: true }));
}

// The signed-off agent account surface (/agent/account/*) and the parallel
// external-business settings surface (/agent/settings/*). Previewed as the
// chosen sample user via ?__previewAs on the frame; labels only.
const AGENT_PAGES: GalleryGroup[] = [
  {
    category: "Account settings",
    items: signed([
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
    ]),
  },
];
const SALESPROG_PAGES: GalleryGroup[] = [
  {
    category: "Business settings",
    items: signed([
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
    ]),
  },
];

export default async function CommandPagesGallery() {
  // Resolve representative seed tokens across all data (commandDb — full access,
  // superadmin tool). Best-effort: a missing token just drops its links.
  const [tspContact, nonTspContact, claimLink, moveInvite, director, negotiator, bizOwner, bizProgressor, founderAgent, directorInvite, negotiatorInvite] = await Promise.all([
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
    commandDb.user.findFirst({ where: { role: "director", agencyId: { not: null } }, select: { id: true, agencyId: true }, orderBy: { createdAt: "asc" } }).catch(() => null),
    commandDb.user.findFirst({ where: { role: "negotiator", agencyId: { not: null } }, select: { id: true }, orderBy: { createdAt: "asc" } }).catch(() => null),
    commandDb.user.findFirst({ where: { progressionBusinessRole: "owner", progressionBusiness: { isTsp: false } }, select: { id: true, progressionBusinessId: true }, orderBy: { createdAt: "asc" } }).catch(() => null),
    commandDb.user.findFirst({ where: { progressionBusinessRole: "progressor", progressionBusiness: { isTsp: false } }, select: { id: true }, orderBy: { createdAt: "asc" } }).catch(() => null),
    // A founder-email internal account (superadmin/admin), to preview the
    // internal + founder-gated agent pages (Focus cockpit, Progressor Network)
    // that a plain director/business session would 404 on. A founder superadmin
    // satisfies both the internal-staff gate and the founder-email gate.
    commandDb.user.findFirst({ where: { email: { in: [...FOUNDER_EMAILS] }, role: { in: ["superadmin", "admin"] } }, select: { id: true }, orderBy: { createdAt: "asc" } }).catch(() => null),
    // Pending invite tokens for the two public invite-landing pages.
    commandDb.directorInvitation
      .findFirst({ where: { acceptedAt: null, cancelledAt: null, expiresAt: { gt: new Date() } }, select: { token: true }, orderBy: { createdAt: "desc" } })
      .catch(() => null),
    commandDb.negotiatorInvitation
      .findFirst({ where: { acceptedAt: null, cancelledAt: null }, select: { token: true }, orderBy: { createdAt: "desc" } })
      .catch(() => null),
  ]);

  const quoteTok = tspContact?.portalToken ?? null;
  const nonTspTok = nonTspContact?.portalToken ?? null;
  const claimTok = claimLink?.inviteToken ?? null;
  const moveTok = moveInvite?.token ?? null;
  const dirInviteTok = directorInvite?.token ?? null;
  const negInviteTok = negotiatorInvite?.token ?? null;

  // A representative sale the sample director can actually open, so the file
  // sub-tabs (/agent/transactions/[id]/*) render instead of 404-ing. Scoped to
  // the director's agency; the preview borrows that director's session.
  const agentTx = director?.agencyId
    ? await commandDb.propertyTransaction
        .findFirst({ where: { agencyId: director.agencyId }, select: { id: true }, orderBy: { updatedAt: "desc" } })
        .catch(() => null)
    : null;
  const txId = agentTx?.id ?? null;

  // A client agency the sample business owner actually serves, so the client
  // workspace (/agent/clients/[agencyId]) opens instead of 404-ing. Scoped to
  // the owner's own business; the preview borrows that owner's session.
  const clientLink = bizOwner?.progressionBusinessId
    ? await commandDb.progressionBusinessClient
        .findFirst({ where: { progressionBusinessId: bizOwner.progressionBusinessId }, select: { agencyId: true }, orderBy: { createdAt: "desc" } })
        .catch(() => null)
    : null;
  const clientAgencyId = clientLink?.agencyId ?? null;

  // A solicitor firm the sample director's agency actually works with, so the
  // partner profile (/agent/partners/solicitor/[id]) resolves for that viewer.
  const partnerFirm = director?.agencyId
    ? await commandDb.solicitorFirm
        .findFirst({
          where: {
            isDemo: false,
            OR: [
              { vendorForTransactions: { some: { agencyId: director.agencyId } } },
              { purchaserForTransactions: { some: { agencyId: director.agencyId } } },
            ],
          },
          select: { id: true },
          orderBy: { updatedAt: "desc" },
        })
        .catch(() => null)
    : null;
  const partnerFirmId = partnerFirm?.id ?? null;

  // ── New (to-review) surfaces. These omit signedOff, so they render a hollow
  // click-to-approve ring. Seed-dependent links drop out via keep() when their
  // id is null. Built inside the component because they need the resolved ids.

  // The main agency workspace (previewed as the sample director).
  const AGENT_WORKSPACE: GalleryGroup = {
    category: "Workspace",
    items: keep([
      { label: "Hub", url: "/agent/hub" },
      { label: "All files", url: "/agent/transactions" },
      { label: "New sale", url: "/agent/transactions/new" },
      { label: "Migrate a sale", url: "/agent/transactions/migrate", note: "allowlist / feature gated" },
      { label: "Chains", url: "/agent/chains" },
      { label: "Enquiries", url: "/agent/enquiries" },
      { label: "Work queue", url: "/agent/work-queue" },
      { label: "Completions", url: "/agent/completions" },
      { label: "Comms", url: "/agent/comms" },
      { label: "To-do", url: "/agent/to-do" },
      { label: "Analytics", url: "/agent/analytics" },
      { label: "Automated emails", url: "/agent/automated-emails" },
      { label: "What's new", url: "/agent/whats-new", note: "404s when there are no updates" },
      { label: "Partners", url: "/agent/partners" },
      partnerFirmId && { label: "Partner firm profile", url: `/agent/partners/solicitor/${partnerFirmId}` },
    ]),
  };
  // A live sale's file tabs (need a seeded sale id the director can open).
  const AGENT_FILE: GalleryGroup = {
    category: "A sale (file)",
    blurb: txId ? undefined : "No sale found for the sample director.",
    items: keep([
      txId && { label: "Overview", url: `/agent/transactions/${txId}` },
      txId && { label: "File setup", url: `/agent/transactions/${txId}/setup` },
      txId && { label: "Steps", url: `/agent/transactions/${txId}/milestones` },
      txId && { label: "Chain", url: `/agent/transactions/${txId}/chain` },
      txId && { label: "Reminders", url: `/agent/transactions/${txId}/reminders` },
      txId && { label: "Chase timeline", url: `/agent/transactions/${txId}/chase`, note: "self-managed / internal only" },
      txId && { label: "To-do", url: `/agent/transactions/${txId}/todos` },
      txId && { label: "Documents", url: `/agent/transactions/${txId}/documents` },
      txId && { label: "WhatsApp", url: `/agent/transactions/${txId}/whatsapp` },
      txId && { label: "Client portal (preview)", url: `/agent/transactions/${txId}/client-portal` },
    ]),
  };
  // Sales-prog-business client surfaces (owner-gated; preview as Owner).
  const SALESPROG_CLIENTS: GalleryGroup = {
    category: "Clients & invoicing",
    items: keep([
      { label: "Clients", url: "/agent/clients", note: "owner only" },
      clientAgencyId && { label: "Client workspace", url: `/agent/clients/${clientAgencyId}`, note: "owner only" },
      { label: "Client invoices", url: "/agent/settings/invoices", note: "owner only" },
    ]),
  };
  // Internal + founder-gated agent pages (preview as the founder superadmin).
  const FOUNDER_PAGES: GalleryGroup[] = [
    {
      category: "Founder / internal",
      blurb: "Internal + founder-gated agent pages.",
      items: keep([
        { label: "Focus (internal cockpit)", url: "/agent/focus" },
        { label: "Progressor Network", url: "/agent/progressor-network" },
      ]),
    },
  ];

  const previewSets: PreviewSet[] = [
    {
      id: "agent",
      label: "Agent",
      roles: [
        { id: "director", label: "Director", userId: director?.id ?? null },
        { id: "negotiator", label: "Negotiator", userId: negotiator?.id ?? null },
      ],
      groups: [AGENT_WORKSPACE, AGENT_FILE, ...AGENT_PAGES],
    },
    {
      id: "salesprog",
      label: "Sales-prog business",
      roles: [
        { id: "owner", label: "Owner", userId: bizOwner?.id ?? null },
        { id: "progressor", label: "Team member", userId: bizProgressor?.id ?? null },
      ],
      groups: [SALESPROG_CLIENTS, ...SALESPROG_PAGES],
    },
    {
      id: "founder",
      label: "Founder / internal",
      roles: [{ id: "founder", label: "Founder (superadmin)", userId: founderAgent?.id ?? null }],
      groups: FOUNDER_PAGES,
    },
  ];

  const groups: GalleryGroup[] = [
    {
      category: "Client notices",
      blurb: "Email-link pages. Tokens + params seeded automatically.",
      items: signed(keep([
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
      ])),
    },
    {
      category: "Invite / claim",
      blurb: claimTok ? undefined : "No live invite token found in the database.",
      items: signed(keep([
        claimTok && { label: "Claim landing", url: `/claim?token=${claimTok}` },
        claimTok && { label: "Claim signup", url: `/claim/signup?token=${claimTok}` },
        claimTok && { label: "Claim login", url: `/claim/login?token=${claimTok}`, note: "redirects to confirm when logged in" },
        claimTok && { label: "Claim confirm", url: `/claim/confirm?token=${claimTok}`, note: "needs a logged-in agent" },
        claimTok && { label: "Claim decline", url: `/claim/decline?token=${claimTok}`, note: "visiting declines this invite" },
      ])),
    },
    {
      category: "Quote",
      blurb: quoteTok ? undefined : "No TSP-progressed contact found.",
      items: signed(keep([
        quoteTok && { label: "Quote flow", url: `/quote/${quoteTok}` },
        quoteTok && { label: "Quote · onward mode", url: `/quote/${quoteTok}?onward=1` },
        nonTspTok && { label: "Quote · dead-end (non-TSP)", url: `/quote/${nonTspTok}` },
      ])),
    },
    {
      category: "Sign-in",
      blurb: "These redirect when you're logged in. Use New tab (private window).",
      items: signed(keep([
        { label: "Login", url: "/login", note: "redirects when logged in" },
        { label: "Register", url: "/register", note: "redirects when logged in" },
        { label: "Forgot password", url: "/forgot-password", note: "redirects when logged in" },
        { label: "Reset password", url: "/reset-password?token=preview&email=test@x.co", note: "redirects when logged in" },
      ])),
    },
    {
      category: "Move agency",
      items: signed(keep([
        moveTok
          ? { label: "Move invite", url: `/move-invite/${moveTok}`, note: "flag-gated; redirects when the feature is off" }
          : { label: "Move invite", url: "/move-invite/none", note: "no live invite found; flag-gated" },
      ])),
    },
    // ── New (to-review) public pages. Hollow ring until signed off. ──
    {
      category: "Team invites",
      blurb: dirInviteTok || negInviteTok ? undefined : "No live invite token found in the database.",
      items: keep([
        dirInviteTok && { label: "Director invite · landing", url: `/invite/${dirInviteTok}` },
        dirInviteTok && { label: "Director invite · set password", url: `/invite/${dirInviteTok}/password` },
        negInviteTok && { label: "Negotiator invite · landing", url: `/invite-negotiator/${negInviteTok}` },
        negInviteTok && { label: "Negotiator invite · set password", url: `/invite-negotiator/${negInviteTok}/password` },
      ]),
    },
    {
      category: "Marketing & legal",
      items: keep([
        { label: "Outsource intake", url: "/outsource" },
        { label: "Help centre", url: "/help" },
        { label: "Terms of service", url: "/terms" },
        { label: "Privacy policy", url: "/privacy" },
        { label: "Cookie policy", url: "/cookie-policy" },
        { label: "Legal index", url: "/legal" },
        { label: "Data processing agreement", url: "/legal/dpa" },
        { label: "Billing terms", url: "/billing-terms" },
        { label: "Outsourced terms", url: "/outsourced-terms" },
        { label: "Provider request terms", url: "/provider-terms" },
        { label: "Progression-business terms", url: "/progression-business-terms" },
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
