import { redirect } from "next/navigation";
import { getFormsSession } from "@/lib/forms/auth";
import { listForms } from "@/lib/forms/service";
import { FORM_TEMPLATES } from "@/lib/forms/templates";
import { FormsDashboard } from "@/components/boardwalk/FormsDashboard";
import { extractFirstName } from "@/lib/contacts/displayName";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your forms" };

export default async function BoardwalkFormsPage() {
  const session = await getFormsSession();
  if (!session) redirect("/boardwalk/login");

  const forms = await listForms(session.tenantId);
  const templates = FORM_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    questionCount: t.questionCount,
  }));

  return <FormsDashboard initialForms={forms} templates={templates} firstName={extractFirstName(session.name)} />;
}
