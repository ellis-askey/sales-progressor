import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { uploadAgencyLogo, deleteAgencyLogo, getAgencyLogoUrl } from "@/lib/supabase-storage";

// Director-only: set / remove the agency's logo (shown in client emails).
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg", "image/gif": "gif",
};

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (session.user.role !== "director") {
    return NextResponse.json({ error: "Only directors can set the agency logo." }, { status: 403 });
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) return NextResponse.json({ error: "Missing agency." }, { status: 400 });

  let body: { dataBase64?: string; mimetype?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { dataBase64, mimetype } = body;
  if (!dataBase64 || !mimetype || !EXT[mimetype]) {
    return NextResponse.json({ error: "Please upload a PNG, JPG, WebP or SVG." }, { status: 400 });
  }
  const buffer = Buffer.from(dataBase64, "base64");
  if (buffer.length === 0) return NextResponse.json({ error: "That file looks empty." }, { status: 400 });
  if (buffer.length > MAX_BYTES) return NextResponse.json({ error: "Logo must be under 2MB." }, { status: 413 });

  // Clear a previous logo on a different extension so we don't orphan it.
  const prev = await prisma.agency.findUnique({ where: { id: agencyId }, select: { logoPath: true } });
  const path = `${agencyId}.${EXT[mimetype]}`;
  try {
    await uploadAgencyLogo(path, buffer, mimetype);
  } catch {
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 });
  }
  if (prev?.logoPath && prev.logoPath !== path) await deleteAgencyLogo(prev.logoPath).catch(() => {});
  await prisma.agency.update({ where: { id: agencyId }, data: { logoPath: path } });
  return NextResponse.json({ ok: true, url: getAgencyLogoUrl(path) });
}

export async function DELETE() {
  const session = await requireSession();
  if (session.user.role !== "director") {
    return NextResponse.json({ error: "Only directors can change the agency logo." }, { status: 403 });
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) return NextResponse.json({ error: "Missing agency." }, { status: 400 });
  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { logoPath: true } });
  if (agency?.logoPath) await deleteAgencyLogo(agency.logoPath).catch(() => {});
  await prisma.agency.update({ where: { id: agencyId }, data: { logoPath: null } });
  return NextResponse.json({ ok: true });
}
