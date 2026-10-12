import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withFormsAuth } from "@/lib/forms/api";
import { buildResponsesCsv } from "@/lib/forms/csv";
import type { FormDefinition } from "@/lib/forms/types";

export const runtime = "nodejs";

export const GET = withFormsAuth(async (_req, session, params) => {
  const form = await prisma.tenantForm.findFirst({
    where: { id: params.formId, tenantId: session.tenantId },
  });
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const responses = await prisma.tenantFormResponse.findMany({
    where: { formId: form.id },
    orderBy: { submittedAt: "desc" },
    take: 10_000,
  });

  // Export against the definition with the richest question set we have —
  // the draft includes questions that may have been added since publish.
  const def = (form.draft ?? form.published) as unknown as FormDefinition;
  const csv = buildResponsesCsv(def, responses);
  const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "form";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-responses.csv"`,
    },
  });
});
