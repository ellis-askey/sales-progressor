"use server";

// Client-portal PREVIEW actions. A director (agency) or a progression-business
// owner opens / copies a link to a full, working example seller portal (the
// demo-sale machinery, flagged isDemo + demoKind:"portal_preview", never-expiring).
// Nothing here sends email or touches real data: the preview is a demo file,
// excluded from every cron/billing/metric path, and confirming a step on it emits
// nothing (lib/services/portal.ts guard). One preview per org; whoever opens it is
// shown in the portal's "Your team" (agent for an agency, "Your progressor" for a
// business). See docs/active/portal-preview/SPEC.md.

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { createPreviewSale } from "@/lib/services/demo-sale";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";

type Result = { ok: true; url: string } | { ok: false; error: string };
type Vendor = { id: string; portalToken: string };

function portalUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL ?? "";
  return `${base}/portal/${token}`;
}

function vendorFrom(tx: { contacts: { id: string; portalToken: string | null }[] } | null): Vendor | null {
  const v = tx?.contacts[0];
  return v && v.portalToken ? { id: v.id, portalToken: v.portalToken } : null;
}

async function findAgencyPreviewVendor(agencyId: string): Promise<Vendor | null> {
  const tx = await prisma.propertyTransaction.findFirst({
    where: { agencyId, progressionBusinessId: null, isDemo: true, demoKind: "portal_preview" },
    select: { contacts: { where: { roleType: "vendor" }, select: { id: true, portalToken: true }, take: 1 } },
  });
  return vendorFrom(tx);
}

async function findBusinessPreviewVendor(businessId: string): Promise<Vendor | null> {
  const tx = await prisma.propertyTransaction.findFirst({
    where: { progressionBusinessId: businessId, isDemo: true, demoKind: "portal_preview" },
    select: { contacts: { where: { roleType: "vendor" }, select: { id: true, portalToken: true }, take: 1 } },
  });
  return vendorFrom(tx);
}

async function rotate(vendorId: string): Promise<string> {
  const token = randomBytes(20).toString("base64url");
  await prisma.contact.update({ where: { id: vendorId }, data: { portalToken: token } });
  return token;
}

// ─── Agency (director) ─────────────────────────────────────────────────────────

/** Find-or-create the agency's example seller portal; return its public URL. */
export async function getOrCreatePreviewPortalUrl(): Promise<Result> {
  const session = await requireSession();
  if (session.user.role !== "director" || !session.user.agencyId) {
    return { ok: false, error: "Only directors can open the example portal." };
  }
  const existing = await findAgencyPreviewVendor(session.user.agencyId);
  if (existing) return { ok: true, url: portalUrl(existing.portalToken) };
  const created = await createPreviewSale({ ownerUserId: session.user.id, agencyId: session.user.agencyId });
  if (!created.vendorToken) return { ok: false, error: "Could not build the example portal. Please try again." };
  return { ok: true, url: portalUrl(created.vendorToken) };
}

/** Rotate the agency example portal's link (if an old one leaked). */
export async function regeneratePreviewLink(): Promise<Result> {
  const session = await requireSession();
  if (session.user.role !== "director" || !session.user.agencyId) {
    return { ok: false, error: "Only directors can do this." };
  }
  const existing = await findAgencyPreviewVendor(session.user.agencyId);
  if (!existing) {
    const created = await createPreviewSale({ ownerUserId: session.user.id, agencyId: session.user.agencyId });
    return created.vendorToken ? { ok: true, url: portalUrl(created.vendorToken) } : { ok: false, error: "Could not build the example portal." };
  }
  return { ok: true, url: portalUrl(await rotate(existing.id)) };
}

// ─── Progression business (owner) ───────────────────────────────────────────────

/** Find-or-create the business's example seller portal (shows "Your progressor"). */
export async function getOrCreateBusinessPreviewPortalUrl(): Promise<Result> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return { ok: false, error: "Only the business owner can open the example portal." };
  const existing = await findBusinessPreviewVendor(owner.businessId);
  if (existing) return { ok: true, url: portalUrl(existing.portalToken) };
  const created = await createPreviewSale({ ownerUserId: session.user.id, progressionBusinessId: owner.businessId });
  if (!created.vendorToken) return { ok: false, error: "Could not build the example portal. Please try again." };
  return { ok: true, url: portalUrl(created.vendorToken) };
}

/** Rotate the business example portal's link (if an old one leaked). */
export async function regenerateBusinessPreviewLink(): Promise<Result> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return { ok: false, error: "Only the business owner can do this." };
  const existing = await findBusinessPreviewVendor(owner.businessId);
  if (!existing) {
    const created = await createPreviewSale({ ownerUserId: session.user.id, progressionBusinessId: owner.businessId });
    return created.vendorToken ? { ok: true, url: portalUrl(created.vendorToken) } : { ok: false, error: "Could not build the example portal." };
  }
  return { ok: true, url: portalUrl(await rotate(existing.id)) };
}
