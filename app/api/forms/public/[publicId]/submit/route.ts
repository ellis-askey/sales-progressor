import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, formsBaseUrl } from "@/lib/forms/api";
import { checkFormsSubmitLimit, rateLimitJson } from "@/lib/ratelimit";
import { getPublicForm, createResponse } from "@/lib/forms/service";
import { validateSubmission } from "@/lib/forms/validate";
import { sendRespondentConfirmation, sendSubmissionNotification } from "@/lib/forms/notify";
import type { FormDefinition, ResponseMeta } from "@/lib/forms/types";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 300_000;

// Public submission endpoint. Defence layers, in order: rate limit by
// IP+form, body-size cap, honeypot, open-state re-check, full server-side
// validation against the PUBLISHED definition (the client payload is never
// trusted — answers off the logic path are dropped, required is re-checked).
export async function POST(req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await ctx.params;

  const limit = await checkFormsSubmitLimit(clientIp(req), publicId);
  if (!limit.success) return NextResponse.json(rateLimitJson(limit), { status: 429 });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Submission is too large." }, { status: 413 });
  }
  let body: {
    answers?: unknown;
    hidden?: Record<string, string>;
    durationSeconds?: number;
    website?: string; // honeypot — real respondents never see this field
    uploadIds?: string[];
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  // Honeypot: silently accept so bots think they succeeded, store nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const state = await getPublicForm(publicId);
  if (state.state === "not_found") {
    return NextResponse.json({ error: "This form is no longer available." }, { status: 404 });
  }
  if (state.state === "closed") {
    return NextResponse.json({ error: state.message }, { status: 410 });
  }

  const formRow = await prisma.tenantForm.findUnique({
    where: { publicId },
    include: { tenant: { select: { name: true } } },
  });
  if (!formRow || !formRow.published) {
    return NextResponse.json({ error: "This form is no longer available." }, { status: 404 });
  }
  const def = formRow.published as unknown as FormDefinition;

  const result = validateSubmission(def, body.answers);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Some answers need another look.", failures: result.failures },
      { status: 422 }
    );
  }

  // Hidden fields: only the configured keys, values capped.
  const hidden: Record<string, string> = {};
  for (const key of def.settings.hiddenFields) {
    const v = body.hidden?.[key];
    if (typeof v === "string" && v) hidden[key] = v.slice(0, 500);
  }

  const meta: ResponseMeta = {
    durationSeconds:
      typeof body.durationSeconds === "number" && body.durationSeconds >= 0
        ? Math.min(Math.round(body.durationSeconds), 60 * 60 * 24)
        : undefined,
    endingId: result.endingId,
    hidden: Object.keys(hidden).length ? hidden : undefined,
  };

  const uploadIds = (Array.isArray(body.uploadIds) ? body.uploadIds : [])
    .filter((id): id is string => typeof id === "string")
    .slice(0, 30);

  const response = await createResponse(formRow.id, result.cleanAnswers, meta, uploadIds);

  // Notifications are fire-and-forget: a mail failure never fails a submission.
  const notifyWork = Promise.allSettled([
    sendSubmissionNotification({
      tenantName: formRow.tenant.name,
      formTitle: formRow.title,
      formId: formRow.id,
      def,
      answers: result.cleanAnswers,
      baseUrl: formsBaseUrl(),
    }),
    sendRespondentConfirmation({
      tenantName: formRow.tenant.name,
      formTitle: formRow.title,
      def,
      answers: result.cleanAnswers,
    }),
    def.settings.webhookUrl
      ? fetch(def.settings.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            form: { publicId, title: formRow.title },
            responseId: response.id,
            submittedAt: response.submittedAt.toISOString(),
            answers: result.cleanAnswers,
            hidden: meta.hidden ?? {},
          }),
          signal: AbortSignal.timeout(5000),
        })
      : Promise.resolve(),
  ]);
  await notifyWork.then((results) => {
    for (const r of results) {
      if (r.status === "rejected") console.error("[forms] post-submit side effect failed", r.reason);
    }
  });

  return NextResponse.json({ ok: true, endingId: result.endingId });
}
