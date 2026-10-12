import { notFound, redirect } from "next/navigation";
import { getFormsSession } from "@/lib/forms/auth";
import { getForm } from "@/lib/forms/service";
import type { FormDefinition, FormStatus } from "@/lib/forms/types";
import { BuilderApp } from "@/components/boardwalk/builder/BuilderApp";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit form" };

export default async function BuilderPage({ params }: { params: Promise<{ formId: string }> }) {
  const session = await getFormsSession();
  if (!session) redirect("/boardwalk/login");

  const { formId } = await params;
  const form = await getForm(session.tenantId, formId);
  if (!form) notFound();

  return (
    <BuilderApp
      formId={form.id}
      publicId={form.publicId}
      initialStatus={form.status as FormStatus}
      initialDefinition={form.draft as unknown as FormDefinition}
      hasUnpublishedChanges={
        form.published !== null && JSON.stringify(form.draft) !== JSON.stringify(form.published)
      }
      responseCount={form.responseCount}
    />
  );
}
