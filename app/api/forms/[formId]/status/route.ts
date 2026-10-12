import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { setFormStatus } from "@/lib/forms/service";
import { validateLogic } from "@/lib/forms/logic";
import type { FormDefinition } from "@/lib/forms/types";
import { getForm } from "@/lib/forms/service";

export const runtime = "nodejs";

const ACTIONS = ["publish", "unpublish", "close", "reopen", "archive", "restore"] as const;
type Action = (typeof ACTIONS)[number];

export const POST = withFormsAuth(async (req, session, params) => {
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (!ACTIONS.includes(body.action as Action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  const action = body.action as Action;

  if (action === "publish") {
    const form = await getForm(session.tenantId, params.formId);
    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
    const def = form.draft as unknown as FormDefinition;
    if (!def.questions.length) {
      return NextResponse.json({ error: "Add at least one question before publishing." }, { status: 400 });
    }
    const errors = validateLogic(def).filter((i) => i.severity === "error");
    if (errors.length) {
      return NextResponse.json(
        { error: "Fix the broken logic before publishing.", issues: errors },
        { status: 400 }
      );
    }
  }

  const form = await setFormStatus(session.tenantId, params.formId, action);
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  return NextResponse.json({ ok: true, status: form.status, publishedAt: form.publishedAt });
});
