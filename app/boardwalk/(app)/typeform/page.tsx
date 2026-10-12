import { redirect } from "next/navigation";
import { getFormsSession } from "@/lib/forms/auth";
import { listForms } from "@/lib/forms/service";
import { FormsDashboard } from "@/components/boardwalk/FormsDashboard";
import { extractFirstName } from "@/lib/contacts/displayName";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your forms" };

export default async function BoardwalkFormsPage() {
  const session = await getFormsSession();
  if (!session) redirect("/boardwalk/login");

  const forms = await listForms(session.tenantId);

  return <FormsDashboard initialForms={forms} firstName={extractFirstName(session.name)} />;
}
