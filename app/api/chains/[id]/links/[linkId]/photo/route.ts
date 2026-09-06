import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditLink } from "@/lib/chain/permissions";
import { uploadToStorage, getSignedUrl, deleteFromStorage } from "@/lib/supabase-storage";

// Internal stub-photo upload for an UNCLAIMED chain link. Same permission as
// editing the stub (originator or internal staff, unclaimed only) — see
// lib/chain/permissions.ts. Stored in the private transaction-documents bucket
// under a chain-stub-photos/ prefix so it never collides with real property
// photos (property-photos/{txId}). Cleared when the link is claimed.

type RouteParams = { params: Promise<{ id: string; linkId: string }> };

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function extFor(mime: string): string {
  switch (mime) {
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/heic": return "heic";
    case "image/heif": return "heif";
    default: return "jpg";
  }
}

async function loadLink(linkId: string) {
  return prisma.chainLink.findUnique({
    where: { id: linkId },
    select: {
      id: true,
      createdByUserId: true,
      claimedByUserId: true,
      transactionId: true,
      stubAgentEmail: true,
      inviteStatus: true,
      stubPhotoStoragePath: true,
    },
  });
}

// POST — upload / replace the stub photo.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { linkId } = await params;
  const link = await loadLink(linkId);
  if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (!canEditLink(link, session.user.id, session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That image is too large. Please use one under 8 MB." }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: "File must be an image (JPG, PNG, WEBP, HEIC)." }, { status: 400 });
  }

  const path = `chain-stub-photos/${linkId}.${extFor(file.type)}`;
  const bytes = await file.arrayBuffer();
  await uploadToStorage(path, Buffer.from(bytes), file.type, { upsert: true });

  // Purge a previous photo stored at a different extension.
  if (link.stubPhotoStoragePath && link.stubPhotoStoragePath !== path) {
    await deleteFromStorage(link.stubPhotoStoragePath).catch(() => {});
  }

  await prisma.chainLink.update({
    where: { id: linkId },
    data: { stubPhotoStoragePath: path },
  });

  const url = await getSignedUrl(path).catch(() => null);
  return NextResponse.json({ ok: true, url });
}

// DELETE — remove the stub photo.
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { linkId } = await params;
  const link = await loadLink(linkId);
  if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (!canEditLink(link, session.user.id, session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (link.stubPhotoStoragePath) {
    await deleteFromStorage(link.stubPhotoStoragePath).catch(() => {});
    await prisma.chainLink.update({
      where: { id: linkId },
      data: { stubPhotoStoragePath: null },
    });
  }
  return NextResponse.json({ ok: true });
}
