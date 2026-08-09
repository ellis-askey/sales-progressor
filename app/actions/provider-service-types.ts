"use server";

// Command-Centre-only master list of service types (e.g. "Level 2 HomeBuyer
// report" for surveyors). Clients pick from this list on the public quote
// page. Kind-scoped so future kinds (electricians etc.) get their own list.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { recordAdminAction } from "@/lib/command/audit/write";
import type { ProviderKind } from "@prisma/client";
import type { ActionResult } from "./provider-firms";

async function requireSuperadmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    redirect("/dashboard");
  }
  return session.user;
}

export type ServiceTypeInput = {
  kind: ProviderKind;
  label: string;
  description?: string | null;
  sortOrder: number;
  active: boolean;
};

function validate(input: ServiceTypeInput): string | null {
  if (!input.label?.trim()) return "Label is required.";
  if (input.label.trim().length > 80) return "Label is too long (max 80 chars).";
  if (input.description && input.description.length > 400) {
    return "Description is too long (max 400 chars).";
  }
  return null;
}

export async function createServiceType(input: ServiceTypeInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireSuperadmin();
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const row = await commandDb.providerServiceType.create({
    data: {
      kind: input.kind,
      label: input.label.trim(),
      description: input.description?.trim() || null,
      sortOrder: input.sortOrder,
      active: input.active,
    },
  });

  await recordAdminAction({
    adminUserId: user.id,
    action: "provider_service_type.create",
    targetType: "ProviderServiceType",
    targetId: row.id,
    afterValue: input,
  }).catch(() => {});

  revalidatePath("/command/providers/service-types");
  return { ok: true, data: { id: row.id } };
}

export async function updateServiceType(id: string, input: ServiceTypeInput): Promise<ActionResult> {
  const user = await requireSuperadmin();
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const before = await commandDb.providerServiceType.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Service type not found." };

  await commandDb.providerServiceType.update({
    where: { id },
    data: {
      label: input.label.trim(),
      description: input.description?.trim() || null,
      sortOrder: input.sortOrder,
      active: input.active,
    },
  });

  await recordAdminAction({
    adminUserId: user.id,
    action: "provider_service_type.update",
    targetType: "ProviderServiceType",
    targetId: id,
    beforeValue: {
      label: before.label,
      description: before.description,
      sortOrder: before.sortOrder,
      active: before.active,
    },
    afterValue: input,
  }).catch(() => {});

  revalidatePath("/command/providers/service-types");
  revalidatePath("/command/providers");
  return { ok: true };
}

export async function deleteServiceType(id: string): Promise<ActionResult> {
  const user = await requireSuperadmin();
  const before = await commandDb.providerServiceType.findUnique({
    where: { id },
    include: { _count: { select: { firms: true, quoteRequests: true } } },
  });
  if (!before) return { ok: false, error: "Service type not found." };
  if (before._count.quoteRequests > 0) {
    return {
      ok: false,
      error: `Can't delete — ${before._count.quoteRequests} quote request(s) reference this. Set it inactive instead.`,
    };
  }

  await commandDb.providerServiceType.delete({ where: { id } });

  await recordAdminAction({
    adminUserId: user.id,
    action: "provider_service_type.delete",
    targetType: "ProviderServiceType",
    targetId: id,
    beforeValue: { label: before.label, kind: before.kind },
  }).catch(() => {});

  revalidatePath("/command/providers/service-types");
  return { ok: true };
}
