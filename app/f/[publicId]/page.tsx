// Public form page. Serves the PUBLISHED definition to respondents. With
// ?preview=1 and a valid Boardwalk session for the owning tenant, serves the
// DRAFT instead — that's "preview without publishing" for the builder, and it
// is never available to anonymous visitors.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPublicForm } from "@/lib/forms/service";
import { getFormsSession } from "@/lib/forms/auth";
import type { FormDefinition } from "@/lib/forms/types";
import { FormRunner, type RunnerForm } from "@/components/boardwalk/runner/FormRunner";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const form = await prisma.tenantForm.findUnique({
    where: { publicId },
    select: { title: true, status: true },
  });
  return {
    title: form && form.status !== "archived" ? form.title : "Form",
    referrer: "no-referrer",
  };
}

export default async function PublicFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { publicId } = await params;
  const { preview } = await searchParams;

  // Draft preview for the signed-in owning tenant only
  if (preview === "1") {
    const session = await getFormsSession();
    if (session) {
      const form = await prisma.tenantForm.findFirst({
        where: { publicId, tenantId: session.tenantId },
        include: { tenant: { select: { name: true } } },
      });
      if (form) {
        const def = form.draft as unknown as FormDefinition;
        const runnerForm: RunnerForm = {
          publicId: form.publicId,
          title: form.title,
          welcome: def.welcome,
          questions: def.questions,
          endings: def.endings,
          theme: def.theme,
          hiddenFields: def.settings.hiddenFields,
          tenantName: form.tenant.name,
        };
        return <FormRunner form={runnerForm} mode="preview" />;
      }
    }
  }

  const result = await getPublicForm(publicId);
  if (result.state === "not_found") notFound();

  if (result.state === "closed") {
    const theme = result.theme;
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: theme?.backgroundColor ?? "#faf8f4",
          color: theme?.textColor ?? "#1c2420",
          fontFamily: "var(--font-bw-sans), system-ui, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 650, margin: "0 0 10px" }}>{result.title}</h1>
          <p style={{ fontSize: 16, opacity: 0.7, margin: 0, maxWidth: 440 }}>{result.message}</p>
        </div>
      </main>
    );
  }

  return <FormRunner form={result.form} mode="live" />;
}
