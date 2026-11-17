"use server";

// Server actions for user-authored composer email templates. All auth +
// permissions are enforced here, not by the UI; nothing ever crosses companies.

import type { Session } from "next-auth";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { EmailTemplate } from "@prisma/client";
import { isHtmlEmpty } from "@/lib/chase/rich-text";
import {
  getTemplateCompany,
  canManageCompanyTemplates,
  templateVisibilityWhere,
  canViewTemplate,
  canEditTemplate,
} from "@/lib/email/templates/access";
import { resolveTemplateValuesForFile, type ResolvedTemplateContext } from "@/lib/email/templates/resolve";
import { resolveEmailSignature } from "@/lib/email/signature";
import { resolveSignOffPhrase } from "@/lib/email/resolve-sign-off";

export type TemplateScope = "personal" | "company";

export type EmailTemplateDTO = {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  body: string;
  scope: TemplateScope;
  createdByName: string | null;
  mine: boolean;
  canEdit: boolean;
  updatedAt: string;
};

export type TemplateSaveInput = {
  name: string;
  description?: string | null;
  subject?: string | null;
  body: string;
  scope: TemplateScope;
};

export type TemplateActionResult =
  | { ok: true; template: EmailTemplateDTO }
  | { ok: false; error: string };

function clean(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t ? t : null;
}

function toDTO(t: EmailTemplate, session: Session): EmailTemplateDTO {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    subject: t.subject,
    body: t.body,
    scope: t.scope as TemplateScope,
    createdByName: t.createdByName,
    mine: t.createdByUserId === session.user.id,
    canEdit: canEditTemplate(session, t),
    updatedAt: t.updatedAt.toISOString(),
  };
}

function validate(input: TemplateSaveInput): string | null {
  if (!input.name || !input.name.trim()) return "Template name is required.";
  if (input.name.trim().length > 120) return "Template name is too long.";
  if (!input.body || isHtmlEmpty(input.body)) return "Template message is required.";
  return null;
}

export async function listEmailTemplates(): Promise<EmailTemplateDTO[]> {
  const session = await requireSession();
  const rows = await prisma.emailTemplate.findMany({
    where: templateVisibilityWhere(session),
    orderBy: [{ updatedAt: "desc" }],
  });
  return rows.map((t) => toDTO(t, session));
}

export async function createEmailTemplate(input: TemplateSaveInput): Promise<TemplateActionResult> {
  const session = await requireSession();
  const err = validate(input);
  if (err) return { ok: false, error: err };
  const scope: TemplateScope = input.scope === "company" ? "company" : "personal";
  if (scope === "company" && !canManageCompanyTemplates(session)) {
    return { ok: false, error: "Only a director can create company templates." };
  }
  const company = getTemplateCompany(session);
  const row = await prisma.emailTemplate.create({
    data: {
      name: input.name.trim(),
      description: clean(input.description),
      subject: clean(input.subject),
      body: input.body,
      scope,
      createdByUserId: session.user.id,
      createdByName: session.user.name ?? null,
      agencyId: company?.kind === "agency" ? company.agencyId : null,
      progressionBusinessId: company?.kind === "business" ? company.progressionBusinessId : null,
    },
  });
  return { ok: true, template: toDTO(row, session) };
}

export async function updateEmailTemplate(id: string, input: TemplateSaveInput): Promise<TemplateActionResult> {
  const session = await requireSession();
  const existing = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Template not found." };
  if (!canEditTemplate(session, existing)) return { ok: false, error: "You can't edit this template." };
  const err = validate(input);
  if (err) return { ok: false, error: err };

  // A scope change (personal <-> company) is a company-manager action either way.
  let nextScope: TemplateScope = existing.scope as TemplateScope;
  if (input.scope && input.scope !== nextScope) {
    if (!canManageCompanyTemplates(session)) {
      return { ok: false, error: "Only a director can change a template's visibility." };
    }
    nextScope = input.scope;
  }

  const row = await prisma.emailTemplate.update({
    where: { id },
    data: {
      name: input.name.trim(),
      description: clean(input.description),
      subject: clean(input.subject),
      body: input.body,
      scope: nextScope,
    },
  });
  return { ok: true, template: toDTO(row, session) };
}

export async function deleteEmailTemplate(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const existing = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!existing) return { ok: true }; // already gone — idempotent
  if (!canEditTemplate(session, existing)) return { ok: false, error: "You can't remove this template." };
  await prisma.emailTemplate.delete({ where: { id } });
  return { ok: true };
}

export async function duplicateEmailTemplate(id: string): Promise<TemplateActionResult> {
  const session = await requireSession();
  const existing = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!existing || !canViewTemplate(session, existing)) return { ok: false, error: "Template not found." };
  const company = getTemplateCompany(session);
  // A duplicate is always a PERSONAL copy owned by the duplicator, so staff can
  // adapt a company template without touching the original.
  const row = await prisma.emailTemplate.create({
    data: {
      name: `Copy of ${existing.name}`.slice(0, 120),
      description: existing.description,
      subject: existing.subject,
      body: existing.body,
      scope: "personal",
      createdByUserId: session.user.id,
      createdByName: session.user.name ?? null,
      agencyId: company?.kind === "agency" ? company.agencyId : null,
      progressionBusinessId: company?.kind === "business" ? company.progressionBusinessId : null,
    },
  });
  return { ok: true, template: toDTO(row, session) };
}

// Resolve variable values for a file: preview in settings + insertion in the
// composer. Null when the file is out of scope / not found.
export async function getTemplatePreviewContext(transactionId: string): Promise<ResolvedTemplateContext | null> {
  const session = await requireSession();
  if (!transactionId) return null;
  return resolveTemplateValuesForFile(transactionId, session);
}

// Whether the current user may create company templates (to show the Visibility
// control in the editor — the real enforcement stays server-side above).
export async function canManageCompanyTemplatesAction(): Promise<boolean> {
  const session = await requireSession();
  return canManageCompanyTemplates(session);
}

// The current user's own sign-off phrase + signature, shown FADED + non-editable
// under the template editor and preview so they know that bit is appended
// automatically (and don't type it into the template themselves). File-
// independent — their personal settings, with the agency logo band when set.
export async function getMyTemplateFooter(): Promise<{ signOff: string; signatureHtml: string }> {
  const session = await requireSession();
  const uid = session.user.id;
  const agencyId = session.user.agencyId || null;
  const signOff = await resolveSignOffPhrase({
    userId: uid,
    agencyId,
    progressionBusinessId: session.user.progressionBusinessId || null,
  });
  const agency = agencyId
    ? await prisma.agency.findUnique({
        where: { id: agencyId },
        select: { logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true },
      })
    : null;
  const sig = await resolveEmailSignature({ userId: uid, agency, signatureStyle: "default" });
  return { signOff, signatureHtml: sig.html };
}
