import { redirect } from "next/navigation";
import { getFormsSession } from "@/lib/forms/auth";
import { TemplateGallery } from "@/components/boardwalk/TemplateGallery";

export const dynamic = "force-dynamic";

export const metadata = { title: "New form" };

export default async function NewFormPage() {
  const session = await getFormsSession();
  if (!session) redirect("/boardwalk/login");
  return <TemplateGallery tenantName={session.tenantName} />;
}
