// Progression-business OWNER — set / clear their business HOUSE STYLE email theme
// (ProgressionBusiness.emailTheme). This is the default look a client agency's
// buyer/seller emails start from when that agency hasn't set its own theme; the
// send-path resolver order is client agency theme -> this business house style ->
// Sales Progressor defaults (see resolveAgencySenderForTransaction).
//
// Theme-only: a business has no logo of its own (each client email carries that
// client agency's logo), so there is no POST/upload here — just a PATCH of the
// sanitised theme blob. Owner-gated + flag-gated like every progression entry.

import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { sanitizeEmailThemeInput } from "@/lib/email/brand-theme";

export async function PATCH(req: NextRequest) {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not available." }, { status: 404 });
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return NextResponse.json({ error: "Only a business owner can change this." }, { status: 403 });

  let body: { theme?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (body.theme === undefined) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const clean = sanitizeEmailThemeInput(body.theme);
  await prisma.progressionBusiness.update({
    where: { id: owner.businessId },
    data: { emailTheme: clean ? (clean as Prisma.InputJsonValue) : Prisma.DbNull },
  });
  return NextResponse.json({ ok: true });
}
