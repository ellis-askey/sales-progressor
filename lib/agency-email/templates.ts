// lib/agency-email/templates.ts
//
// Tier-2 (non-milestone) automated-email copy: per-agency overrides layered
// over our built-in defaults, plus the unified audit trail. An agency gets full
// prose control (founder decision 2026-08-31); every save/reset is appended to
// AgencyEmailEdit so we can always prove what an agency authored, by whom, and
// when — the "cover ourselves" record.
//
// Defaults here are extracted VERBATIM from the original inline builders, so a
// file with no override renders byte-for-byte what it did before.
//
// First family: completion_pack (Contracts exchanged: what happens next).
// Exchange-day + client-chase families land in later Phase-2 PRs, same shape.

import "server-only";
import { prisma } from "@/lib/prisma";

export type TemplateKey = "completion_pack";
export type CompletionPackSide = "vendor" | "purchaser";

// A completion-pack email's editable prose. Tokens: {address} and {teamRef}
// (the "<agent> or a member of our team" reference) are filled per send. The
// completion-date sentence and the greeting / sign-off / portal button are
// structural and added by the renderer, not editable here.
export type CompletionPackContent = {
  subject: string;
  opening: string;
  bullets: string[];
};

export const COMPLETION_PACK_DEFAULTS: Record<CompletionPackSide, CompletionPackContent> = {
  vendor: {
    subject: "Contracts exchanged: what happens next for your sale",
    opening: "Contracts have been exchanged on {address}. The sale is now legally committed.",
    bullets: [
      "Your solicitor will handle the transfer of funds. You don't need to be at the property.",
      "Read all utility meters (gas, electricity, water) before you leave for the last time.",
      "Leave all keys, fobs, security codes, and gate remotes at the property (or hand to {teamRef}).",
      "Leave appliance manuals, warranties, and service records. The buyer is entitled to these.",
      "Your solicitor will redeem your mortgage from the completion funds and send you a completion statement.",
    ],
  },
  purchaser: {
    subject: "Contracts exchanged: what happens next for your purchase",
    opening: "Contracts have been exchanged on {address}. Your purchase is now legally committed.",
    bullets: [
      "Keep your phone on. Your solicitor will call you when the funds have been transferred.",
      "Keys are usually available from midday, once your solicitor confirms completion. {teamRef} will let you know.",
      "Read all utility meters (gas, electricity, water) when you arrive at the property.",
      "From today, the property is at your risk. If your buildings insurance isn't already in place, arrange it as soon as possible.",
      "Your solicitor will register your ownership at HM Land Registry after completion.",
    ],
  },
};

/** Defensive merge so a partial / malformed stored row can never break a send. */
function coalesceCompletionPack(raw: unknown, side: CompletionPackSide): CompletionPackContent {
  const d = COMPLETION_PACK_DEFAULTS[side];
  const c = (raw ?? {}) as Partial<CompletionPackContent>;
  const bullets = Array.isArray(c.bullets)
    ? c.bullets.filter((b): b is string => typeof b === "string" && b.trim().length > 0)
    : null;
  return {
    subject: typeof c.subject === "string" && c.subject.trim() ? c.subject : d.subject,
    opening: typeof c.opening === "string" && c.opening.trim() ? c.opening : d.opening,
    bullets: bullets && bullets.length > 0 ? bullets : d.bullets,
  };
}

/**
 * Effective completion-pack copy for a send. agencyId null (or no row) → our
 * default. Used by the live send path (lib/services/portal.ts).
 */
export async function resolveCompletionPackContent(
  agencyId: string | null,
  side: CompletionPackSide,
): Promise<CompletionPackContent> {
  if (!agencyId) return COMPLETION_PACK_DEFAULTS[side];
  const row = await prisma.agencyEmailTemplate.findUnique({
    where: { agencyId_templateKey_variant: { agencyId, templateKey: "completion_pack", variant: side } },
    select: { content: true },
  });
  if (!row) return COMPLETION_PACK_DEFAULTS[side];
  return coalesceCompletionPack(row.content, side);
}

export type CompletionPackDescription = {
  effective: CompletionPackContent;
  source: "agency" | "default";
  base: CompletionPackContent; // our default — what a reset reverts to / compares against
};

/** For the agency editor: the current effective copy, whether it's theirs, and our default. */
export async function describeCompletionPack(
  agencyId: string,
  side: CompletionPackSide,
): Promise<CompletionPackDescription> {
  const base = COMPLETION_PACK_DEFAULTS[side];
  const row = await prisma.agencyEmailTemplate.findUnique({
    where: { agencyId_templateKey_variant: { agencyId, templateKey: "completion_pack", variant: side } },
    select: { content: true },
  });
  if (!row) return { effective: base, source: "default", base };
  return { effective: coalesceCompletionPack(row.content, side), source: "agency", base };
}

// ─── Save / reset + audit ─────────────────────────────────────────────────────

export type Editor = { id: string; name: string; email: string };

/** Append-only audit row for any agency email-copy edit (milestone or template). */
export async function recordAgencyEmailEdit(params: {
  agencyId: string;
  kind: "milestone" | "template";
  editKey: string;
  variant: string;
  action: "save" | "reset";
  contentSnapshot: unknown | null;
  editor: Editor;
}): Promise<void> {
  await prisma.agencyEmailEdit.create({
    data: {
      agencyId: params.agencyId,
      kind: params.kind,
      editKey: params.editKey,
      variant: params.variant,
      action: params.action,
      contentSnapshot: (params.contentSnapshot ?? undefined) as never,
      editedById: params.editor.id,
      editedByName: params.editor.name,
      editedByEmail: params.editor.email,
    },
  }).catch(() => {
    // Audit is best-effort: a logging failure must never block the actual save.
  });
}

/** Save this agency's completion-pack override for one side + write the audit row. */
export async function saveCompletionPack(params: {
  agencyId: string;
  side: CompletionPackSide;
  content: CompletionPackContent;
  editor: Editor;
}): Promise<void> {
  const { agencyId, side, content, editor } = params;
  await prisma.agencyEmailTemplate.upsert({
    where: { agencyId_templateKey_variant: { agencyId, templateKey: "completion_pack", variant: side } },
    create: { agencyId, templateKey: "completion_pack", variant: side, content: content as never, updatedById: editor.id },
    update: { content: content as never, updatedById: editor.id },
  });
  await recordAgencyEmailEdit({
    agencyId, kind: "template", editKey: "completion_pack", variant: side, action: "save", contentSnapshot: content, editor,
  });
}

/** Remove this agency's completion-pack override for one side + write the audit row. */
export async function resetCompletionPack(params: {
  agencyId: string;
  side: CompletionPackSide;
  editor: Editor;
}): Promise<void> {
  const { agencyId, side, editor } = params;
  await prisma.agencyEmailTemplate.deleteMany({
    where: { agencyId, templateKey: "completion_pack", variant: side },
  });
  await recordAgencyEmailEdit({
    agencyId, kind: "template", editKey: "completion_pack", variant: side, action: "reset", contentSnapshot: null, editor,
  });
}
