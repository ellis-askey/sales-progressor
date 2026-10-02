// Progression-business client management (Phase 4).
//
// A progression business owner adds an estate agent as a CLIENT: this creates
// the agent's own single-director agency + a pending director account, and a
// ProgressionBusinessClient link. The link is client management ONLY — it never
// grants the business access to any of that agency's transactions. Access is
// always decided by PropertyTransaction.progressionBusinessId
// (lib/security/access-scope.ts). See docs/active/progression-businesses/.

import { prisma } from "@/lib/prisma";
import { createDirectorWithAgency } from "@/lib/auth/create-director-with-agency";
import { sendClientAgentSetupEmail } from "@/lib/emails/client-agent-invite";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { getAgencyLogoUrl, getAvatarPublicUrl } from "@/lib/supabase-storage";
import { calculateClientFee, parseFeeModel, type ClientFeeModel } from "@/lib/progression/client-fees";
import { sanitizeEmailThemeInput, type EmailThemeInput } from "@/lib/email/brand-theme";
import type { LogoScale, LogoAlign } from "@/lib/image/logo";
import type { Session } from "next-auth";

export type BusinessOwner = { businessId: string; userId: string };

/**
 * Resolve the acting user to a progression-business OWNER, or null if they are
 * not an owner. Looked up from the DB (not the session) so business-role changes
 * take effect without a re-login; add-client is a rare action, not a hot path.
 */
export async function resolveBusinessOwner(session: Session): Promise<BusinessOwner | null> {
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { progressionBusinessId: true, progressionBusinessRole: true },
  });
  if (!me?.progressionBusinessId || me.progressionBusinessRole !== "owner") return null;
  return { businessId: me.progressionBusinessId, userId: session.user.id };
}

/**
 * Flag-gated boolean: is the viewer a progression-business owner? Used to pick
 * owner-facing empty-state copy (their files come from clients they add, not
 * from being assigned work) without repeating the flag + owner check on every
 * surface. Flag off short-circuits with no query.
 */
export async function isBusinessOwnerViewer(session: Session): Promise<boolean> {
  if (!progressionBusinessesEnabled()) return false;
  return (await resolveBusinessOwner(session)) !== null;
}

/**
 * Is the viewer a member (owner OR team) of an EXTERNAL progression business —
 * i.e. a sales_progressor whose business is not TSP? True for anyone who sees a
 * whole business book rather than TSP's per-user assigned work. Used to pick
 * business-book framing (titles/columns/empty states) without ever touching TSP
 * staff: a TSP sales_progressor (isTsp business, or none) returns false. Flag off
 * short-circuits with no query.
 */
export async function isExternalProgressorViewer(session: Session): Promise<boolean> {
  if (!progressionBusinessesEnabled()) return false;
  if (session.user.role !== "sales_progressor") return false;
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { progressionBusiness: { select: { isTsp: true } } },
  });
  return !!me?.progressionBusiness && !me.progressionBusiness.isTsp;
}

export type AddClientAgencyInput = {
  owner: BusinessOwner;
  agentName: string;
  agentEmail: string;
  agencyName: string;
};

export type AddClientAgencyResult =
  | { ok: true; agencyId: string; userId: string }
  | { ok: false; error: string };

/**
 * Create a client agency + its pending director + the business↔agency link.
 * The director is created WITHOUT a password (pending) — they activate their
 * login separately. Creates NO transaction and grants NO transaction access.
 */
export async function addClientAgency(input: AddClientAgencyInput): Promise<AddClientAgencyResult> {
  const email = input.agentEmail.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { ok: false, error: "An account already exists for that email." };
  }

  // Reuses the canonical agency+director creator (atomic). No password → the
  // director is pending until they set one.
  const { userId, agencyId } = await createDirectorWithAgency({
    name: input.agentName.trim(),
    email,
    role: "director",
    agencyName: input.agencyName.trim(),
  });

  await prisma.progressionBusinessClient.create({
    data: { progressionBusinessId: input.owner.businessId, agencyId },
  });

  // Best-effort onboarding email with a set-password link. A send failure is
  // logged, not fatal — the account exists and the agent can use Forgot password.
  try {
    const business = await prisma.progressionBusiness.findUnique({
      where: { id: input.owner.businessId },
      select: { name: true },
    });
    await sendClientAgentSetupEmail({ userId, email, businessName: business?.name ?? "Your progressor" });
  } catch (err) {
    console.error(`[progression] client_agent_setup email failed for ${email}`, err);
  }

  console.log(
    `[AUDIT] progression_client_added businessId=${input.owner.businessId} agencyId=${agencyId} agentUserId=${userId} by=${input.owner.userId}`,
  );
  return { ok: true, agencyId, userId };
}

export type ProgressionClient = {
  linkId: string;
  agencyId: string;
  agencyName: string;
  agent: { id: string; name: string; email: string; pending: boolean } | null;
  // Files this business progresses for the client agency (NOT the agency's whole
  // book — the link grants no visibility of the agency's other files).
  fileCount: number;
};

/** List a business's client agencies with their director + progressed-file count. */
export async function listClientsForBusiness(businessId: string): Promise<ProgressionClient[]> {
  const links = await prisma.progressionBusinessClient.findMany({
    where: { progressionBusinessId: businessId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      agency: {
        select: {
          id: true,
          name: true,
          users: {
            where: { role: "director" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { id: true, name: true, email: true, password: true },
          },
        },
      },
    },
  });

  // Count only files tagged to THIS business, grouped by agency.
  const counts = await prisma.propertyTransaction.groupBy({
    by: ["agencyId"],
    where: { progressionBusinessId: businessId },
    _count: true,
  });
  const countByAgency = new Map(counts.map((c) => [c.agencyId, c._count]));

  return links.map((l) => {
    const director = l.agency.users[0] ?? null;
    return {
      linkId: l.id,
      agencyId: l.agency.id,
      agencyName: l.agency.name,
      agent: director
        ? { id: director.id, name: director.name, email: director.email, pending: !director.password }
        : null,
      fileCount: countByAgency.get(l.agency.id) ?? 0,
    };
  });
}

// ─── Clients workspace: the richer overview powering /agent/clients ───────────

export type ClientOverviewRow = {
  linkId: string;
  agencyId: string;
  name: string;
  contact: string | null;
  email: string | null;
  pending: boolean;
  logoUrl: string | null;
  tileColor: string | null; // the logo's detected background, for the list tile
  people: number;
  active: number;
  pipelinePence: number;
  exchanged: number;
  status: "active" | "invite";
};

export type ClientsOverview = {
  // The owner's own business identity, for the Clients-header settings control.
  // shortName is the optional tight-UI label (e.g. the agent file's "Managed by"
  // badge); null falls back to name.
  business: { name: string; shortName: string | null };
  totals: { agencies: number; activeSales: number; pipelinePence: number; exchangedThisMonth: number };
  clients: ClientOverviewRow[];
};

/**
 * The Clients landing data for a progression business: per-agency rows (active
 * sales, pipeline, exchanged, people, logo, status) plus book-wide totals. Only
 * counts files tagged to THIS business (the client relationship never exposes
 * the agency's other files). One transaction read, aggregated in memory — a
 * progressor's book is small, so this stays cheap.
 */
export async function getClientsOverview(businessId: string): Promise<ClientsOverview> {
  const business = await prisma.progressionBusiness.findUnique({
    where: { id: businessId },
    select: { name: true, shortName: true },
  });

  const links = await prisma.progressionBusinessClient.findMany({
    where: { progressionBusinessId: businessId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      agency: {
        select: {
          id: true,
          name: true,
          logoPath: true,
          logoTileColor: true,
          _count: { select: { users: true } },
          users: {
            where: { role: "director" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { name: true, email: true, password: true },
          },
        },
      },
    },
  });

  const txns = await prisma.propertyTransaction.findMany({
    where: { progressionBusinessId: businessId, isDemo: false, isMigrated: false },
    select: { agencyId: true, status: true, purchasePrice: true, exchangedAt: true },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  type Agg = { active: number; pipeline: number; exchanged: number };
  const byAgency = new Map<string, Agg>();
  let totalActive = 0;
  let totalPipeline = 0;
  let exchangedThisMonth = 0;

  for (const t of txns) {
    const a = byAgency.get(t.agencyId) ?? { active: 0, pipeline: 0, exchanged: 0 };
    if (t.status === "active") {
      a.active += 1;
      a.pipeline += t.purchasePrice ?? 0;
      totalActive += 1;
      totalPipeline += t.purchasePrice ?? 0;
    }
    if (t.exchangedAt) {
      a.exchanged += 1;
      if (new Date(t.exchangedAt) >= monthStart) exchangedThisMonth += 1;
    }
    byAgency.set(t.agencyId, a);
  }

  const clients: ClientOverviewRow[] = links.map((l) => {
    const d = l.agency.users[0] ?? null;
    const agg = byAgency.get(l.agency.id) ?? { active: 0, pipeline: 0, exchanged: 0 };
    const pending = d ? !d.password : true;
    return {
      linkId: l.id,
      agencyId: l.agency.id,
      name: l.agency.name,
      contact: d?.name ?? null,
      email: d?.email ?? null,
      pending,
      logoUrl: getAgencyLogoUrl(l.agency.logoPath),
      tileColor: l.agency.logoTileColor,
      people: l.agency._count.users,
      active: agg.active,
      pipelinePence: agg.pipeline,
      exchanged: agg.exchanged,
      status: pending ? "invite" : "active",
    };
  });

  return {
    business: { name: business?.name ?? "", shortName: business?.shortName ?? null },
    totals: { agencies: links.length, activeSales: totalActive, pipelinePence: totalPipeline, exchangedThisMonth },
    clients,
  };
}

// ─── Single client agency: the detail workspace at /agent/clients/[agencyId] ──

export type AgencySale = { id: string; address: string; status: string };
export type AgencyPerson = {
  id: string; name: string; email: string; role: string; pending: boolean;
  image: string | null;          // avatar URL, if they've set a photo
  canViewAll: boolean;           // sees all the agency's sales vs only their own
  inviteExpiresAt: number | null; // epoch ms the set-up link expires (pending only)
  lastLoginAt: number | null;     // epoch ms of their last sign-in (null = never)
};
export type RemovedPerson = { id: string; name: string; email: string; image: string | null };
export type ClientAgencyFlags = {
  solicitorChase: boolean;
  enquiryChase: boolean;
  weeklyUpdate: boolean;
  portalKeyDates: boolean;
  portalCosts: boolean;
  portalProgress: boolean;
};
// The current branding state for the Branding tab's studio. Structurally the
// studio's BrandingInitial (appAccent omitted — not applicable to a client).
export type ClientBranding = {
  logoUrl: string | null;
  tileColor: string | null;
  scale: LogoScale | null;
  align: LogoAlign | null;
  theme: EmailThemeInput | null;
};

export type ClientAgencyDetail = {
  agencyId: string;
  name: string;
  logoUrl: string | null;
  brandColor: string;
  contact: string | null;
  email: string | null;
  pending: boolean;
  status: "active" | "invite";
  active: number;
  pipelinePence: number;
  exchanged: number;
  completed: number;
  withdrawn: number;
  avgDaysToExchange: number | null;
  conversionPct: number | null;
  fallThroughPct: number | null;
  completePct: number;
  checks: { label: string; done: boolean }[];
  sales: AgencySale[];
  people: AgencyPerson[];
  removedPeople: RemovedPerson[];
  flags: ClientAgencyFlags;
  branding: ClientBranding;
  feeModel: ClientFeeModel | null;
  fees: { earnedPence: number; pipelinePence: number; thisMonthPence: number; avgPence: number | null };
};

/**
 * The workspace data for one client agency. OWNER-SCOPED: returns null unless a
 * ProgressionBusinessClient link exists between this business and the agency, and
 * only ever counts files tagged to this business (never the agency's other work).
 */
export async function getClientAgencyDetail(businessId: string, agencyId: string): Promise<ClientAgencyDetail | null> {
  const link = await prisma.progressionBusinessClient.findUnique({
    where: { progressionBusinessId_agencyId: { progressionBusinessId: businessId, agencyId } },
    select: { id: true, feeModel: true },
  });
  if (!link) return null;
  const feeModel = parseFeeModel(link.feeModel);

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      id: true, name: true, logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true, emailTheme: true,
      solicitorChaseEnabled: true, enquiryReplyChaseEnabled: true, weeklyClientUpdatesEnabled: true,
      showPortalKeyDates: true, showPortalCosts: true, showPortalProgressPercent: true,
      // All users — split into active roster vs removed tombstones below.
      users: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, email: true, role: true, password: true, image: true, canViewAllFiles: true, deactivatedAt: true, lastLoginAt: true },
      },
    },
  });
  if (!agency) return null;

  const txns = await prisma.propertyTransaction.findMany({
    where: { progressionBusinessId: businessId, agencyId, isDemo: false, isMigrated: false },
    orderBy: { createdAt: "desc" },
    select: { id: true, propertyAddress: true, status: true, purchasePrice: true, exchangedAt: true, createdAt: true },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let active = 0, pipeline = 0, exchanged = 0, completed = 0, withdrawn = 0, started = 0;
  let feeEarned = 0, feePipeline = 0, feeThisMonth = 0, feeExchangedCount = 0;
  const exchangeDays: number[] = [];
  for (const t of txns) {
    if (t.status !== "draft") started += 1;
    if (t.status === "active") { active += 1; pipeline += t.purchasePrice ?? 0; }
    if (t.status === "completed") completed += 1;
    if (t.status === "withdrawn") withdrawn += 1;
    const fee = calculateClientFee(feeModel, t.purchasePrice);
    if (t.exchangedAt) {
      exchanged += 1;
      const d = Math.round((new Date(t.exchangedAt).getTime() - new Date(t.createdAt).getTime()) / 86400000);
      if (d >= 0) exchangeDays.push(d);
      if (fee != null) { feeEarned += fee; feeExchangedCount += 1; if (new Date(t.exchangedAt) >= monthStart) feeThisMonth += fee; }
    } else if (t.status === "active" && fee != null) {
      feePipeline += fee;
    }
  }
  const feeAvg = feeExchangedCount ? Math.round(feeEarned / feeExchangedCount) : null;
  const avgDaysToExchange = exchangeDays.length ? Math.round(exchangeDays.reduce((a, b) => a + b, 0) / exchangeDays.length) : null;
  const conversionPct = started ? Math.round((exchanged / started) * 100) : null;
  const fallThroughPct = started ? Math.round((withdrawn / started) * 100) : null;

  // Active roster vs removed (soft-deleted to `viewer` with deactivatedAt).
  const activeUsers = agency.users.filter((u) => u.role === "director" || u.role === "negotiator");
  const removedUsers = agency.users.filter((u) => u.role === "viewer" && u.deactivatedAt);
  const director = activeUsers.find((u) => u.role === "director") ?? activeUsers[0] ?? null;
  const pending = director ? !director.password : true;

  // Invite expiry for pending people, from their set-password verificationToken.
  const pendingEmails = activeUsers.filter((u) => !u.password).map((u) => u.email.toLowerCase());
  const expiryByEmail = new Map<string, number>();
  if (pendingEmails.length) {
    const tokens = await prisma.verificationToken.findMany({
      where: { identifier: { in: pendingEmails } },
      select: { identifier: true, expires: true },
    });
    for (const t of tokens) {
      const e = t.expires.getTime();
      if (!expiryByEmail.has(t.identifier) || e > expiryByEmail.get(t.identifier)!) expiryByEmail.set(t.identifier, e);
    }
  }

  const theme = (agency.emailTheme ?? {}) as Record<string, unknown>;
  const themeColor = typeof theme.buttonColor === "string" ? theme.buttonColor : null;
  const brandColor = themeColor || agency.logoTileColor || "#FF6B4A";

  const checks = [
    { label: "Logo added", done: !!agency.logoPath },
    { label: "Brand colour", done: !!themeColor },
    { label: "Agent joined", done: !pending },
    { label: "First sale", done: txns.length > 0 },
  ];
  const completePct = Math.round((checks.filter((c) => c.done).length / checks.length) * 100);

  return {
    agencyId: agency.id,
    name: agency.name,
    logoUrl: getAgencyLogoUrl(agency.logoPath),
    brandColor,
    contact: director?.name ?? null,
    email: director?.email ?? null,
    pending,
    status: pending ? "invite" : "active",
    active, pipelinePence: pipeline, exchanged,
    completed, withdrawn, avgDaysToExchange, conversionPct, fallThroughPct,
    completePct, checks,
    sales: txns.map((t) => ({ id: t.id, address: t.propertyAddress, status: t.status })),
    people: activeUsers.map((u) => ({
      id: u.id, name: u.name, email: u.email, role: u.role, pending: !u.password,
      image: getAvatarPublicUrl(u.image), canViewAll: u.canViewAllFiles,
      inviteExpiresAt: !u.password ? (expiryByEmail.get(u.email.toLowerCase()) ?? null) : null,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.getTime() : null,
    })),
    removedPeople: removedUsers.map((u) => ({ id: u.id, name: u.name, email: u.email, image: getAvatarPublicUrl(u.image) })),
    flags: {
      solicitorChase: agency.solicitorChaseEnabled,
      enquiryChase: agency.enquiryReplyChaseEnabled,
      weeklyUpdate: agency.weeklyClientUpdatesEnabled,
      portalKeyDates: agency.showPortalKeyDates,
      portalCosts: agency.showPortalCosts,
      portalProgress: agency.showPortalProgressPercent,
    },
    branding: {
      logoUrl: getAgencyLogoUrl(agency.logoPath),
      tileColor: agency.logoTileColor,
      scale: (agency.logoScale as LogoScale | null) ?? null,
      align: (agency.logoAlign as LogoAlign | null) ?? null,
      theme: sanitizeEmailThemeInput(agency.emailTheme),
    },
    feeModel,
    fees: { earnedPence: feeEarned, pipelinePence: feePipeline, thisMonthPence: feeThisMonth, avgPence: feeAvg },
  };
}

/**
 * The name of the progression business that invited this agency (its
 * ProgressionBusinessClient link), or null if the agency self-signed-up. Used to
 * tailor onboarding copy for a progressor-invited agent. One cheap lookup.
 */
export async function getInvitingProgressorName(agencyId: string | null | undefined): Promise<string | null> {
  if (!agencyId) return null;
  const link = await prisma.progressionBusinessClient.findFirst({
    where: { agencyId },
    select: { progressionBusiness: { select: { name: true } } },
  });
  return link?.progressionBusiness?.name ?? null;
}

export type InvitingProgressor = { businessId: string; name: string; feeModel: ClientFeeModel | null };

/**
 * The full inviting-progressor context for an agency: the business id (to tag a
 * sale's progressionBusinessId when the agent sends it to them), the name (for
 * copy) and the per-client rate card (to price the sale from the agent's side).
 * Null when the agency self-signed-up. Used by the New Sale flow.
 */
export async function getInvitingProgressor(agencyId: string | null | undefined): Promise<InvitingProgressor | null> {
  if (!agencyId) return null;
  const link = await prisma.progressionBusinessClient.findFirst({
    where: { agencyId },
    select: { progressionBusinessId: true, feeModel: true, progressionBusiness: { select: { name: true } } },
  });
  if (!link) return null;
  return { businessId: link.progressionBusinessId, name: link.progressionBusiness.name, feeModel: parseFeeModel(link.feeModel) };
}

/** Owner-scoped guard: resolve the business owner AND confirm the agency is their client. */
export async function assertOwnerOfClient(session: Session, agencyId: string): Promise<BusinessOwner | null> {
  const owner = await resolveBusinessOwner(session);
  if (!owner) return null;
  const link = await prisma.progressionBusinessClient.findUnique({
    where: { progressionBusinessId_agencyId: { progressionBusinessId: owner.businessId, agencyId } },
    select: { id: true },
  });
  return link ? owner : null;
}
