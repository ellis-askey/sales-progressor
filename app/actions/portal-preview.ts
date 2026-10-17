"use server";

// Client-portal PREVIEW actions. A director opens / copies a link to a full,
// working example seller portal (the demo-sale machinery, flagged isDemo +
// demoKind:"portal_preview", never-expiring). Nothing here touches real data or
// sends email — the preview is a demo file, excluded from every cron/billing/
// metric path, and milestone confirms on it suppress all sends. One preview per
// agency; see docs/active/portal-preview/SPEC.md.

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { createPreviewSale } from "@/lib/services/demo-sale";

type Result = { ok: true; url: string } | { ok: false; error: string };

function portalUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL ?? "";
  return `${base}/portal/${token}`;
}

async function findPreviewVendor(agencyId: string): Promise<{ id: string; portalToken: string } | null> {
  const existing = await prisma.propertyTransaction.findFirst({
    where: { agencyId, isDemo: true, demoKind: "portal_preview" },
    select: { contacts: { where: { roleType: "vendor" }, select: { id: true, portalToken: true }, take: 1 } },
  });
  const v = existing?.contacts[0];
  return v && v.portalToken ? { id: v.id, portalToken: v.portalToken } : null;
}

/** Find-or-create the agency's example seller portal; return its public URL. Director-only. */
export async function getOrCreatePreviewPortalUrl(): Promise<Result> {
  const session = await requireSession();
  if (session.user.role !== "director" || !session.user.agencyId) {
    return { ok: false, error: "Only directors can open the example portal." };
  }
  const existing = await findPreviewVendor(session.user.agencyId);
  if (existing) return { ok: true, url: portalUrl(existing.portalToken) };
  const created = await createPreviewSale({ agencyId: session.user.agencyId, agentUserId: session.user.id });
  if (!created.vendorToken) return { ok: false, error: "Could not build the example portal. Please try again." };
  return { ok: true, url: portalUrl(created.vendorToken) };
}

/** Rotate the example portal's link (if an old one leaked). Director-only. */
export async function regeneratePreviewLink(): Promise<Result> {
  const session = await requireSession();
  if (session.user.role !== "director" || !session.user.agencyId) {
    return { ok: false, error: "Only directors can do this." };
  }
  const existing = await findPreviewVendor(session.user.agencyId);
  if (!existing) {
    const created = await createPreviewSale({ agencyId: session.user.agencyId, agentUserId: session.user.id });
    return created.vendorToken
      ? { ok: true, url: portalUrl(created.vendorToken) }
      : { ok: false, error: "Could not build the example portal." };
  }
  const token = randomBytes(20).toString("base64url");
  await prisma.contact.update({ where: { id: existing.id }, data: { portalToken: token } });
  return { ok: true, url: portalUrl(token) };
}
