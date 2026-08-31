// lib/agency-email/templates.ts
//
// Tier-2 (non-milestone) automated-email copy: per-agency overrides layered
// over our built-in defaults, plus the unified audit trail. Agencies get full
// prose control (founder decision 2026-08-31); every save/reset is appended to
// AgencyEmailEdit so we can always prove what an agency authored, by whom, and
// when — the "cover ourselves" record.
//
// Defaults here are extracted VERBATIM from the original inline builders, so a
// file with no override renders byte-for-byte what it did before.
//
// Adding a family = add its content type + default + coalesce/validate, then a
// TEMPLATE_FAMILIES entry. The editor routes are generic over the registry; the
// send paths use the typed resolve* wrappers.
//
// Families: completion_pack (variant vendor|purchaser),
//           exchange_day_client (variant morning|authority).

import "server-only";
import { prisma } from "@/lib/prisma";

export type Editor = { id: string; name: string; email: string };

// ─── Completion pack ──────────────────────────────────────────────────────────

export type CompletionPackSide = "vendor" | "purchaser";
export type CompletionPackContent = { subject: string; opening: string; bullets: string[] };

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

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}
function strList(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const list = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
  return list.length > 0 ? list : fallback;
}

function coalesceCompletionPack(raw: unknown, side: CompletionPackSide): CompletionPackContent {
  const d = COMPLETION_PACK_DEFAULTS[side];
  const c = (raw ?? {}) as Partial<CompletionPackContent>;
  return { subject: str(c.subject, d.subject), opening: str(c.opening, d.opening), bullets: strList(c.bullets, d.bullets) };
}
function validateCompletionPack(raw: unknown): CompletionPackContent | null {
  const c = (raw ?? {}) as Record<string, unknown>;
  const subject = typeof c.subject === "string" ? c.subject.trim() : "";
  const opening = typeof c.opening === "string" ? c.opening.trim() : "";
  const bullets = Array.isArray(c.bullets)
    ? c.bullets.filter((b): b is string => typeof b === "string" && b.trim().length > 0).map((b) => b.trim())
    : [];
  if (!subject || !opening || bullets.length === 0) return null;
  return { subject, opening, bullets };
}

// ─── Exchange-day client ──────────────────────────────────────────────────────

export type ExchangeDayMorningContent = { subject: string; paragraphs: string[] };
export type ExchangeDayAuthorityContent = { subject: string; intro: string[]; closing: string };

export const EXCHANGE_DAY_MORNING_DEFAULT: ExchangeDayMorningContent = {
  subject: "Exchange today: {addressShort}",
  paragraphs: [
    "Hi {firstName},",
    "I hope you are well.",
    "We're aiming to exchange contracts on your {saleWord} of {address} today, with completion agreed for {completionDate}.",
    "We've already been in touch with the solicitors this morning and will check in again just before 1pm, and later this afternoon if needed. We'll keep you updated as the day progresses.",
    "Your solicitor will need your authority before they can exchange contracts. If you haven't already given this verbally, please give them a quick call or send them an email confirming you're happy to exchange with completion on {completionDate}. If you're emailing, please feel free to copy us in so we have visibility too.",
    "If your solicitor tells you there's anything preventing them from exchanging today, please let us know as soon as you can so we can help chase anything needed.",
    "Likewise, if you hear anything before we do, please keep us posted.",
  ],
};

export const EXCHANGE_DAY_AUTHORITY_DEFAULT: ExchangeDayAuthorityContent = {
  subject: "{addressShort}: have you given authority?",
  intro: [
    "Hi {firstName},",
    "Just following up on your {saleWord} of {address}.",
    "If you've now given your solicitor authority to exchange, please tap below to let us know. It helps us keep track of everything as we work towards exchange today.",
  ],
  closing:
    "If you haven't yet, please give your solicitor a quick call or email confirming you're happy to exchange with completion on {completionDate}.",
};

function coalesceExchangeMorning(raw: unknown): ExchangeDayMorningContent {
  const c = (raw ?? {}) as Partial<ExchangeDayMorningContent>;
  return { subject: str(c.subject, EXCHANGE_DAY_MORNING_DEFAULT.subject), paragraphs: strList(c.paragraphs, EXCHANGE_DAY_MORNING_DEFAULT.paragraphs) };
}
function validateExchangeMorning(raw: unknown): ExchangeDayMorningContent | null {
  const c = (raw ?? {}) as Record<string, unknown>;
  const subject = typeof c.subject === "string" ? c.subject.trim() : "";
  const paragraphs = Array.isArray(c.paragraphs)
    ? c.paragraphs.filter((p): p is string => typeof p === "string" && p.trim().length > 0).map((p) => p.trim())
    : [];
  if (!subject || paragraphs.length === 0) return null;
  return { subject, paragraphs };
}

function coalesceExchangeAuthority(raw: unknown): ExchangeDayAuthorityContent {
  const c = (raw ?? {}) as Partial<ExchangeDayAuthorityContent>;
  return {
    subject: str(c.subject, EXCHANGE_DAY_AUTHORITY_DEFAULT.subject),
    intro: strList(c.intro, EXCHANGE_DAY_AUTHORITY_DEFAULT.intro),
    closing: str(c.closing, EXCHANGE_DAY_AUTHORITY_DEFAULT.closing),
  };
}
function validateExchangeAuthority(raw: unknown): ExchangeDayAuthorityContent | null {
  const c = (raw ?? {}) as Record<string, unknown>;
  const subject = typeof c.subject === "string" ? c.subject.trim() : "";
  const intro = Array.isArray(c.intro)
    ? c.intro.filter((p): p is string => typeof p === "string" && p.trim().length > 0).map((p) => p.trim())
    : [];
  const closing = typeof c.closing === "string" ? c.closing.trim() : "";
  if (!subject || intro.length === 0 || !closing) return null;
  return { subject, intro, closing };
}

// ─── Client chase ─────────────────────────────────────────────────────────────
//
// The chase body is assembled dynamically (which milestones are outstanding, in
// one of three tones), so it isn't a rewritable block like the others. Agencies
// get a subject override (empty = our rotating default) plus an optional opening
// and closing line that BRACKET the dynamic body — they don't replace it. All
// three fields optional; empty everywhere == our default output.

export type ClientChaseContent = { subject: string; intro: string; outro: string };

export const CLIENT_CHASE_DEFAULT: ClientChaseContent = { subject: "", intro: "", outro: "" };

function coalesceClientChase(raw: unknown): ClientChaseContent {
  const c = (raw ?? {}) as Partial<ClientChaseContent>;
  return {
    subject: typeof c.subject === "string" ? c.subject : "",
    intro: typeof c.intro === "string" ? c.intro : "",
    outro: typeof c.outro === "string" ? c.outro : "",
  };
}
function validateClientChase(raw: unknown): ClientChaseContent | null {
  const c = (raw ?? {}) as Record<string, unknown>;
  // Every field is optional; we only require that what's present is a string.
  if (c.subject !== undefined && typeof c.subject !== "string") return null;
  if (c.intro !== undefined && typeof c.intro !== "string") return null;
  if (c.outro !== undefined && typeof c.outro !== "string") return null;
  return {
    subject: typeof c.subject === "string" ? c.subject.trim() : "",
    intro: typeof c.intro === "string" ? c.intro.trim() : "",
    outro: typeof c.outro === "string" ? c.outro.trim() : "",
  };
}

export async function resolveClientChaseContent(agencyId: string | null): Promise<ClientChaseContent> {
  if (!agencyId) return CLIENT_CHASE_DEFAULT;
  const raw = await getRow(agencyId, "client_chase", "default");
  return raw ? coalesceClientChase(raw) : CLIENT_CHASE_DEFAULT;
}

// ─── Weekly client update ─────────────────────────────────────────────────────
//
// The weekly update's body is a per-file AI narrative, so it isn't a rewritable
// block either. An agency can set a custom subject (blank = our default), an
// optional opening line, a tone steer that guides the AI draft (our hard voice
// rules always win), and a custom closing line (blank = our default). All
// optional; empty everywhere == unchanged behaviour.

export type WeeklyUpdateContent = { subject: string; intro: string; toneGuidance: string; closing: string };

export const WEEKLY_UPDATE_DEFAULT: WeeklyUpdateContent = { subject: "", intro: "", toneGuidance: "", closing: "" };

function coalesceWeeklyUpdate(raw: unknown): WeeklyUpdateContent {
  const c = (raw ?? {}) as Partial<WeeklyUpdateContent>;
  return {
    subject: typeof c.subject === "string" ? c.subject : "",
    intro: typeof c.intro === "string" ? c.intro : "",
    toneGuidance: typeof c.toneGuidance === "string" ? c.toneGuidance : "",
    closing: typeof c.closing === "string" ? c.closing : "",
  };
}
function validateWeeklyUpdate(raw: unknown): WeeklyUpdateContent | null {
  const c = (raw ?? {}) as Record<string, unknown>;
  for (const k of ["subject", "intro", "toneGuidance", "closing"]) {
    if (c[k] !== undefined && typeof c[k] !== "string") return null;
  }
  return {
    subject: typeof c.subject === "string" ? c.subject.trim() : "",
    intro: typeof c.intro === "string" ? c.intro.trim() : "",
    toneGuidance: typeof c.toneGuidance === "string" ? c.toneGuidance.trim() : "",
    closing: typeof c.closing === "string" ? c.closing.trim() : "",
  };
}

export async function resolveWeeklyUpdateContent(agencyId: string | null): Promise<WeeklyUpdateContent> {
  if (!agencyId) return WEEKLY_UPDATE_DEFAULT;
  const raw = await getRow(agencyId, "weekly_update", "default");
  return raw ? coalesceWeeklyUpdate(raw) : WEEKLY_UPDATE_DEFAULT;
}

// ─── Generic storage ──────────────────────────────────────────────────────────

async function getRow(agencyId: string, templateKey: string, variant: string): Promise<unknown | null> {
  const row = await prisma.agencyEmailTemplate.findUnique({
    where: { agencyId_templateKey_variant: { agencyId, templateKey, variant } },
    select: { content: true },
  });
  return row?.content ?? null;
}

// ─── Send-path resolvers (typed) ──────────────────────────────────────────────

export async function resolveCompletionPackContent(agencyId: string | null, side: CompletionPackSide): Promise<CompletionPackContent> {
  if (!agencyId) return COMPLETION_PACK_DEFAULTS[side];
  const raw = await getRow(agencyId, "completion_pack", side);
  return raw ? coalesceCompletionPack(raw, side) : COMPLETION_PACK_DEFAULTS[side];
}

export async function resolveExchangeDayClientContent(
  agencyId: string | null,
): Promise<{ morning: ExchangeDayMorningContent; authority: ExchangeDayAuthorityContent }> {
  if (!agencyId) return { morning: EXCHANGE_DAY_MORNING_DEFAULT, authority: EXCHANGE_DAY_AUTHORITY_DEFAULT };
  const [m, a] = await Promise.all([
    getRow(agencyId, "exchange_day_client", "morning"),
    getRow(agencyId, "exchange_day_client", "authority"),
  ]);
  return {
    morning: m ? coalesceExchangeMorning(m) : EXCHANGE_DAY_MORNING_DEFAULT,
    authority: a ? coalesceExchangeAuthority(a) : EXCHANGE_DAY_AUTHORITY_DEFAULT,
  };
}

// ─── Registry (drives the generic editor routes) ──────────────────────────────

type FamilyDef = {
  variants: string[];
  defaultFor: (variant: string) => unknown;
  coalesce: (variant: string, raw: unknown) => unknown;
  validate: (variant: string, raw: unknown) => unknown | null;
};

export const TEMPLATE_FAMILIES: Record<string, FamilyDef> = {
  completion_pack: {
    variants: ["vendor", "purchaser"],
    defaultFor: (v) => COMPLETION_PACK_DEFAULTS[v as CompletionPackSide],
    coalesce: (v, raw) => coalesceCompletionPack(raw, v as CompletionPackSide),
    validate: (_v, raw) => validateCompletionPack(raw),
  },
  exchange_day_client: {
    variants: ["morning", "authority"],
    defaultFor: (v) => (v === "authority" ? EXCHANGE_DAY_AUTHORITY_DEFAULT : EXCHANGE_DAY_MORNING_DEFAULT),
    coalesce: (v, raw) => (v === "authority" ? coalesceExchangeAuthority(raw) : coalesceExchangeMorning(raw)),
    validate: (v, raw) => (v === "authority" ? validateExchangeAuthority(raw) : validateExchangeMorning(raw)),
  },
  client_chase: {
    variants: ["default"],
    defaultFor: () => CLIENT_CHASE_DEFAULT,
    coalesce: (_v, raw) => coalesceClientChase(raw),
    validate: (_v, raw) => validateClientChase(raw),
  },
  weekly_update: {
    variants: ["default"],
    defaultFor: () => WEEKLY_UPDATE_DEFAULT,
    coalesce: (_v, raw) => coalesceWeeklyUpdate(raw),
    validate: (_v, raw) => validateWeeklyUpdate(raw),
  },
};

// ─── Editor-facing describe / save / reset (generic over the registry) ────────

export type TemplateDescription = { exists: true; source: "agency" | "default"; effective: unknown; base: unknown };

export async function describeTemplate(agencyId: string, templateKey: string, variant: string): Promise<TemplateDescription | null> {
  const fam = TEMPLATE_FAMILIES[templateKey];
  if (!fam || !fam.variants.includes(variant)) return null;
  const base = fam.defaultFor(variant);
  const raw = await getRow(agencyId, templateKey, variant);
  if (raw == null) return { exists: true, source: "default", effective: base, base };
  return { exists: true, source: "agency", effective: fam.coalesce(variant, raw), base };
}

export async function saveTemplate(
  agencyId: string,
  templateKey: string,
  variant: string,
  rawContent: unknown,
  editor: Editor,
): Promise<{ ok: boolean }> {
  const fam = TEMPLATE_FAMILIES[templateKey];
  if (!fam || !fam.variants.includes(variant)) return { ok: false };
  const content = fam.validate(variant, rawContent);
  if (!content) return { ok: false };
  await prisma.agencyEmailTemplate.upsert({
    where: { agencyId_templateKey_variant: { agencyId, templateKey, variant } },
    create: { agencyId, templateKey, variant, content: content as never, updatedById: editor.id },
    update: { content: content as never, updatedById: editor.id },
  });
  await recordAgencyEmailEdit({ agencyId, kind: "template", editKey: templateKey, variant, action: "save", contentSnapshot: content, editor });
  return { ok: true };
}

export async function resetTemplate(agencyId: string, templateKey: string, variant: string, editor: Editor): Promise<{ ok: boolean }> {
  const fam = TEMPLATE_FAMILIES[templateKey];
  if (!fam || !fam.variants.includes(variant)) return { ok: false };
  await prisma.agencyEmailTemplate.deleteMany({ where: { agencyId, templateKey, variant } });
  await recordAgencyEmailEdit({ agencyId, kind: "template", editKey: templateKey, variant, action: "reset", contentSnapshot: null, editor });
  return { ok: true };
}

// ─── Audit ────────────────────────────────────────────────────────────────────

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
  await prisma.agencyEmailEdit
    .create({
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
    })
    .catch(() => {
      // Audit is best-effort: a logging failure must never block the actual save.
    });
}
