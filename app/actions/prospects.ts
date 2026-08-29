"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { redirect } from "next/navigation";
import { commandDb } from "@/lib/command/prisma";
import { getProspectDetail, type ProspectDetail } from "@/lib/command/prospects";
import type { Prisma, ProspectStatus, ProspectSource } from "@prisma/client";

// Command Centre → Prospects server actions. Every action is superadmin-gated
// and writes through commandDb. Meaningful changes also append a ProspectActivity
// row so the drawer timeline is the single chronological history.

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) redirect("/dashboard");
  return session;
}

async function logActivity(
  prospectId: string,
  actorUserId: string | null,
  type: string,
  summary: string | null,
  body?: string | null,
  metadata?: Prisma.InputJsonValue,
) {
  await commandDb.prospectActivity.create({
    data: { prospectId, actorUserId, type, summary, body: body ?? null, metadata },
  });
}

const trimOrNull = (v: string | undefined | null) => {
  const t = (v ?? "").trim();
  return t.length ? t : null;
};

export async function getProspectDetailAction(id: string): Promise<ProspectDetail | null> {
  await requireSuperAdmin();
  return getProspectDetail(id);
}

export async function createProspectAction(input: {
  agencyName: string;
  branch?: string;
  website?: string;
  location?: string;
  postcode?: string;
  phone?: string;
  generalEmail?: string;
  source: string;
  notes?: string;
  // Optional first contact
  contactName?: string;
  contactJobTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const agencyName = input.agencyName.trim();
  if (!agencyName) return { ok: false, error: "An agency name is required." };
  const source = (["cold", "google", "linkedin", "referral", "chain", "solicitor", "existing_contact", "inbound", "other"].includes(input.source) ? input.source : "other") as ProspectSource;

  const hasContact = !!input.contactName?.trim();
  const prospect = await commandDb.prospect.create({
    data: {
      agencyName,
      branch: trimOrNull(input.branch),
      website: trimOrNull(input.website),
      location: trimOrNull(input.location),
      postcode: trimOrNull(input.postcode),
      phone: trimOrNull(input.phone),
      generalEmail: trimOrNull(input.generalEmail),
      source,
      notes: trimOrNull(input.notes),
      ownerUserId: session.user.id,
      createdById: session.user.id,
      ...(hasContact
        ? {
            contacts: {
              create: {
                name: input.contactName!.trim(),
                jobTitle: trimOrNull(input.contactJobTitle),
                email: trimOrNull(input.contactEmail),
                phone: trimOrNull(input.contactPhone),
                isPrimary: true,
              },
            },
          }
        : {}),
    },
  });
  await logActivity(prospect.id, session.user.id, "created", `Prospect added${hasContact ? ` with contact ${input.contactName!.trim()}` : ""}`);
  revalidatePath("/command/prospects");
  return { ok: true, id: prospect.id };
}

export async function updateProspectAction(id: string, patch: {
  agencyName?: string; branch?: string; website?: string; location?: string;
  postcode?: string; phone?: string; generalEmail?: string; branchCount?: number | null; sizeNote?: string; notes?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperAdmin();
  const agencyName = patch.agencyName?.trim();
  if (patch.agencyName !== undefined && !agencyName) return { ok: false, error: "Agency name can't be empty." };
  await commandDb.prospect.update({
    where: { id },
    data: {
      ...(agencyName ? { agencyName } : {}),
      ...(patch.branch !== undefined ? { branch: trimOrNull(patch.branch) } : {}),
      ...(patch.website !== undefined ? { website: trimOrNull(patch.website) } : {}),
      ...(patch.location !== undefined ? { location: trimOrNull(patch.location) } : {}),
      ...(patch.postcode !== undefined ? { postcode: trimOrNull(patch.postcode) } : {}),
      ...(patch.phone !== undefined ? { phone: trimOrNull(patch.phone) } : {}),
      ...(patch.generalEmail !== undefined ? { generalEmail: trimOrNull(patch.generalEmail) } : {}),
      ...(patch.branchCount !== undefined ? { branchCount: patch.branchCount } : {}),
      ...(patch.sizeNote !== undefined ? { sizeNote: trimOrNull(patch.sizeNote) } : {}),
      ...(patch.notes !== undefined ? { notes: trimOrNull(patch.notes) } : {}),
    },
  });
  revalidatePath("/command/prospects");
  return { ok: true };
}

export async function changeProspectStatusAction(id: string, toStatus: string, note?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const valid: ProspectStatus[] = ["new", "contacted", "replied", "interested", "trial", "active", "lost"];
  if (!valid.includes(toStatus as ProspectStatus)) return { ok: false, error: "Unknown status." };
  const current = await commandDb.prospect.findUnique({ where: { id }, select: { status: true } });
  if (!current) return { ok: false, error: "Prospect not found." };
  await commandDb.prospect.update({ where: { id }, data: { status: toStatus as ProspectStatus } });
  await logActivity(id, session.user.id, "status_changed", `${current.status} → ${toStatus}`, note ?? null, { fromStatus: current.status, toStatus });
  revalidatePath("/command/prospects");
  return { ok: true };
}

export async function addProspectNoteAction(id: string, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const text = body.trim();
  if (!text) return { ok: false, error: "Note can't be empty." };
  await logActivity(id, session.user.id, "note", text.slice(0, 80), text);
  revalidatePath("/command/prospects");
  return { ok: true };
}

export async function addProspectContactAction(prospectId: string, input: {
  name: string; jobTitle?: string; email?: string; phone?: string; linkedinUrl?: string; isDecisionMaker?: boolean; makePrimary?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Contact name is required." };
  const existingPrimary = await commandDb.prospectContact.count({ where: { prospectId, isPrimary: true } });
  const makePrimary = input.makePrimary || existingPrimary === 0;
  if (makePrimary) {
    await commandDb.prospectContact.updateMany({ where: { prospectId, isPrimary: true }, data: { isPrimary: false } });
  }
  await commandDb.prospectContact.create({
    data: {
      prospectId, name, jobTitle: trimOrNull(input.jobTitle), email: trimOrNull(input.email),
      phone: trimOrNull(input.phone), linkedinUrl: trimOrNull(input.linkedinUrl),
      isDecisionMaker: !!input.isDecisionMaker, isPrimary: makePrimary,
    },
  });
  await logActivity(prospectId, session.user.id, "contact_added", `Added contact ${name}`);
  revalidatePath("/command/prospects");
  return { ok: true };
}

export async function setPrimaryContactAction(prospectId: string, contactId: string): Promise<{ ok: true }> {
  await requireSuperAdmin();
  await commandDb.$transaction([
    commandDb.prospectContact.updateMany({ where: { prospectId, isPrimary: true }, data: { isPrimary: false } }),
    commandDb.prospectContact.update({ where: { id: contactId }, data: { isPrimary: true } }),
  ]);
  revalidatePath("/command/prospects");
  return { ok: true };
}
