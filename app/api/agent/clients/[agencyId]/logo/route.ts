// Progression-business OWNER — set / adjust / remove a CLIENT agency's email
// branding (logo band + hero band, button, links, footer) on their behalf.
// Mirrors the director-only /api/agent/agency-logo and the superadmin
// /api/command/agencies/[agencyId]/logo routes exactly (same normalise + storage
// + Agency columns), differing only in auth: the acting user must be a
// progression-business owner whose business has a ProgressionBusinessClient link
// to this agency (assertOwnerOfClient). Flag-gated, like every progression entry
// point. Writes the SAME Agency record + Supabase path the email pipeline reads,
// so a save here shows on every client-facing email for that agency's sales.

import { type NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { assertOwnerOfClient } from "@/lib/services/progression-clients";
import { uploadAgencyLogo, deleteAgencyLogo, getAgencyLogoUrl } from "@/lib/supabase-storage";
import { normaliseLogo, type LogoScale, type LogoAlign } from "@/lib/image/logo";
import { sanitizeEmailThemeInput } from "@/lib/email/brand-theme";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"]);
const SCALES = new Set<LogoScale>(["sm", "md", "lg"]);
const ALIGNS = new Set<LogoAlign>(["left", "center"]);
const HEX = /^#[0-9a-fA-F]{6}$/;

async function requireOwnerAgency(agencyId: string) {
  if (!progressionBusinessesEnabled()) {
    return { error: NextResponse.json({ error: "Not available." }, { status: 404 }) };
  }
  const session = await getSession();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorised" }, { status: 401 }) };
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return { error: NextResponse.json({ error: "That isn't one of your clients." }, { status: 403 }) };
  return { agencyId };
}

// Upload a new logo: normalise it and detect its tile colour.
export async function POST(req: NextRequest, ctx: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await ctx.params;
  const auth = await requireOwnerAgency(agencyId);
  if ("error" in auth) return auth.error;

  let body: { dataBase64?: string; mimetype?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { dataBase64, mimetype } = body;
  if (!dataBase64 || !mimetype || !ACCEPTED.has(mimetype)) {
    return NextResponse.json({ error: "Please upload a PNG, JPG, WebP or SVG." }, { status: 400 });
  }
  const raw = Buffer.from(dataBase64, "base64");
  if (raw.length === 0) return NextResponse.json({ error: "That file looks empty." }, { status: 400 });
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "Logo must be under 2MB." }, { status: 413 });

  let png: Buffer;
  let tileColor: string;
  try {
    ({ png, tileColor } = await normaliseLogo(raw));
  } catch {
    return NextResponse.json({ error: "We couldn't read that image. Try a PNG or JPG." }, { status: 400 });
  }

  const prev = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { logoPath: true, logoScale: true, logoAlign: true },
  });
  // Unique path per upload so replacing the logo produces a NEW public URL. A
  // fixed path reuses the same URL, so the browser + CDN keep serving the cached
  // OLD image (the logo appears to "revert"). The previous file is deleted
  // below, keeping it to one file per agency.
  const path = `${agencyId}-${Date.now()}.png`;
  try {
    await uploadAgencyLogo(path, png, "image/png");
  } catch {
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 });
  }
  if (prev?.logoPath && prev.logoPath !== path) await deleteAgencyLogo(prev.logoPath).catch(() => {});

  // Fresh logo re-detects its colour; keep any existing size/alignment preference.
  const scale = (prev?.logoScale as LogoScale) ?? "md";
  const align = (prev?.logoAlign as LogoAlign) ?? "left";
  await prisma.agency.update({
    where: { id: agencyId },
    data: { logoPath: path, logoTileColor: tileColor, logoScale: scale, logoAlign: align },
  });
  revalidatePath(`/agent/clients/${agencyId}`);
  return NextResponse.json({ ok: true, url: getAgencyLogoUrl(path), tileColor, scale, align });
}

// Adjust presentation (colour / size / alignment / email theme) without re-uploading.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await ctx.params;
  const auth = await requireOwnerAgency(agencyId);
  if ("error" in auth) return auth.error;

  let body: { tileColor?: string; scale?: string; align?: string; theme?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const data: {
    logoTileColor?: string; logoScale?: string; logoAlign?: string;
    emailTheme?: Prisma.InputJsonValue | typeof Prisma.DbNull;
  } = {};
  if (body.tileColor !== undefined) {
    if (!HEX.test(body.tileColor)) return NextResponse.json({ error: "Invalid colour." }, { status: 400 });
    data.logoTileColor = body.tileColor;
  }
  if (body.scale !== undefined) {
    if (!SCALES.has(body.scale as LogoScale)) return NextResponse.json({ error: "Invalid size." }, { status: 400 });
    data.logoScale = body.scale;
  }
  if (body.align !== undefined) {
    if (!ALIGNS.has(body.align as LogoAlign)) return NextResponse.json({ error: "Invalid alignment." }, { status: 400 });
    data.logoAlign = body.align;
  }
  if (body.theme !== undefined) {
    const clean = sanitizeEmailThemeInput(body.theme);
    data.emailTheme = clean ? (clean as Prisma.InputJsonValue) : Prisma.DbNull;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  await prisma.agency.update({ where: { id: agencyId }, data });
  revalidatePath(`/agent/clients/${agencyId}`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await ctx.params;
  const auth = await requireOwnerAgency(agencyId);
  if ("error" in auth) return auth.error;

  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { logoPath: true } });
  if (agency?.logoPath) await deleteAgencyLogo(agency.logoPath).catch(() => {});
  await prisma.agency.update({
    where: { id: agencyId },
    data: { logoPath: null, logoTileColor: null, logoScale: null, logoAlign: null },
  });
  revalidatePath(`/agent/clients/${agencyId}`);
  return NextResponse.json({ ok: true });
}
