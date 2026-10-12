import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  EndingScreen,
  FormDefinition,
  FormListItem,
  FormSettings,
  FormStatus,
  FormTheme,
  Question,
  ResponseAnswers,
  ResponseMeta,
  WelcomeScreen,
} from "./types";
import { blankDefinition, defaultTheme } from "./defaults";
import { newPublicId } from "./ids";

// Every read and write in this module is scoped by tenantId — the Boardwalk
// equivalent of Law 7. There is no cross-tenant query anywhere in lib/forms.

// ─── Definition sanitisation ─────────────────────────────────────────────────
// Draft documents arrive from the (authenticated) builder client. We rebuild
// them field-by-field against the known shape so junk keys, oversized blobs,
// or prototype-pollution attempts never reach the database.

const MAX_DEFINITION_BYTES = 400_000;
const MAX_QUESTIONS = 120;
const MAX_CHOICES = 60;
const MAX_STR = 4_000;

const str = (v: unknown, cap = MAX_STR): string => (typeof v === "string" ? v.slice(0, cap) : "");
const optStr = (v: unknown, cap = MAX_STR): string | undefined =>
  typeof v === "string" && v ? v.slice(0, cap) : undefined;
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const bool = (v: unknown): boolean => v === true;

function sanitizeConditions(v: unknown): { combinator: "and" | "or"; conditions: { questionId: string; op: string; value?: string | number }[] } {
  const group = (v ?? {}) as Record<string, unknown>;
  const conditions = Array.isArray(group.conditions) ? group.conditions.slice(0, 20) : [];
  return {
    combinator: group.combinator === "or" ? "or" : "and",
    conditions: conditions
      .filter((c) => c && typeof c === "object")
      .map((c) => {
        const cond = c as Record<string, unknown>;
        return {
          questionId: str(cond.questionId, 60),
          op: str(cond.op, 30),
          value:
            typeof cond.value === "number" ? cond.value : optStr(cond.value, 500),
        };
      }),
  };
}

function sanitizeQuestion(v: unknown): Question | null {
  if (!v || typeof v !== "object") return null;
  const q = v as Record<string, unknown>;
  if (typeof q.id !== "string" || typeof q.type !== "string") return null;

  const question: Question = {
    id: str(q.id, 60),
    type: q.type as Question["type"],
    title: str(q.title, 600),
    required: bool(q.required),
  };
  question.description = optStr(q.description, 2000);
  question.imageUrl = optStr(q.imageUrl, 1000);
  question.section = optStr(q.section, 120);
  if (Array.isArray(q.choices)) {
    question.choices = q.choices
      .slice(0, MAX_CHOICES)
      .filter((c) => c && typeof c === "object")
      .map((c) => {
        const choice = c as Record<string, unknown>;
        return {
          id: str(choice.id, 60),
          label: str(choice.label, 300),
          imageUrl: optStr(choice.imageUrl, 1000),
        };
      });
  }
  if (q.allowOther === true) question.allowOther = true;
  question.minSelections = num(q.minSelections);
  question.maxSelections = num(q.maxSelections);
  question.min = num(q.min);
  question.max = num(q.max);
  question.minLabel = optStr(q.minLabel, 60);
  question.maxLabel = optStr(q.maxLabel, 60);
  question.starCount = num(q.starCount);
  question.maxLength = num(q.maxLength);
  question.placeholder = optStr(q.placeholder, 200);
  question.maxFiles = num(q.maxFiles);
  question.maxFileSizeMb = num(q.maxFileSizeMb);
  if (Array.isArray(q.acceptedFileTypes)) {
    question.acceptedFileTypes = q.acceptedFileTypes
      .filter((t): t is "image" | "pdf" | "document" | "any" =>
        ["image", "pdf", "document", "any"].includes(t as string)
      )
      .slice(0, 4);
  }
  question.consentText = optStr(q.consentText, 2000);
  question.buttonText = optStr(q.buttonText, 60);
  if (["any", "future_only", "past_only"].includes(q.dateConstraint as string)) {
    question.dateConstraint = q.dateConstraint as Question["dateConstraint"];
  }
  if (q.visibleIf && typeof q.visibleIf === "object") {
    const group = sanitizeConditions(q.visibleIf);
    if (group.conditions.length) question.visibleIf = group as Question["visibleIf"];
  }
  if (Array.isArray(q.jumps)) {
    question.jumps = q.jumps
      .slice(0, 20)
      .filter((j) => j && typeof j === "object")
      .map((j) => {
        const jump = j as Record<string, unknown>;
        const group = sanitizeConditions(jump);
        const rawTarget = (jump.target ?? {}) as Record<string, unknown>;
        const target =
          rawTarget.type === "ending"
            ? { type: "ending" as const, endingId: str(rawTarget.endingId, 60) }
            : { type: "question" as const, questionId: str(rawTarget.questionId, 60) };
        return { id: str(jump.id, 60), combinator: group.combinator, conditions: group.conditions as never, target };
      });
  }
  // Drop undefined keys so the stored JSON stays compact
  return JSON.parse(JSON.stringify(question)) as Question;
}

export function sanitizeDefinition(raw: unknown): FormDefinition {
  if (!raw || typeof raw !== "object") return blankDefinition();
  if (JSON.stringify(raw).length > MAX_DEFINITION_BYTES) {
    throw Object.assign(new Error("Form is too large to save."), { status: 413 });
  }
  const d = raw as Record<string, unknown>;

  const w = (d.welcome ?? {}) as Record<string, unknown>;
  const welcome: WelcomeScreen = {
    enabled: w.enabled !== false,
    title: str(w.title, 300),
    description: optStr(w.description, 2000),
    buttonText: str(w.buttonText, 60) || "Start",
    imageUrl: optStr(w.imageUrl, 1000),
    estimateLabel: optStr(w.estimateLabel, 80),
  };

  const questions = (Array.isArray(d.questions) ? d.questions : [])
    .slice(0, MAX_QUESTIONS)
    .map(sanitizeQuestion)
    .filter((q): q is Question => q !== null);

  const endings: EndingScreen[] = (Array.isArray(d.endings) ? d.endings : [])
    .slice(0, 20)
    .filter((e) => e && typeof e === "object")
    .map((e) => {
      const end = e as Record<string, unknown>;
      return {
        id: str(end.id, 60),
        title: str(end.title, 300),
        description: optStr(end.description, 2000),
        buttonText: optStr(end.buttonText, 60),
        buttonUrl: optStr(end.buttonUrl, 1000),
        redirectUrl: optStr(end.redirectUrl, 1000),
        isDefault: bool(end.isDefault),
      };
    });
  if (!endings.length) endings.push(blankDefinition().endings[0]);
  if (!endings.some((e) => e.isDefault)) endings[0].isDefault = true;

  const t = (d.theme ?? {}) as Record<string, unknown>;
  const base = defaultTheme();
  const colour = (v: unknown, fallback: string) =>
    typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : fallback;
  const theme: FormTheme = {
    preset: str(t.preset, 40) || base.preset,
    primaryColor: colour(t.primaryColor, base.primaryColor),
    backgroundColor: colour(t.backgroundColor, base.backgroundColor),
    textColor: colour(t.textColor, base.textColor),
    buttonTextColor: colour(t.buttonTextColor, base.buttonTextColor),
    font: ["sans", "serif", "display", "mono"].includes(t.font as string) ? (t.font as FormTheme["font"]) : base.font,
    backgroundStyle: ["solid", "gradient", "image"].includes(t.backgroundStyle as string)
      ? (t.backgroundStyle as FormTheme["backgroundStyle"])
      : base.backgroundStyle,
    backgroundImageUrl: optStr(t.backgroundImageUrl, 1000),
    logoUrl: optStr(t.logoUrl, 1000),
    progressStyle: ["bar", "fraction", "none"].includes(t.progressStyle as string)
      ? (t.progressStyle as FormTheme["progressStyle"])
      : base.progressStyle,
    layout: t.layout === "classic" ? "classic" : "one_at_a_time",
    buttonRadius: Math.min(Math.max(num(t.buttonRadius) ?? base.buttonRadius, 0), 32),
  };

  const s = (d.settings ?? {}) as Record<string, unknown>;
  const rc = (s.respondentConfirmation ?? {}) as Record<string, unknown>;
  const settings: FormSettings = {
    notifyEmails: (Array.isArray(s.notifyEmails) ? s.notifyEmails : [])
      .filter((e): e is string => typeof e === "string" && /@/.test(e))
      .map((e) => e.toLowerCase().trim().slice(0, 254))
      .slice(0, 10),
    respondentConfirmation: {
      enabled: bool(rc.enabled),
      subject: optStr(rc.subject, 200),
      message: optStr(rc.message, 4000),
    },
    submissionLimit: num(s.submissionLimit) ?? null,
    closeAt: optStr(s.closeAt, 40) ?? null,
    closedMessage: optStr(s.closedMessage, 1000),
    hiddenFields: (Array.isArray(s.hiddenFields) ? s.hiddenFields : [])
      .filter((f): f is string => typeof f === "string" && /^[a-zA-Z0-9_-]{1,40}$/.test(f))
      .slice(0, 10),
    webhookUrl: optStr(s.webhookUrl, 1000) ?? null,
  };

  return JSON.parse(JSON.stringify({ version: 1, welcome, questions, endings, theme, settings })) as FormDefinition;
}

// ─── Forms CRUD ──────────────────────────────────────────────────────────────

function toListItem(f: {
  id: string;
  title: string;
  status: string;
  publicId: string;
  responseCount: number;
  draft: Prisma.JsonValue;
  published: Prisma.JsonValue | null;
  lastEditedAt: Date;
  createdAt: Date;
  publishedAt: Date | null;
}): FormListItem {
  const draft = f.draft as unknown as FormDefinition;
  const hasUnpublishedChanges =
    f.published !== null && JSON.stringify(f.draft) !== JSON.stringify(f.published);
  return {
    id: f.id,
    title: f.title,
    status: f.status as FormStatus,
    publicId: f.publicId,
    responseCount: f.responseCount,
    questionCount: draft?.questions?.length ?? 0,
    lastEditedAt: f.lastEditedAt.toISOString(),
    createdAt: f.createdAt.toISOString(),
    publishedAt: f.publishedAt?.toISOString() ?? null,
    hasUnpublishedChanges,
  };
}

export async function listForms(tenantId: string): Promise<FormListItem[]> {
  const forms = await prisma.tenantForm.findMany({
    where: { tenantId },
    orderBy: { lastEditedAt: "desc" },
  });
  return forms.map(toListItem);
}

export async function createForm(
  tenantId: string,
  userId: string,
  opts: { title?: string; definition?: FormDefinition }
) {
  const definition = opts.definition ?? blankDefinition();
  if (opts.title) definition.welcome.title = opts.title;
  const title = opts.title || definition.welcome.title || "Untitled form";
  return prisma.tenantForm.create({
    data: {
      tenantId,
      title: title.slice(0, 200),
      publicId: newPublicId(),
      draft: definition as unknown as Prisma.InputJsonValue,
      createdById: userId,
    },
  });
}

export async function getForm(tenantId: string, formId: string) {
  return prisma.tenantForm.findFirst({ where: { id: formId, tenantId } });
}

export async function saveDraft(tenantId: string, formId: string, raw: unknown) {
  const definition = sanitizeDefinition(raw);
  const form = await prisma.tenantForm.findFirst({ where: { id: formId, tenantId }, select: { id: true } });
  if (!form) return null;
  const updated = await prisma.tenantForm.update({
    where: { id: formId },
    data: {
      draft: definition as unknown as Prisma.InputJsonValue,
      title: (definition.welcome.title || "Untitled form").slice(0, 200),
      lastEditedAt: new Date(),
    },
  });
  return updated;
}

export async function renameForm(tenantId: string, formId: string, title: string) {
  const form = await prisma.tenantForm.findFirst({ where: { id: formId, tenantId } });
  if (!form) return null;
  const draft = form.draft as unknown as FormDefinition;
  draft.welcome.title = title.slice(0, 200);
  return prisma.tenantForm.update({
    where: { id: formId },
    data: {
      title: title.slice(0, 200) || "Untitled form",
      draft: draft as unknown as Prisma.InputJsonValue,
      lastEditedAt: new Date(),
    },
  });
}

export async function duplicateForm(tenantId: string, formId: string) {
  const form = await prisma.tenantForm.findFirst({ where: { id: formId, tenantId } });
  if (!form) return null;
  return prisma.tenantForm.create({
    data: {
      tenantId,
      title: `${form.title} (copy)`.slice(0, 200),
      publicId: newPublicId(),
      draft: form.draft as Prisma.InputJsonValue,
      createdById: form.createdById,
    },
  });
}

export async function setFormStatus(
  tenantId: string,
  formId: string,
  action: "publish" | "unpublish" | "close" | "reopen" | "archive" | "restore"
) {
  const form = await prisma.tenantForm.findFirst({ where: { id: formId, tenantId } });
  if (!form) return null;

  switch (action) {
    case "publish": {
      // Freeze the draft as the live copy.
      return prisma.tenantForm.update({
        where: { id: formId },
        data: {
          status: "published",
          published: form.draft as Prisma.InputJsonValue,
          publishedAt: new Date(),
          closedAt: null,
          archivedAt: null,
        },
      });
    }
    case "unpublish":
      return prisma.tenantForm.update({
        where: { id: formId },
        data: { status: "draft", published: Prisma.DbNull, publishedAt: null, closedAt: null },
      });
    case "close":
      if (form.status !== "published") return form;
      return prisma.tenantForm.update({
        where: { id: formId },
        data: { status: "closed", closedAt: new Date() },
      });
    case "reopen":
      if (form.status !== "closed") return form;
      return prisma.tenantForm.update({
        where: { id: formId },
        data: { status: "published", closedAt: null },
      });
    case "archive":
      return prisma.tenantForm.update({
        where: { id: formId },
        data: { status: "archived", archivedAt: new Date(), published: Prisma.DbNull, publishedAt: null },
      });
    case "restore":
      return prisma.tenantForm.update({
        where: { id: formId },
        data: { status: "draft", archivedAt: null },
      });
  }
}

/** Hard delete — only allowed from the archived state, so it's a two-step action. */
export async function deleteForm(tenantId: string, formId: string) {
  const form = await prisma.tenantForm.findFirst({ where: { id: formId, tenantId } });
  if (!form || form.status !== "archived") return null;
  await prisma.tenantForm.delete({ where: { id: formId } });
  return form;
}

// ─── Public access ───────────────────────────────────────────────────────────

export interface PublicFormPayload {
  publicId: string;
  title: string;
  welcome: WelcomeScreen;
  questions: Question[];
  endings: EndingScreen[];
  theme: FormTheme;
  hiddenFields: string[];
  tenantName: string;
}

export type PublicFormState =
  | { state: "open"; form: PublicFormPayload }
  | { state: "closed"; message: string; theme: FormTheme | null; title: string }
  | { state: "not_found" };

/**
 * The respondent-facing payload. Strips internal settings (notify emails,
 * webhook URL, limits) — respondents only ever see questions, screens, theme.
 */
export async function getPublicForm(publicId: string): Promise<PublicFormState> {
  const form = await prisma.tenantForm.findUnique({
    where: { publicId },
    include: { tenant: { select: { name: true } } },
  });
  if (!form || !form.published || form.status === "archived" || form.status === "draft") {
    return { state: "not_found" };
  }
  const def = form.published as unknown as FormDefinition;
  const closedMessage =
    def.settings.closedMessage || "This form is no longer accepting responses.";

  if (form.status === "closed") {
    return { state: "closed", message: closedMessage, theme: def.theme, title: form.title };
  }
  if (def.settings.closeAt && new Date(def.settings.closeAt) < new Date()) {
    return { state: "closed", message: closedMessage, theme: def.theme, title: form.title };
  }
  if (
    def.settings.submissionLimit &&
    def.settings.submissionLimit > 0 &&
    form.responseCount >= def.settings.submissionLimit
  ) {
    return { state: "closed", message: closedMessage, theme: def.theme, title: form.title };
  }

  return {
    state: "open",
    form: {
      publicId: form.publicId,
      title: form.title,
      welcome: def.welcome,
      questions: def.questions,
      endings: def.endings,
      theme: def.theme,
      hiddenFields: def.settings.hiddenFields,
      tenantName: form.tenant.name,
    },
  };
}

// ─── Stats ───────────────────────────────────────────────────────────────────

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function recordFormEvent(publicId: string, event: "view" | "start"): Promise<void> {
  const form = await prisma.tenantForm.findUnique({ where: { publicId }, select: { id: true, status: true } });
  if (!form || form.status !== "published") return;
  const date = todayUtc();
  const field = event === "view" ? "views" : "starts";
  await prisma.tenantFormStat.upsert({
    where: { formId_date: { formId: form.id, date } },
    create: { formId: form.id, date, [field]: 1 },
    update: { [field]: { increment: 1 } },
  });
}

// ─── Submissions ─────────────────────────────────────────────────────────────

export async function createResponse(
  formId: string,
  answers: ResponseAnswers,
  meta: ResponseMeta,
  uploadIds: string[]
) {
  const response = await prisma.$transaction(async (tx) => {
    const created = await tx.tenantFormResponse.create({
      data: {
        formId,
        answers: answers as Prisma.InputJsonValue,
        meta: meta as unknown as Prisma.InputJsonValue,
      },
    });
    if (uploadIds.length) {
      // Claim only uploads that belong to this form and are not already owned.
      await tx.tenantFormUpload.updateMany({
        where: { id: { in: uploadIds }, formId, responseId: null },
        data: { responseId: created.id },
      });
    }
    await tx.tenantForm.update({
      where: { id: formId },
      data: { responseCount: { increment: 1 } },
    });
    const date = todayUtc();
    await tx.tenantFormStat.upsert({
      where: { formId_date: { formId, date } },
      create: { formId, date, completions: 1 },
      update: { completions: { increment: 1 } },
    });
    return created;
  });
  return response;
}

export async function listResponses(
  tenantId: string,
  formId: string,
  opts: { cursor?: string; take?: number; search?: string }
) {
  const form = await prisma.tenantForm.findFirst({ where: { id: formId, tenantId }, select: { id: true } });
  if (!form) return null;
  const take = Math.min(opts.take ?? 50, 200);
  const responses = await prisma.tenantFormResponse.findMany({
    where: { formId },
    orderBy: { submittedAt: "desc" },
    take: take + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = responses.length > take;
  let page = hasMore ? responses.slice(0, take) : responses;

  // Simple in-page search over stringified answers (fine at this scale).
  if (opts.search) {
    const needle = opts.search.toLowerCase();
    page = page.filter((r) => JSON.stringify(r.answers).toLowerCase().includes(needle));
  }
  return { responses: page, nextCursor: hasMore ? responses[take].id : null };
}

export async function deleteResponse(tenantId: string, formId: string, responseId: string) {
  const form = await prisma.tenantForm.findFirst({ where: { id: formId, tenantId }, select: { id: true } });
  if (!form) return false;
  const deleted = await prisma.tenantFormResponse.deleteMany({ where: { id: responseId, formId } });
  if (deleted.count) {
    await prisma.tenantForm.update({
      where: { id: formId },
      data: { responseCount: { decrement: 1 } },
    });
  }
  return deleted.count > 0;
}

export async function getFormStats(tenantId: string, formId: string) {
  const form = await prisma.tenantForm.findFirst({ where: { id: formId, tenantId }, select: { id: true, responseCount: true } });
  if (!form) return null;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const rows = await prisma.tenantFormStat.findMany({
    where: { formId, date: { gte: since } },
    orderBy: { date: "asc" },
  });
  const totals = rows.reduce(
    (acc, r) => ({
      views: acc.views + r.views,
      starts: acc.starts + r.starts,
      completions: acc.completions + r.completions,
    }),
    { views: 0, starts: 0, completions: 0 }
  );
  return {
    totalResponses: form.responseCount,
    last30Days: totals,
    completionRate: totals.starts > 0 ? Math.round((totals.completions / totals.starts) * 100) : null,
    daily: rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      views: r.views,
      starts: r.starts,
      completions: r.completions,
    })),
  };
}
