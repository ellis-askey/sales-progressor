import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SurveyForm } from "@/components/feedback/SurveyForm";
import { extractFirstName } from "@/lib/contacts/displayName";
import { PageTitle } from "@/components/ui/PageTitle";
import { AuthNoticeShell } from "@/components/ui/AuthNoticeShell";

export const metadata = { title: "Rate your experience | Sales Progressor" };

export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const contact = await prisma.contact.findFirst({
    where: { portalToken: token },
    select: {
      name: true,
      roleType: true,
      transaction: { select: { propertyAddress: true } },
    },
  });

  if (!contact) notFound();

  const roleLabel = contact.roleType === "purchaser" ? "purchase" : "sale";
  const firstName = extractFirstName(contact.name);

  return (
    <AuthNoticeShell maxWidth={480}>
      <PageTitle
        title="How was your experience."
        subtitle={`${firstName}, congratulations on completing your ${roleLabel} at ${contact.transaction.propertyAddress}. It takes less than a minute.`}
        style={{ marginBottom: 22 }}
      />
      <SurveyForm token={token} />
    </AuthNoticeShell>
  );
}
