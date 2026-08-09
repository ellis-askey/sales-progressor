"use server";

// Command-Centre-only actions for managing ProviderFirm rows (surveyors first,
// electricians/gas etc. later). Every write goes through commandDb + is
// audited via recordAdminAction. Superadmin gate is layer belt-and-braces:
// the (protected) layout already gates, and each action re-verifies.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { recordAdminAction } from "@/lib/command/audit/write";
import {
  uploadProviderLogo,
  deleteProviderLogo,
} from "@/lib/supabase-storage";
import { outwardCode } from "@/lib/utils/address";
import type { ProviderKind } from "@prisma/client";

async function requireSuperadmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    redirect("/dashboard");
  }
  return session.user;
}

export type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? {} : { data: T }))
  | { ok: false; error: string };

// ── Firm CRUD ──────────────────────────────────────────────────────────────

export type FirmInput = {
  kind: ProviderKind;
  name: string;
  email: string;
  phone?: string | null;
  website?: string | null;
  notes?: string | null;
  active: boolean;
};

function validateFirmInput(input: FirmInput): string | null {
  if (!input.name?.trim()) return "Name is required.";
  if (!input.email?.trim()) return "Email is required.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())) {
    return "Email doesn't look valid.";
  }
  if (input.website && !/^https?:\/\//i.test(input.website)) {
    return "Website must start with http:// or https://";
  }
  return null;
}

export async function createProviderFirm(input: FirmInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireSuperadmin();
  const err = validateFirmInput(input);
  if (err) return { ok: false, error: err };

  const firm = await commandDb.providerFirm.create({
    data: {
      kind: input.kind,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      website: input.website?.trim() || null,
      notes: input.notes?.trim() || null,
      active: input.active,
    },
  });

  await recordAdminAction({
    adminUserId: user.id,
    action: "provider_firm.create",
    targetType: "ProviderFirm",
    targetId: firm.id,
    afterValue: { name: firm.name, email: firm.email, kind: firm.kind },
  }).catch(() => {});

  revalidatePath("/command/providers");
  return { ok: true, data: { id: firm.id } };
}

export async function updateProviderFirm(id: string, input: FirmInput): Promise<ActionResult> {
  const user = await requireSuperadmin();
  const err = validateFirmInput(input);
  if (err) return { ok: false, error: err };

  const before = await commandDb.providerFirm.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Firm not found." };

  await commandDb.providerFirm.update({
    where: { id },
    data: {
      kind: input.kind,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      website: input.website?.trim() || null,
      notes: input.notes?.trim() || null,
      active: input.active,
    },
  });

  await recordAdminAction({
    adminUserId: user.id,
    action: "provider_firm.update",
    targetType: "ProviderFirm",
    targetId: id,
    beforeValue: {
      name: before.name,
      email: before.email,
      phone: before.phone,
      website: before.website,
      notes: before.notes,
      active: before.active,
    },
    afterValue: input,
  }).catch(() => {});

  revalidatePath("/command/providers");
  revalidatePath(`/command/providers/${id}`);
  return { ok: true };
}

export async function toggleProviderFirmActive(id: string): Promise<ActionResult> {
  const user = await requireSuperadmin();
  const firm = await commandDb.providerFirm.findUnique({ where: { id } });
  if (!firm) return { ok: false, error: "Firm not found." };

  await commandDb.providerFirm.update({
    where: { id },
    data: { active: !firm.active },
  });

  await recordAdminAction({
    adminUserId: user.id,
    action: "provider_firm.toggle_active",
    targetType: "ProviderFirm",
    targetId: id,
    beforeValue: { active: firm.active },
    afterValue: { active: !firm.active },
  }).catch(() => {});

  revalidatePath("/command/providers");
  revalidatePath(`/command/providers/${id}`);
  return { ok: true };
}

// ── Coverage ───────────────────────────────────────────────────────────────

// Accepts a comma / newline / space separated list of postcode-shaped tokens,
// extracts the outward code from each, dedupes, adds any missing rows.
export async function addProviderCoverage(
  providerId: string,
  rawInput: string,
): Promise<ActionResult<{ added: number; skipped: string[] }>> {
  const user = await requireSuperadmin();
  const firm = await commandDb.providerFirm.findUnique({ where: { id: providerId } });
  if (!firm) return { ok: false, error: "Firm not found." };

  const tokens = rawInput
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const outwards: string[] = [];
  const skipped: string[] = [];
  for (const token of tokens) {
    const out = outwardCode(token);
    if (out) outwards.push(out);
    else skipped.push(token);
  }

  const unique = [...new Set(outwards)];
  if (unique.length === 0) {
    return { ok: false, error: "No valid postcodes recognised." };
  }

  const existing = await commandDb.providerCoverage.findMany({
    where: { providerId, outwardCode: { in: unique } },
    select: { outwardCode: true },
  });
  const existingSet = new Set(existing.map((c) => c.outwardCode));
  const toCreate = unique.filter((o) => !existingSet.has(o));

  if (toCreate.length > 0) {
    await commandDb.providerCoverage.createMany({
      data: toCreate.map((outwardCode) => ({ providerId, outwardCode })),
      skipDuplicates: true,
    });
  }

  await recordAdminAction({
    adminUserId: user.id,
    action: "provider_firm.add_coverage",
    targetType: "ProviderFirm",
    targetId: providerId,
    afterValue: { added: toCreate, skipped },
  }).catch(() => {});

  revalidatePath(`/command/providers/${providerId}`);
  return { ok: true, data: { added: toCreate.length, skipped } };
}

export async function removeProviderCoverage(coverageId: string): Promise<ActionResult> {
  const user = await requireSuperadmin();
  const row = await commandDb.providerCoverage.findUnique({ where: { id: coverageId } });
  if (!row) return { ok: false, error: "Coverage row not found." };

  await commandDb.providerCoverage.delete({ where: { id: coverageId } });

  await recordAdminAction({
    adminUserId: user.id,
    action: "provider_firm.remove_coverage",
    targetType: "ProviderFirm",
    targetId: row.providerId,
    beforeValue: { outwardCode: row.outwardCode },
  }).catch(() => {});

  revalidatePath(`/command/providers/${row.providerId}`);
  return { ok: true };
}

// ── Service types (per-firm join) ──────────────────────────────────────────

export async function toggleProviderFirmServiceType(
  providerId: string,
  serviceTypeId: string,
): Promise<ActionResult> {
  const user = await requireSuperadmin();
  const existing = await commandDb.providerFirmServiceType.findUnique({
    where: { providerId_serviceTypeId: { providerId, serviceTypeId } },
  });

  if (existing) {
    await commandDb.providerFirmServiceType.delete({
      where: { providerId_serviceTypeId: { providerId, serviceTypeId } },
    });
  } else {
    await commandDb.providerFirmServiceType.create({
      data: { providerId, serviceTypeId },
    });
  }

  await recordAdminAction({
    adminUserId: user.id,
    action: existing
      ? "provider_firm.remove_service_type"
      : "provider_firm.add_service_type",
    targetType: "ProviderFirm",
    targetId: providerId,
    afterValue: { serviceTypeId },
  }).catch(() => {});

  revalidatePath(`/command/providers/${providerId}`);
  return { ok: true };
}

// ── Logo upload / delete ───────────────────────────────────────────────────

const MAX_LOGO_BYTES = 500 * 1024;
const ALLOWED_LOGO_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
]);

export async function uploadProviderLogoAction(
  providerId: string,
  formData: FormData,
): Promise<ActionResult<{ logoPath: string }>> {
  const user = await requireSuperadmin();
  const file = formData.get("logo");
  if (!(file instanceof File)) return { ok: false, error: "No file uploaded." };
  if (file.size === 0) return { ok: false, error: "File is empty." };
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: `File too large. Max ${Math.round(MAX_LOGO_BYTES / 1024)}KB.` };
  }
  if (!ALLOWED_LOGO_MIME.has(file.type)) {
    return { ok: false, error: `Unsupported file type (${file.type}). Use PNG, JPEG, SVG, or WEBP.` };
  }

  const firm = await commandDb.providerFirm.findUnique({ where: { id: providerId } });
  if (!firm) return { ok: false, error: "Firm not found." };

  // Path: <firmId>/logo.<ext>. Overwrites via upsert so re-upload replaces.
  const extFromMime: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/svg+xml": "svg",
    "image/webp": "webp",
  };
  const ext = extFromMime[file.type] ?? "png";
  const path = `${providerId}/logo.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    await uploadProviderLogo(path, buffer, file.type);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload failed." };
  }

  // If the old logo used a different extension, delete it so we don't
  // orphan the file in storage.
  if (firm.logoPath && firm.logoPath !== path) {
    await deleteProviderLogo(firm.logoPath).catch(() => {});
  }

  await commandDb.providerFirm.update({
    where: { id: providerId },
    data: { logoPath: path },
  });

  await recordAdminAction({
    adminUserId: user.id,
    action: "provider_firm.upload_logo",
    targetType: "ProviderFirm",
    targetId: providerId,
    afterValue: { logoPath: path },
  }).catch(() => {});

  revalidatePath(`/command/providers/${providerId}`);
  return { ok: true, data: { logoPath: path } };
}

export async function deleteProviderLogoAction(providerId: string): Promise<ActionResult> {
  const user = await requireSuperadmin();
  const firm = await commandDb.providerFirm.findUnique({ where: { id: providerId } });
  if (!firm) return { ok: false, error: "Firm not found." };
  if (!firm.logoPath) return { ok: true };

  await deleteProviderLogo(firm.logoPath).catch(() => {});
  await commandDb.providerFirm.update({
    where: { id: providerId },
    data: { logoPath: null },
  });

  await recordAdminAction({
    adminUserId: user.id,
    action: "provider_firm.delete_logo",
    targetType: "ProviderFirm",
    targetId: providerId,
    beforeValue: { logoPath: firm.logoPath },
  }).catch(() => {});

  revalidatePath(`/command/providers/${providerId}`);
  return { ok: true };
}
