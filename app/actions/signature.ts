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
import { processSignatureImages } from "@/lib/email/signature-images";
import { detectSignatureSource, normalizeBySource, type SignatureSource } from "@/lib/email/signature-source";
import { normalizeSignOff } from "@/lib/email/sign-off";
import { resolveEmailSignature } from "@/lib/email/signature";
import { resolveAgencySender } from "@/lib/email/agency-sender";
import { sendEmail } from "@/lib/email";
import { extractFirstName } from "@/lib/contacts/displayName";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { renderClientSignoff, resolveClientSignoff, type ClientSignoffIdentity } from "@/lib/email/client-signoff";
import { getSignatureImageUrl } from "@/lib/supabase-storage";

// An external progression business can set its sign-off per client agency (on the
// Clients page). `target` routes a signature action to that client's link instead
// of the signed-in user's own signature. Absent `target` === the per-user path
// (the agent Profile card), unchanged.
export type SignatureTarget = { kind: "client"; agencyId: string };

// Resolve + ownership-verify the business<->client link for the signed-in owner.
// Returns null when the caller isn't the business owner or the link doesn't exist
// (so a client can never set a signature on a link they don't own — Law 7).
async function requireClientLink(agencyId: string) {
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return null;
  const link = await prisma.progressionBusinessClient.findUnique({
    where: { progressionBusinessId_agencyId: { progressionBusinessId: owner.businessId, agencyId } },
    select: { id: true, removedAt: true, signatureMode: true, signatureImagePath: true, signatureHtml: true },
  });
  if (!link) return null;
  return { session, owner, link };
}

// The sender identity the client sign-off previews/tests against: the owner's own
// name + phone, signing on the client agency's behalf. Mirrors the live send,
// where senderName is the file's owner/assignee and the company is the agency.
async function clientSignoffIdentity(ownerUserId: string, agencyId: string): Promise<ClientSignoffIdentity> {
  const [ownerUser, agency] = await Promise.all([
    prisma.user.findUnique({ where: { id: ownerUserId }, select: { name: true, phone: true, directMobile: true } }),
    prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } }),
  ]);
  return {
    name: ownerUser?.name ?? "",
    company: agency?.name ?? "",
    phone: ownerUser?.directMobile ?? ownerUser?.phone ?? null,
  };
}

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

export type SaveSignatureResult =
  | { ok: true; html?: string; source?: SignatureSource }
  | { ok: false; error: string };

export async function saveSignatureAction(input: {
  mode: EmailSignatureMode;
  customHtml?: string | null;
  // When omitted, the source is auto-detected from the pasted HTML. Supplied by
  // the manual "Pasted from" override.
  source?: SignatureSource;
  // Present => save to a client agency's per-client sign-off instead of the user.
  target?: SignatureTarget;
}): Promise<SaveSignatureResult> {
  if (input.target?.kind === "client") {
    return saveClientSignature(input.target.agencyId, { mode: input.mode, customHtml: input.customHtml, source: input.source });
  }
  const session = await requireSession();

  const data: {
    emailSignatureMode: EmailSignatureMode;
    emailSignatureHtml?: string | null;
  } = { emailSignatureMode: input.mode };
  let cleanForClient: string | undefined;
  let source: SignatureSource | undefined;

  if (input.mode === "CUSTOM") {
    // Detect the generator from the RAW paste (some markers, e.g. Outlook mso /
    // Gmail classes, don't survive sanitising).
    source = input.source ?? detectSignatureSource(input.customHtml ?? "");
    // Host any pasted inline images first, then sanitise (so the hosted https
    // srcs survive), then apply the per-source clean-up (e.g. un-cramp WiseStamp
    // contact cells). Empty is allowed here (the editor may briefly be empty
    // mid-edit); we just don't overwrite with nothing.
    const withImages = await processSignatureImages(input.customHtml ?? "", session.user.id);
    const clean = normalizeBySource(sanitizeSignatureHtml(withImages), source);
    if (clean.length > MAX_SIGNATURE_HTML) {
      return { ok: false, error: "That signature is too large. Try removing or shrinking any images." };
    }
    data.emailSignatureHtml = clean;
    cleanForClient = clean;
  }
  // IMAGE mode is set by the image upload/import route (it needs the stored
  // image first); switching to IMAGE with no image simply falls back to BASIC
  // in the resolver, so it's safe to persist the mode here regardless.

  await prisma.user.update({ where: { id: session.user.id }, data });
  revalidatePath("/agent/account/profile");
  revalidatePath("/agent", "layout");
  return { ok: true, html: cleanForClient, source };
}

// Manual "Pasted from" override: re-apply a chosen source's clean-up to the
// already-stored custom signature. Returns the updated HTML for re-injection.
export async function applySignatureSourceAction(
  source: SignatureSource,
  target?: SignatureTarget,
): Promise<SaveSignatureResult> {
  if (target?.kind === "client") return applyClientSignatureSource(target.agencyId, source);
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailSignatureHtml: true },
  });
  const clean = normalizeBySource(sanitizeSignatureHtml(user?.emailSignatureHtml ?? ""), source);
  if (clean.length > MAX_SIGNATURE_HTML) {
    return { ok: false, error: "That signature is too large. Try removing or shrinking any images." };
  }
  await prisma.user.update({ where: { id: session.user.id }, data: { emailSignatureHtml: clean } });
  revalidatePath("/agent/account/profile");
  revalidatePath("/agent", "layout");
  return { ok: true, html: clean, source };
}

// Save the user's (or a client's) default sign-off phrase — the valediction that
// heads the emails they compose, above the signature block. Coerced to one of the
// allowed choices server-side so a bad value can never land. Per-user by default;
// `target` routes it to a client agency's per-client sign-off (Clients page).
export async function saveSignOffAction(
  signOff: string,
  target?: SignatureTarget,
): Promise<{ ok: true; signOff: string } | { ok: false; error: string }> {
  const phrase = normalizeSignOff(signOff);
  if (target?.kind === "client") {
    const ctx = await requireClientLink(target.agencyId);
    if (!ctx) return { ok: false, error: "We couldn't find that client." };
    await prisma.progressionBusinessClient.update({ where: { id: ctx.link.id }, data: { signOff: phrase } });
    revalidatePath(`/agent/clients/${target.agencyId}`);
    return { ok: true, signOff: phrase };
  }
  const session = await requireSession();
  await prisma.user.update({ where: { id: session.user.id }, data: { emailSignOff: phrase } });
  revalidatePath("/agent/account/profile");
  revalidatePath("/agent", "layout");
  return { ok: true, signOff: phrase };
}

export type SignaturePreview = { html: string; missing: string[]; mode: EmailSignatureMode };

// Render exactly what would be sent for a (possibly unsaved) selection. Custom
// html is sanitised here so the preview shows the real, cleaned result.
export async function previewSignatureAction(input: {
  mode: EmailSignatureMode;
  customHtml?: string | null;
  target?: SignatureTarget;
}): Promise<SignaturePreview> {
  if (input.target?.kind === "client") {
    return previewClientSignature(input.target.agencyId, { mode: input.mode, customHtml: input.customHtml });
  }
  const session = await requireSession();
  const agency = await senderAgency(session.user.id);
  const cleanCustom =
    input.mode === "CUSTOM"
      ? normalizeBySource(
          sanitizeSignatureHtml(await processSignatureImages(input.customHtml ?? "", session.user.id)),
          detectSignatureSource(input.customHtml ?? ""),
        )
      : undefined;
  const sig = await resolveEmailSignature({
    userId: session.user.id,
    agency,
    fallbackName: session.user.name,
    override: { mode: input.mode, customHtml: cleanCustom },
  });
  return { html: sig.html, missing: sig.missing, mode: sig.mode };
}

function londonGreeting(): string {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(new Date()),
  );
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// Send the signed-in user a real email built from their CURRENT saved signature,
// so they can see exactly how it lands in an inbox before trusting it on live
// chases. Resolves the signature the same way the live send path does (logo band
// included), and sends from their own agency sender identity.
export async function sendSignatureTestAction(target?: SignatureTarget): Promise<{ ok: true } | { ok: false; error: string }> {
  if (target?.kind === "client") return sendClientSignatureTest(target.agencyId);
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, agencyId: true },
  });
  if (!user?.email) return { ok: false, error: "There's no email address on your account to send the test to." };

  const agency = await senderAgency(session.user.id);
  const sig = await resolveEmailSignature({ userId: session.user.id, agency, fallbackName: user.name });

  const greeting = londonGreeting();
  const firstName = user.name ? extractFirstName(user.name) : undefined;
  const sender = await resolveAgencySender(user.agencyId ?? null, firstName ? { personFirstName: firstName } : undefined);

  const bodyHtml =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a">` +
    `<p>${greeting},</p>` +
    `<p>I hope you're well. This is a quick test so you can see exactly how your signature appears to the people you email.</p>` +
    `<p>If the sign-off below looks the way you want, you're all set.</p>` +
    sig.html +
    `</div>`;
  const text =
    `${greeting},\n\n` +
    `I hope you're well. This is a quick test so you can see exactly how your signature appears to the people you email.\n\n` +
    `If the sign-off below looks the way you want, you're all set.`;

  try {
    await sendEmail({
      to: user.email,
      from: sender.from,
      replyTo: sender.replyTo,
      subject: "Your email signature (test)",
      text,
      html: bodyHtml,
      emailType: "signature_test",
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't send the test email just now. Try again in a moment." };
  }
}

// ── Per-client sign-off handlers (external progression business) ─────────────
// Reached only via a `target: { kind: "client" }` on the actions above. Each
// re-verifies the signed-in user owns the business the client belongs to before
// touching the link (Law 7). Storage mirrors the per-user path but on
// ProgressionBusinessClient instead of User.

async function saveClientSignature(
  agencyId: string,
  input: { mode: EmailSignatureMode; customHtml?: string | null; source?: SignatureSource },
): Promise<SaveSignatureResult> {
  const ctx = await requireClientLink(agencyId);
  if (!ctx) return { ok: false, error: "We couldn't find that client." };
  const { owner, link } = ctx;

  const data: { signatureMode: EmailSignatureMode; signatureHtml?: string | null } = { signatureMode: input.mode };
  let cleanForClient: string | undefined;
  let source: SignatureSource | undefined;

  if (input.mode === "CUSTOM") {
    source = input.source ?? detectSignatureSource(input.customHtml ?? "");
    const withImages = await processSignatureImages(input.customHtml ?? "", `client/${owner.businessId}/${agencyId}`);
    const clean = normalizeBySource(sanitizeSignatureHtml(withImages), source);
    if (clean.length > MAX_SIGNATURE_HTML) {
      return { ok: false, error: "That signature is too large. Try removing or shrinking any images." };
    }
    data.signatureHtml = clean;
    cleanForClient = clean;
  }

  await prisma.progressionBusinessClient.update({ where: { id: link.id }, data });
  revalidatePath(`/agent/clients/${agencyId}`);
  return { ok: true, html: cleanForClient, source };
}

async function applyClientSignatureSource(agencyId: string, source: SignatureSource): Promise<SaveSignatureResult> {
  const ctx = await requireClientLink(agencyId);
  if (!ctx) return { ok: false, error: "We couldn't find that client." };
  const clean = normalizeBySource(sanitizeSignatureHtml(ctx.link.signatureHtml ?? ""), source);
  if (clean.length > MAX_SIGNATURE_HTML) {
    return { ok: false, error: "That signature is too large. Try removing or shrinking any images." };
  }
  await prisma.progressionBusinessClient.update({ where: { id: ctx.link.id }, data: { signatureHtml: clean } });
  revalidatePath(`/agent/clients/${agencyId}`);
  return { ok: true, html: clean, source };
}

async function previewClientSignature(
  agencyId: string,
  input: { mode: EmailSignatureMode; customHtml?: string | null },
): Promise<SignaturePreview> {
  const ctx = await requireClientLink(agencyId);
  if (!ctx) return { html: "", missing: [], mode: input.mode };
  const { owner, link } = ctx;
  const identity = await clientSignoffIdentity(owner.userId, agencyId);
  const cleanCustom =
    input.mode === "CUSTOM"
      ? normalizeBySource(
          sanitizeSignatureHtml(await processSignatureImages(input.customHtml ?? "", `client/${owner.businessId}/${agencyId}`)),
          detectSignatureSource(input.customHtml ?? ""),
        )
      : undefined;
  const rendered = renderClientSignoff({
    mode: input.mode,
    imageUrl: getSignatureImageUrl(link.signatureImagePath),
    customHtml: input.mode === "CUSTOM" ? cleanCustom ?? link.signatureHtml : link.signatureHtml,
    identity,
  });
  // No "finish your signature" nudge per-client: BASIC is a complete auto block.
  return { html: rendered.html, missing: [], mode: input.mode };
}

async function sendClientSignatureTest(agencyId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireClientLink(agencyId);
  if (!ctx) return { ok: false, error: "We couldn't find that client." };
  const { owner } = ctx;
  const ownerUser = await prisma.user.findUnique({ where: { id: owner.userId }, select: { email: true, name: true } });
  if (!ownerUser?.email) return { ok: false, error: "There's no email address on your account to send the test to." };

  const identity = await clientSignoffIdentity(owner.userId, agencyId);
  const sig = await resolveClientSignoff({ businessId: owner.businessId, agencyId, identity });

  const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const greeting = londonGreeting();
  const firstName = ownerUser.name ? extractFirstName(ownerUser.name) : undefined;
  const sender = await resolveAgencySender(null, firstName ? { personFirstName: firstName } : undefined);
  const company = identity.company || "this client";

  const bodyHtml =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a">` +
    `<p>${greeting},</p>` +
    `<p>This is a quick test so you can see how your sign-off for ${escHtml(company)} appears to the people you email.</p>` +
    `<p>If the sign-off below looks the way you want, you're all set.</p>` +
    sig.html +
    `</div>`;
  const text =
    `${greeting},\n\n` +
    `This is a quick test so you can see how your sign-off for ${company} appears to the people you email.\n\n` +
    `If the sign-off below looks the way you want, you're all set.${sig.text}`;

  try {
    await sendEmail({
      to: ownerUser.email,
      from: sender.from,
      replyTo: sender.replyTo,
      subject: "Your client sign-off (test)",
      text,
      html: bodyHtml,
      emailType: "signature_test",
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't send the test email just now. Try again in a moment." };
  }
}
