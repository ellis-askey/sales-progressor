import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { uploadAgencyLogo, deleteAgencyLogo, getAgencyLogoUrl } from "@/lib/supabase-storage";
import { normaliseLogo, type LogoScale, type LogoAlign } from "@/lib/image/logo";

// Director-only: set / adjust / remove the agency's logo (shown in client emails).
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"]);
const SCALES = new Set<LogoScale>(["sm", "md", "lg"]);
const ALIGNS = new Set<LogoAlign>(["left", "center"]);
const HEX = /^#[0-9a-fA-F]{6}$/;

async function requireDirectorAgency() {
  const session = await requireSession();
  if (session.user.role !== "director") {
    return { error: NextResponse.json({ error: "Only directors can change the agency logo." }, { status: 403 }) };
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) return { error: NextResponse.json({ error: "Missing agency." }, { status: 400 }) };
  return { agencyId };
}

// Upload a new logo: normalise it and detect its tile colour.
export async function POST(req: NextRequest) {
  const auth = await requireDirectorAgency();
  if ("error" in auth) return auth.error;
  const { agencyId } = auth;

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

  // Always stored as PNG so emails render it everywhere.
  const prev = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { logoPath: true, logoScale: true, logoAlign: true },
  });
  const path = `${agencyId}.png`;
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
  return NextResponse.json({ ok: true, url: getAgencyLogoUrl(path), tileColor, scale, align });
}

// Adjust presentation (colour / size / alignment) without re-uploading.
export async function PATCH(req: NextRequest) {
  const auth = await requireDirectorAgency();
  if ("error" in auth) return auth.error;
  const { agencyId } = auth;

  let body: { tileColor?: string; scale?: string; align?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const data: { logoTileColor?: string; logoScale?: string; logoAlign?: string } = {};
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
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  await prisma.agency.update({ where: { id: agencyId }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const auth = await requireDirectorAgency();
  if ("error" in auth) return auth.error;
  const { agencyId } = auth;

  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { logoPath: true } });
  if (agency?.logoPath) await deleteAgencyLogo(agency.logoPath).catch(() => {});
  await prisma.agency.update({
    where: { id: agencyId },
    data: { logoPath: null, logoTileColor: null, logoScale: null, logoAlign: null },
  });
  return NextResponse.json({ ok: true });
}
