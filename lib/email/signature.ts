// The one authoritative email-signature resolver.
//
// Every agent-authored email surface (chase send, chase preview, plain
// composer) calls this so what the agent previews is exactly what the recipient
// receives. Three modes, per the sending agent's setting:
//   BASIC  → the auto-generated TSP signature (lib/email/chase-signature.ts)
//   IMAGE  → the agent's uploaded / imported signature image
//   CUSTOM → the agent's pasted, pre-sanitised HTML signature
//
// The signature always follows WHOEVER is sending (per-user). BASIC is the
// default and the universal fallback, so a sender is never left with nothing.
//
// See docs/active/email-signature/00-audit-and-plan.md.

import { prisma } from "@/lib/prisma";
import type { EmailSignatureMode } from "@prisma/client";
import {
  buildChaseSignatureHtml,
  buildChaseSignatureText,
  chaseSignatureMissing,
  type ChaseSignatureInput,
} from "./chase-signature";
import { agencyLogoHeaderHtml } from "./logo-header";
import type { LogoScale, LogoAlign } from "@/lib/image/logo";
import { getAgencyLogoUrl, getSignatureImageUrl } from "@/lib/supabase-storage";

export interface SignatureAgencyContext {
  name?: string | null;
  logoPath?: string | null;
  logoTileColor?: string | null;
  logoScale?: string | null;
  logoAlign?: string | null;
}

export interface ResolvedSignature {
  mode: EmailSignatureMode;
  html: string;
  text: string;
  // BASIC only: optional pieces not yet filled in (photo / job title / mobile /
  // agency logo), for the "finish your signature" nudge. Empty for IMAGE/CUSTOM.
  missing: string[];
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface RenderSignatureData {
  mode: EmailSignatureMode;
  // The building blocks for BASIC, and the source of the plain-text fallback for
  // every mode.
  sigInput: ChaseSignatureInput;
  // Resolved public URL for IMAGE mode (null if none set).
  imageUrl?: string | null;
  // Pre-sanitised HTML for CUSTOM mode (null if none set).
  customHtml?: string | null;
}

// Pure renderer (no DB) so it's unit-testable. Falls back to BASIC whenever the
// selected mode has nothing to render yet (IMAGE with no image, CUSTOM with no
// html), so the sender always gets a signature.
export function renderResolvedSignature(data: RenderSignatureData): ResolvedSignature {
  const { mode, sigInput, imageUrl, customHtml } = data;

  if (mode === "IMAGE" && imageUrl) {
    const alt = esc([sigInput.agentName, sigInput.agencyName].filter(Boolean).join(", "));
    const html = `<div style="margin-top:22px;"><img src="${esc(imageUrl)}" alt="${alt}" style="max-width:100%;height:auto;display:block;" /></div>`;
    return { mode: "IMAGE", html, text: buildChaseSignatureText(sigInput), missing: [] };
  }

  if (mode === "CUSTOM" && customHtml && customHtml.trim()) {
    // customHtml is sanitised at save time (see the custom-signature save path);
    // it is wrapped, not re-escaped, so pasted formatting is preserved.
    const html = `<div style="margin-top:22px;">${customHtml}</div>`;
    return { mode: "CUSTOM", html, text: buildChaseSignatureText(sigInput), missing: [] };
  }

  return {
    mode: "BASIC",
    html: buildChaseSignatureHtml(sigInput),
    text: buildChaseSignatureText(sigInput),
    missing: chaseSignatureMissing(sigInput),
  };
}

// DB-backed resolver used by the send/preview surfaces.
export async function resolveEmailSignature(opts: {
  userId: string;
  agency?: SignatureAgencyContext | null;
  fallbackName?: string | null;
}): Promise<ResolvedSignature> {
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: {
      name: true,
      image: true,
      jobTitle: true,
      directMobile: true,
      phone: true,
      emailSignatureMode: true,
      emailSignatureImagePath: true,
      emailSignatureHtml: true,
    },
  });
  const agency = opts.agency ?? null;
  const agencyLogoBandHtml = agencyLogoHeaderHtml({
    logoUrl: getAgencyLogoUrl(agency?.logoPath),
    tileColor: agency?.logoTileColor,
    scale: (agency?.logoScale ?? null) as LogoScale | null,
    align: (agency?.logoAlign ?? null) as LogoAlign | null,
  });
  const sigInput: ChaseSignatureInput = {
    agentName: user?.name ?? opts.fallbackName ?? "",
    agentImageUrl: user?.image ?? null,
    jobTitle: user?.jobTitle ?? null,
    directMobile: user?.directMobile ?? null,
    phone: user?.phone ?? null,
    agencyName: agency?.name ?? "",
    agencyLogoBandHtml,
  };
  return renderResolvedSignature({
    mode: user?.emailSignatureMode ?? "BASIC",
    sigInput,
    imageUrl: getSignatureImageUrl(user?.emailSignatureImagePath),
    customHtml: user?.emailSignatureHtml ?? null,
  });
}
