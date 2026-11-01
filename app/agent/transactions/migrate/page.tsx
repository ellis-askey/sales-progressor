import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { MigrateSaleFlow } from "@/components/transactions-v2/MigrateSaleFlow";
import { canMigrateSale } from "@/lib/agency-features/migrate-sale";
import { listAssignableAgentsForAgency } from "@/lib/services/agency-team";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export default async function MigrateSalePage() {
  const session = await requireSession();

  // Server-side agency gate (Law 7). 404 (not 403) keeps the route
  // undiscoverable for everyone else, matching the project's posture for
  // allowlist-gated surfaces. The nav entry and the action enforce the SAME
  // helper so they can't drift.
  if (!canMigrateSale(session)) notFound();

  const isDirector = session.user.role === "director";

  const [recommendedFirms, preferredBrokerRow, assignableAgents, milestoneDefs] = await Promise.all([
    Promise.resolve()
      .then(() => db.agencyRecommendedSolicitor?.findMany({ where: { agencyId: session.user.agencyId }, select: { solicitorFirmId: true, defaultReferralFeePence: true } }) ?? Promise.resolve([]))
      .then((rows: { solicitorFirmId: string; defaultReferralFeePence: number | null }[]) => rows.map((r) => ({ id: r.solicitorFirmId, defaultReferralFeePence: r.defaultReferralFeePence })))
      .catch(() => []),
    prisma.agencyPreferredBroker
      .findUnique({
        where: { agencyId: session.user.agencyId },
        select: {
          defaultReferralFeePence: true,
          brokerFirm: { select: { id: true, name: true, handlers: { take: 1, select: { id: true, name: true, phone: true, email: true } } } },
        },
      })
      .catch(() => null),
    isDirector && session.user.agencyId
      ? listAssignableAgentsForAgency(session.user.agencyId).catch(() => [])
      : Promise.resolve([] as { id: string; name: string; role: string }[]),
    prisma.milestoneDefinition
      .findMany({ select: { id: true, code: true, name: true, side: true, orderIndex: true }, orderBy: { orderIndex: "asc" } })
      .catch(() => []),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brokerRow = preferredBrokerRow as any;
  const preferredBroker = brokerRow?.brokerFirm
    ? {
        firmId: brokerRow.brokerFirm.id,
        firmName: brokerRow.brokerFirm.name,
        contactId: brokerRow.brokerFirm.handlers?.[0]?.id ?? null,
        contactName: brokerRow.brokerFirm.handlers?.[0]?.name ?? null,
        phone: brokerRow.brokerFirm.handlers?.[0]?.phone ?? null,
        email: brokerRow.brokerFirm.handlers?.[0]?.email ?? null,
      }
    : null;

  return (
    <>
      <PageHeader
        title="Migrate a sale"
        subtitle="Bring an existing sale onto the platform. Drop in the memo of sale, confirm the details, and mark what's already been done, all without messaging anyone."
      />
      <div className="px-4 md:px-8 pt-2 pb-8">
        <MigrateSaleFlow
          recommendedFirms={recommendedFirms}
          preferredBroker={preferredBroker}
          preferredBrokerDefaultFee={brokerRow?.defaultReferralFeePence ?? null}
          milestoneDefs={milestoneDefs as { id: string; code: string; name: string; side: "vendor" | "purchaser"; orderIndex: number }[]}
          isDirector={isDirector}
          assignableAgents={assignableAgents as { id: string; name: string; role: string }[]}
        />
      </div>
    </>
  );
}
