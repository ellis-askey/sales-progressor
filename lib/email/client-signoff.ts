// Per-client sign-off resolver for an external progression business.
//
// An external progression business signs off its own correspondence (solicitor +
// enquiry chases, emails sent from a file) differently per client agency. The
// sign-off is stored on the business<->client link (ProgressionBusinessClient
// .signatureMode / .signatureImagePath / .signatureHtml) and resolved here.
//
//   BASIC (or unset)  → the standard auto block (buildInHouseSignoff): sender
//                       name / client agency name / phone. Identical to the
//                       behaviour before per-client sign-offs existed.
//   IMAGE             → the uploaded signature image.
//   CUSTOM            → the pasted, pre-sanitised HTML signature.
//
// It NEVER returns null and ALWAYS falls back to the auto block, so:
//   - a TSP file (progressionBusinessId null) keeps the generic in-house block,
//   - a client with no signature set keeps the generic in-house block,
//   - only a client with IMAGE/CUSTOM deliberately set gets the override.
//
// The plain-text part is always the auto block's text (name / agency / phone),
// so recipients on text-only clients still see who it is from.

import { prisma } from "@/lib/prisma";
import type { EmailSignatureMode } from "@prisma/client";
import { buildInHouseSignoff } from "./in-house-signoff";
import { getSignatureImageUrl } from "@/lib/supabase-storage";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface ClientSignoffIdentity {
  name: string;
  company: string; // client agency name — the business sends on their behalf
  phone?: string | null;
}

// `custom` is true when a real IMAGE/CUSTOM sign-off was applied (vs the generic
// auto block). Callers that already render their own personal block (the
// solicitor-confirm digest's avatar/name/phone) use it to decide whether to
// override; callers that always want a sign-off just use html/text.
export type ClientSignoff = { html: string; text: string; custom: boolean };

// Pure renderer (no DB) so the preview and the live send agree exactly.
export function renderClientSignoff(data: {
  mode: EmailSignatureMode;
  imageUrl?: string | null;
  customHtml?: string | null;
  identity: ClientSignoffIdentity;
}): ClientSignoff {
  const { mode, imageUrl, customHtml, identity } = data;
  const auto = buildInHouseSignoff({ name: identity.name, agency: identity.company, phone: identity.phone ?? null });
  const text = auto.text; // plain-text sign-off is always the auto block

  if (mode === "IMAGE" && imageUrl) {
    const alt = esc([identity.name, identity.company].filter(Boolean).join(", "));
    const html = `<div style="margin-top:22px;"><img src="${esc(imageUrl)}" alt="${alt}" style="max-width:100%;height:auto;display:block;" /></div>`;
    return { html, text, custom: true };
  }
  if (mode === "CUSTOM" && customHtml && customHtml.trim()) {
    // customHtml is sanitised at save time; wrap, don't re-escape.
    return { html: `<div style="margin-top:22px;">${customHtml}</div>`, text, custom: true };
  }
  return { html: auto.html, text: auto.text, custom: false }; // BASIC / nothing set
}

// DB-backed resolver used by the live send path (chases + composed emails).
export async function resolveClientSignoff(opts: {
  businessId: string | null;
  agencyId: string | null;
  identity: ClientSignoffIdentity;
}): Promise<ClientSignoff> {
  const auto = buildInHouseSignoff({ name: opts.identity.name, agency: opts.identity.company, phone: opts.identity.phone ?? null });
  const fallback: ClientSignoff = { html: auto.html, text: auto.text, custom: false };
  if (!opts.businessId || !opts.agencyId) return fallback;

  const link = await prisma.progressionBusinessClient.findUnique({
    where: { progressionBusinessId_agencyId: { progressionBusinessId: opts.businessId, agencyId: opts.agencyId } },
    select: { signatureMode: true, signatureImagePath: true, signatureHtml: true },
  });
  if (!link) return fallback;

  return renderClientSignoff({
    mode: link.signatureMode,
    imageUrl: getSignatureImageUrl(link.signatureImagePath),
    customHtml: link.signatureHtml,
    identity: opts.identity,
  });
}
