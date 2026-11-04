"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import {
  type WelcomeCallPoint,
  DEFAULT_WELCOME_CALL_SCRIPT,
  sanitiseWelcomeCallScript,
  readPersonalWelcomeCallScript,
} from "@/lib/intro-call/script";

// ── Drawer: the viewer's EFFECTIVE script (personal → agency → default) ───────
// teamDefault = what they'd see WITHOUT a personal override (agency → platform
// default), i.e. where "Reset to team default" lands.
export async function getWelcomeCallScriptAction(): Promise<{ points: WelcomeCallPoint[]; hasPersonal: boolean; teamDefault: WelcomeCallPoint[] }> {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agentPreferences: true, agencyId: true },
  });
  const personal = readPersonalWelcomeCallScript(user?.agentPreferences);
  let agencyScript: unknown = null;
  if (user?.agencyId) {
    const agency = await prisma.agency.findUnique({ where: { id: user.agencyId }, select: { introCallScript: true } });
    agencyScript = agency?.introCallScript ?? null;
  }
  const teamDefault = sanitiseWelcomeCallScript(agencyScript) ?? DEFAULT_WELCOME_CALL_SCRIPT;
  const points = personal ?? teamDefault;
  return { points, hasPersonal: personal !== null, teamDefault };
}

// ── Member: save / reset their OWN personal script ────────────────────────────
// points = the new personal script; null = clear the override (fall back to the
// team default). A member can only ever write their own copy.
export async function updatePersonalWelcomeCallScript(
  points: WelcomeCallPoint[] | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { agentPreferences: true } });
  const existing =
    user?.agentPreferences && typeof user.agentPreferences === "object"
      ? (user.agentPreferences as Record<string, unknown>)
      : {};

  let nextPrefs: Record<string, unknown>;
  if (points === null) {
    const { introCallScript: _drop, ...rest } = existing;
    void _drop;
    nextPrefs = rest;
  } else {
    const clean = sanitiseWelcomeCallScript(points);
    if (!clean) return { ok: false, error: "Add at least one talking point." };
    nextPrefs = { ...existing, introCallScript: clean };
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { agentPreferences: nextPrefs as Prisma.InputJsonValue } });
  revalidatePath("/agent", "layout");
  return { ok: true };
}

// ── Director: the AGENCY (team default) script ────────────────────────────────
export async function getAgencyWelcomeCallScriptAction(): Promise<{ points: WelcomeCallPoint[]; isCustom: boolean }> {
  const session = await requireSession();
  if (session.user.role !== "director" || !session.user.agencyId) {
    return { points: DEFAULT_WELCOME_CALL_SCRIPT, isCustom: false };
  }
  const agency = await prisma.agency.findUnique({ where: { id: session.user.agencyId }, select: { introCallScript: true } });
  const custom = sanitiseWelcomeCallScript(agency?.introCallScript);
  return { points: custom ?? DEFAULT_WELCOME_CALL_SCRIPT, isCustom: custom !== null };
}

// points = the new team script; null = reset to the platform default.
export async function updateAgencyWelcomeCallScript(
  points: WelcomeCallPoint[] | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  if (session.user.role !== "director" || !session.user.agencyId) {
    return { ok: false, error: "Only a director can edit the team script." };
  }

  let value: Prisma.InputJsonValue | typeof Prisma.DbNull;
  if (points === null) {
    value = Prisma.DbNull;
  } else {
    const clean = sanitiseWelcomeCallScript(points);
    if (!clean) return { ok: false, error: "Add at least one talking point." };
    value = clean as unknown as Prisma.InputJsonValue;
  }

  await prisma.agency.update({ where: { id: session.user.agencyId }, data: { introCallScript: value } });
  revalidatePath("/agent/account/welcome-call");
  revalidatePath("/agent", "layout");
  return { ok: true };
}
