// POST /api/agent/signature-image
//
// Two setup methods for the ONE "Signature image" option:
//   - multipart form { file }           → upload a signature image
//   - JSON { url }                      → import an already-hosted image
//
// Both converge to the same place: the image is stored in our public
// `signatures` bucket (upsert), the signature record's image path is set, and the
// mode is switched to IMAGE. Importing (rather than hotlinking) protects recipient
// privacy and survives the remote image disappearing. Returns { url, mode }.
//
// DELETE clears the image and reverts the mode to BASIC.
//
// Target: by default the signed-in USER's own signature (stored at `{userId}.ext`,
// on User). When an `agencyId` is supplied (form field / JSON field / ?agencyId
// query), it targets that client agency's PER-CLIENT sign-off for the signed-in
// business owner instead (stored at `client/{businessId}/{agencyId}.ext`, on
// ProgressionBusinessClient) — ownership re-checked here (Law 7).
//
// Validation: session required; image mime only; under 2 MB; URL must be https.
// See docs/active/email-signature/00-audit-and-plan.md §5 / §11.

import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { uploadSignatureImage, getSignatureImageUrl, deleteSignatureImage } from "@/lib/supabase-storage";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function extFor(mime: string): string {
  switch (mime) {
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    default: return "jpg";
  }
}

type ImgTarget =
  | { kind: "user"; userId: string }
  | { kind: "client"; linkId: string; businessId: string; agencyId: string };

// Resolve + ownership-verify the target. Returns null when a client agencyId is
// given but the caller isn't the owning business (so no cross-tenant writes).
async function resolveImageTarget(session: Session, agencyId: string | null): Promise<ImgTarget | null> {
  if (agencyId) {
    const owner = await resolveBusinessOwner(session);
    if (!owner) return null;
    const link = await prisma.progressionBusinessClient.findUnique({
      where: { progressionBusinessId_agencyId: { progressionBusinessId: owner.businessId, agencyId } },
      select: { id: true },
    });
    if (!link) return null;
    return { kind: "client", linkId: link.id, businessId: owner.businessId, agencyId };
  }
  return { kind: "user", userId: session.user.id };
}

async function persist(target: ImgTarget, buffer: Buffer, mime: string) {
  const path = target.kind === "client"
    ? `client/${target.businessId}/${target.agencyId}.${extFor(mime)}`
    : `${target.userId}.${extFor(mime)}`;
  await uploadSignatureImage(path, buffer, mime);
  const base = getSignatureImageUrl(path);
  if (target.kind === "client") {
    await prisma.progressionBusinessClient.update({
      where: { id: target.linkId },
      data: { signatureImagePath: path, signatureMode: "IMAGE" },
    });
  } else {
    await prisma.user.update({
      where: { id: target.userId },
      data: { emailSignatureImagePath: path, emailSignatureMode: "IMAGE" },
    });
  }
  return base ? `${base}?v=${Date.now()}` : null;
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const contentType = req.headers.get("content-type") ?? "";

  // ── Import from URL ──────────────────────────────────────────────────────
  if (contentType.includes("application/json")) {
    const { url, agencyId } = (await req.json()) as { url?: string; agencyId?: string };
    if (!url || !/^https:\/\//i.test(url)) {
      return NextResponse.json({ error: "Enter an https image URL." }, { status: 400 });
    }
    const target = await resolveImageTarget(session, agencyId ?? null);
    if (!target) return NextResponse.json({ error: "We couldn't find that client." }, { status: 404 });
    let remote: Response;
    try {
      remote = await fetch(url, { redirect: "follow" });
    } catch {
      return NextResponse.json({ error: "We couldn't fetch that image. Check the link." }, { status: 400 });
    }
    if (!remote.ok) {
      return NextResponse.json({ error: "That image link didn't load." }, { status: 400 });
    }
    const mime = (remote.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!ALLOWED_MIME.includes(mime)) {
      return NextResponse.json({ error: "That link isn't a JPG, PNG, WEBP or GIF image." }, { status: 400 });
    }
    const bytes = await remote.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "That image is too large. Max 2 MB." }, { status: 400 });
    }
    const savedUrl = await persist(target, Buffer.from(bytes), mime);
    return NextResponse.json({ url: savedUrl, mode: "IMAGE" });
  }

  // ── Direct upload ────────────────────────────────────────────────────────
  const form = await req.formData();
  const file = form.get("file");
  const agencyId = form.get("agencyId");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That image is too large. Max 2 MB." }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG, WEBP or GIF image." }, { status: 400 });
  }
  const target = await resolveImageTarget(session, typeof agencyId === "string" ? agencyId : null);
  if (!target) return NextResponse.json({ error: "We couldn't find that client." }, { status: 404 });
  const bytes = await file.arrayBuffer();
  const savedUrl = await persist(target, Buffer.from(bytes), file.type);
  return NextResponse.json({ url: savedUrl, mode: "IMAGE" });
}

export async function DELETE(req: NextRequest) {
  const session = await requireSession();
  const agencyId = new URL(req.url).searchParams.get("agencyId");
  const target = await resolveImageTarget(session, agencyId);
  if (!target) return NextResponse.json({ error: "We couldn't find that client." }, { status: 404 });

  if (target.kind === "client") {
    const link = await prisma.progressionBusinessClient.findUnique({
      where: { id: target.linkId },
      select: { signatureImagePath: true },
    });
    if (link?.signatureImagePath) await deleteSignatureImage(link.signatureImagePath).catch(() => {});
    await prisma.progressionBusinessClient.update({
      where: { id: target.linkId },
      data: { signatureImagePath: null, signatureMode: "BASIC" },
    });
  } else {
    const user = await prisma.user.findUnique({
      where: { id: target.userId },
      select: { emailSignatureImagePath: true },
    });
    if (user?.emailSignatureImagePath) await deleteSignatureImage(user.emailSignatureImagePath).catch(() => {});
    await prisma.user.update({
      where: { id: target.userId },
      data: { emailSignatureImagePath: null, emailSignatureMode: "BASIC" },
    });
  }
  return NextResponse.json({ ok: true, mode: "BASIC" });
}
