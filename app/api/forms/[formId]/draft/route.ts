import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { saveDraft } from "@/lib/forms/service";

export const runtime = "nodejs";

// Autosave target. The builder debounces edits and PUTs the whole definition;
// sanitisation happens in saveDraft. Returns the authoritative savedAt so the
// client can show "Saved" with confidence.
export const PUT = withFormsAuth(async (req, session, params) => {
  const body = (await req.json().catch(() => null)) as { definition?: unknown } | null;
  if (!body || body.definition === undefined) {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }
  const form = await saveDraft(session.tenantId, params.formId, body.definition);
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  return NextResponse.json({ ok: true, savedAt: form.lastEditedAt.toISOString() });
});
