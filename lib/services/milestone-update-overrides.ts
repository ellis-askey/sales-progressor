import "server-only";
import { prisma } from "@/lib/prisma";
import { getDefaultUpdateCore } from "@/lib/updates-copy";
import { getMilestoneUpdateSubtext, getMilestoneUpdateSubtextOther } from "@/lib/portal-copy";

// Resolver for the client-portal Updates copy overrides (MilestoneUpdateOverride).
// The portal reads getUpdateOverrideMap() once per render; the Command Centre
// editor reads describeUpdateEffective() per code. Override-or-default, per field.

export type UpdateOverrideRow = {
  core: string | null;
  subtextOwn: string | null;
  subtextOther: string | null;
};

/** All overrides as a code -> row map, for the portal feeds. */
export async function getUpdateOverrideMap(): Promise<Map<string, UpdateOverrideRow>> {
  try {
    const rows = await prisma.milestoneUpdateOverride.findMany({
      select: { code: true, core: true, subtextOwn: true, subtextOther: true },
    });
    return new Map(rows.map((r) => [r.code, { core: r.core, subtextOwn: r.subtextOwn, subtextOther: r.subtextOther }]));
  } catch {
    // Never let an override read break the client's feed.
    return new Map();
  }
}

export type FieldDesc = { effective: string | null; base: string | null; overridden: boolean };
export type UpdateEffective = {
  code: string;
  core: FieldDesc;
  subtextOwn: FieldDesc;
  subtextOther: FieldDesc;
};

function field(ov: string | null | undefined, base: string | null): FieldDesc {
  const overridden = !!(ov && ov.trim());
  return { effective: overridden ? (ov as string) : base, base, overridden };
}

/** Effective + base copy for one code, for the Command Centre editor. */
export async function describeUpdateEffective(code: string): Promise<UpdateEffective> {
  const row = await prisma.milestoneUpdateOverride.findUnique({ where: { code } });
  return {
    code,
    core: field(row?.core, getDefaultUpdateCore(code)),
    subtextOwn: field(row?.subtextOwn, getMilestoneUpdateSubtext(code)),
    subtextOther: field(row?.subtextOther, getMilestoneUpdateSubtextOther(code)),
  };
}
