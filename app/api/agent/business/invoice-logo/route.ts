// POST / DELETE /api/agent/business/invoice-logo
//
// The logo a progression business puts on the invoices it sends its client
// agencies. Owner-scoped (business level, not per-client). Mirrors the agency
// logo route: normalise to PNG (so it embeds cleanly in the invoice PDF — pdf-lib
// can't do SVG), store in the public agency-logos bucket under a `biz-` path, and
// save the path on ProgressionBusiness.invoiceLogoPath.

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { uploadAgencyLogo, deleteAgencyLogo, getAgencyLogoUrl } from "@/lib/supabase-storage";
import { normaliseLogo } from "@/lib/image/logo";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"]);

export async function POST(req: NextRequest) {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return NextResponse.json({ error: "Only a progression-business owner can change this." }, { status: 403 });

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
  try {
    ({ png } = await normaliseLogo(raw));
  } catch {
    return NextResponse.json({ error: "We couldn't read that image. Try a PNG or JPG." }, { status: 400 });
  }

  const prev = await prisma.progressionBusiness.findUnique({
    where: { id: owner.businessId },
    select: { invoiceLogoPath: true },
  });
  // Unique path per upload busts the CDN cache; the old file is deleted below.
  const path = `biz-${owner.businessId}-${Date.now()}.png`;
  try {
    await uploadAgencyLogo(path, png, "image/png");
  } catch {
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 });
  }
  if (prev?.invoiceLogoPath && prev.invoiceLogoPath !== path) await deleteAgencyLogo(prev.invoiceLogoPath).catch(() => {});

  await prisma.progressionBusiness.update({ where: { id: owner.businessId }, data: { invoiceLogoPath: path } });
  return NextResponse.json({ ok: true, url: getAgencyLogoUrl(path) });
}

export async function DELETE() {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return NextResponse.json({ error: "Only a progression-business owner can change this." }, { status: 403 });

  const biz = await prisma.progressionBusiness.findUnique({ where: { id: owner.businessId }, select: { invoiceLogoPath: true } });
  if (biz?.invoiceLogoPath) await deleteAgencyLogo(biz.invoiceLogoPath).catch(() => {});
  await prisma.progressionBusiness.update({ where: { id: owner.businessId }, data: { invoiceLogoPath: null } });
  return NextResponse.json({ ok: true });
}
