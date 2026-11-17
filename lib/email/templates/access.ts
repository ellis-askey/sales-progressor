// Server-side permissions for user-authored composer email templates.
//
// Two scopes: `personal` (visible only to the creator) and `company` (visible to
// everyone in the owning company; only a director / business owner may create,
// edit or delete). The owning company is an estate agency (agencyId) OR an
// external progression business (progressionBusinessId) — a progression business
// wins when present, mirroring the automated-email discriminator. Permissions
// are enforced here (server), never by hidden UI alone, and never cross company.

import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";

export type TemplateCompany =
  | { kind: "agency"; agencyId: string }
  | { kind: "business"; progressionBusinessId: string }
  | null;

type TemplateOwner = {
  scope: string;
  createdByUserId: string;
  agencyId: string | null;
  progressionBusinessId: string | null;
};

// The company a user's company-scoped templates belong to (null = no company,
// e.g. internal staff — they get personal templates only).
export function getTemplateCompany(session: Session): TemplateCompany {
  const u = session.user;
  if (u.progressionBusinessId) return { kind: "business", progressionBusinessId: u.progressionBusinessId };
  if (u.agencyId) return { kind: "agency", agencyId: u.agencyId };
  return null;
}

// May the user create / edit / delete COMPANY templates? Agency director, or
// external-business owner. Ordinary staff (negotiator / progressor) may not.
export function canManageCompanyTemplates(session: Session): boolean {
  const u = session.user;
  if (u.progressionBusinessId) return u.progressionBusinessRole === "owner";
  if (u.agencyId) return u.role === "director";
  return false;
}

// Prisma `where` for every template visible to this user: their own personal
// ones + their company's company-scoped ones. Scoped to one company only.
export function templateVisibilityWhere(session: Session): Prisma.EmailTemplateWhereInput {
  const u = session.user;
  const ors: Prisma.EmailTemplateWhereInput[] = [{ scope: "personal", createdByUserId: u.id }];
  const company = getTemplateCompany(session);
  if (company?.kind === "agency") ors.push({ scope: "company", agencyId: company.agencyId });
  else if (company?.kind === "business") ors.push({ scope: "company", progressionBusinessId: company.progressionBusinessId });
  return { OR: ors };
}

// Can this user see the template (single read / duplicate)?
export function canViewTemplate(session: Session, t: TemplateOwner): boolean {
  const u = session.user;
  if (t.scope === "personal") return t.createdByUserId === u.id;
  if (t.scope === "company") {
    const company = getTemplateCompany(session);
    if (company?.kind === "agency") return t.agencyId === company.agencyId;
    if (company?.kind === "business") return t.progressionBusinessId === company.progressionBusinessId;
  }
  return false;
}

// Can this user edit / delete the template? personal → only the creator;
// company → only a company manager in the SAME company (not the mere creator).
export function canEditTemplate(session: Session, t: TemplateOwner): boolean {
  if (t.scope === "personal") return t.createdByUserId === session.user.id;
  if (t.scope === "company") {
    if (!canManageCompanyTemplates(session)) return false;
    const company = getTemplateCompany(session);
    if (company?.kind === "agency") return t.agencyId === company.agencyId;
    if (company?.kind === "business") return t.progressionBusinessId === company.progressionBusinessId;
  }
  return false;
}
