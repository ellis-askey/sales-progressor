import { notFound } from "next/navigation";
import { getPortalData, logPortalView } from "@/lib/services/portal";
import { PortalShell } from "@/components/portal/PortalShell";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let data: Awaited<ReturnType<typeof getPortalData>>;
  try {
    data = await getPortalData(token);
  } catch (err) {
    console.error("[Portal] getPortalData threw:", err);
    notFound();
  }

  if (!data) {
    console.error("[Portal] no data for token:", token);
    notFound();
  }

  const { contact, transaction } = data;

  // Log portal view (fire-and-forget — never blocks render)
  logPortalView(token).catch(() => {});

  return (
    <PortalShell
      token={token}
      contactName={contact.name}
      roleType={contact.roleType}
      propertyAddress={transaction.propertyAddress}
      agencyName={transaction.agencyName}
    >
      {children}
    </PortalShell>
  );
}
