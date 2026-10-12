// Legacy route — Forms moved to /boardwalk/forms. See ../../../page.tsx.
import { redirect } from "next/navigation";

export default async function LegacyTypeformResponses({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  redirect(`/boardwalk/forms/${formId}/responses`);
}
