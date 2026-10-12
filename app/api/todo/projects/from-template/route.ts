import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { createProjectFromBuiltinTemplate, duplicateProject } from "@/lib/todo/service";

export const runtime = "nodejs";

// Instantiate a project from a built-in agency template (templateId) or from
// a saved project template (projectId).
export const POST = withFormsAuth(async (req, session) => {
  const body = await req.json().catch(() => ({}));
  if (typeof body.templateId === "string") {
    const project = await createProjectFromBuiltinTemplate(session.tenantId, session.userId, body.templateId);
    return NextResponse.json({ project }, { status: 201 });
  }
  if (typeof body.projectId === "string") {
    const project = await duplicateProject(session.tenantId, session.userId, body.projectId, {
      fromTemplate: true,
      name: typeof body.name === "string" ? body.name : undefined,
    });
    return NextResponse.json({ project }, { status: 201 });
  }
  return NextResponse.json({ error: "Choose a template." }, { status: 400 });
});
