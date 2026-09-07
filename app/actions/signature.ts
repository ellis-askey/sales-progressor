"use server";

// Email-signature settings actions (Profile → Email signature card).
// Save the selected mode + custom HTML; render a draft preview that matches the
// send exactly. Image upload/import lives in /api/agent/signature-image (binary).
// See docs/active/email-signature/00-audit-and-plan.md.

import { revalidatePath } from "next/cache";
import type { EmailSignatureMode } from "@prisma/client";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sanitizeSignatureHtml, MAX_SIGNATURE_HTML } from "@/lib/email/sanitize-signature";
import { resolveEmailSignature } from "@/lib/email/signature";

const AGENCY_SIG_SELECT = {
  name: true,
  logoPath: true,
  logoTileColor: true,
  logoScale: true,
  logoAlign: true,
} as const;

async function senderAgency(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { agency: { select: AGENCY_SIG_SELECT } },
  });
  return u?.agency ?? null;
}

export type SaveSignatureResult = { ok: true } | { ok: false; error: string };

export async function saveSignatureAction(input: {
  mode: EmailSignatureMode;
  customHtml?: string | null;
}): Promise<SaveSignatureResult> {
  const session = await requireSession();

  const data: {
    emailSignatureMode: EmailSignatureMode;
    emailSignatureHtml?: string | null;
  } = { emailSignatureMode: input.mode };

  if (input.mode === "CUSTOM") {
    const clean = sanitizeSignatureHtml(input.customHtml ?? "");
    if (!clean) {
      return { ok: false, error: "That signature came through empty after cleaning. Try pasting it again." };
    }
    if (clean.length > MAX_SIGNATURE_HTML) {
      return { ok: false, error: "That signature is too large. Try removing or shrinking any images." };
    }
    data.emailSignatureHtml = clean;
  }
  // IMAGE mode is set by the image upload/import route (it needs the stored
  // image first); switching to IMAGE with no image simply falls back to BASIC
  // in the resolver, so it's safe to persist the mode here regardless.

  await prisma.user.update({ where: { id: session.user.id }, data });
  revalidatePath("/agent/account/profile");
  revalidatePath("/agent", "layout");
  return { ok: true };
}

export type SignaturePreview = { html: string; missing: string[]; mode: EmailSignatureMode };

// Render exactly what would be sent for a (possibly unsaved) selection. Custom
// html is sanitised here so the preview shows the real, cleaned result.
export async function previewSignatureAction(input: {
  mode: EmailSignatureMode;
  customHtml?: string | null;
}): Promise<SignaturePreview> {
  const session = await requireSession();
  const agency = await senderAgency(session.user.id);
  const cleanCustom =
    input.mode === "CUSTOM" ? sanitizeSignatureHtml(input.customHtml ?? "") : undefined;
  const sig = await resolveEmailSignature({
    userId: session.user.id,
    agency,
    fallbackName: session.user.name,
    override: { mode: input.mode, customHtml: cleanCustom },
  });
  return { html: sig.html, missing: sig.missing, mode: sig.mode };
}
