"use server";

// Command Centre → Email senders: set up an agency's SendGrid domain
// authentication on their behalf (superadmin only). Writes the SAME
// VerifiedDomain rows the agency's own self-serve screen reads, so there's one
// source of truth. Reuses the shared SendGrid + verified-email services.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createAuthenticatedDomain, validateAuthenticatedDomain } from "@/lib/services/sendgrid";
import { isPersonalDomain, getVerifiedDomainForAgency } from "@/lib/services/verified-emails";

export type SerializedDomain = {
  id: string;
  domain: string;
  status: string;
  dkimValid: boolean;
  spfValid: boolean;
  cnameRecords: { host: string; data: string; type: string }[];
  verifiedAt: string | null;
  lastCheckedAt: string | null;
};

type Result = { ok: true; domain: SerializedDomain } | { ok: false; error: string };

async function requireSuperadmin() {
  const session = await requireSession();
  if (session.user.role !== "superadmin") throw new Error("Forbidden");
  return session;
}

function serialize(d: {
  id: string; domain: string; status: string; dkimValid: boolean; spfValid: boolean;
  cnameRecords: unknown; verifiedAt: Date | null; lastCheckedAt: Date | null;
}): SerializedDomain {
  return {
    id: d.id,
    domain: d.domain,
    status: d.status,
    dkimValid: d.dkimValid,
    spfValid: d.spfValid,
    cnameRecords: (d.cnameRecords as { host: string; data: string; type: string }[]) ?? [],
    verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null,
    lastCheckedAt: d.lastCheckedAt ? d.lastCheckedAt.toISOString() : null,
  };
}

export async function setupAgencyDomainAction(input: { agencyId: string; domain: string }): Promise<Result> {
  const session = await requireSuperadmin();
  const domain = input.domain.trim().toLowerCase();

  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    return { ok: false, error: "Enter a valid domain, e.g. oplah.co.uk." };
  }
  if (isPersonalDomain(`x@${domain}`)) {
    return { ok: false, error: "That's a personal email domain (Gmail, Outlook, etc.). Use the agency's own domain." };
  }
  const agency = await prisma.agency.findUnique({ where: { id: input.agencyId }, select: { id: true } });
  if (!agency) return { ok: false, error: "Agency not found." };

  const existing = await getVerifiedDomainForAgency(input.agencyId, domain);
  if (existing) return { ok: true, domain: serialize(existing) };

  let created;
  try {
    const { id: sendgridDomainId, cnameRecords, alreadyValid } = await createAuthenticatedDomain(domain);
    created = await prisma.verifiedDomain.create({
      data: {
        agencyId: input.agencyId,
        domain,
        sendgridDomainId,
        status: alreadyValid ? "verified" : "pending",
        dkimValid: !!alreadyValid,
        spfValid: !!alreadyValid,
        cnameRecords: cnameRecords as object[],
        createdByUserId: session.user.id,
        verifiedAt: alreadyValid ? new Date() : null,
      },
    });
  } catch {
    return { ok: false, error: "Couldn't reach SendGrid to set this up. Try again shortly." };
  }

  revalidatePath("/command/email-senders");
  return { ok: true, domain: serialize(created) };
}

export async function checkAgencyDomainAction(verifiedDomainId: string): Promise<Result & { valid?: boolean }> {
  await requireSuperadmin();
  const vd = await prisma.verifiedDomain.findUnique({ where: { id: verifiedDomainId } });
  if (!vd) return { ok: false, error: "Domain not found." };

  let result;
  try {
    result = await validateAuthenticatedDomain(vd.sendgridDomainId);
  } catch {
    return { ok: false, error: "Couldn't reach SendGrid to check this. Try again shortly." };
  }

  const updated = await prisma.verifiedDomain.update({
    where: { id: vd.id },
    data: {
      dkimValid: result.dkimValid,
      spfValid: result.spfValid,
      status: result.valid ? "verified" : "pending",
      lastCheckedAt: new Date(),
      verifiedAt: result.valid && !vd.verifiedAt ? new Date() : vd.verifiedAt,
    },
  });

  revalidatePath("/command/email-senders");
  return { ok: true, domain: serialize(updated), valid: result.valid };
}
