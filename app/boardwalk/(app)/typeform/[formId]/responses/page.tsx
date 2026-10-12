import { notFound, redirect } from "next/navigation";
import { getFormsSession } from "@/lib/forms/auth";
import { getForm } from "@/lib/forms/service";
import type { FormDefinition } from "@/lib/forms/types";
import { ResponsesClient } from "@/components/boardwalk/responses/ResponsesClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Responses" };

export default async function ResponsesPage({ params }: { params: Promise<{ formId: string }> }) {
  const session = await getFormsSession();
  if (!session) redirect("/boardwalk/login");

  const { formId } = await params;
  const form = await getForm(session.tenantId, formId);
  if (!form) notFound();

  return (
    <ResponsesClient
      formId={form.id}
      title={form.title}
      status={form.status}
      definition={(form.draft ?? form.published) as unknown as FormDefinition}
      responseCount={form.responseCount}
    />
  );
}
