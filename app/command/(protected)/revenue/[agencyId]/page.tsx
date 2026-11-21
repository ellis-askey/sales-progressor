import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgencyRevenueDetail, formatShortDate, formatMonthLabel } from "@/lib/command/revenue";
import { AgencyBillingPanel } from "@/components/command/agency/AgencyBillingPanel";

export const dynamic = "force-dynamic";

// One agency's revenue drill-down. The revenue experience itself now lives in
// the shared <AgencyBillingPanel> (also rendered inside the Agency Account's
// Billing tab) so there is a single source of this UI. This route stays live —
// its deep link and header chrome are unchanged.
export default async function AgencyRevenueDrillPage({
  params,
}: {
  params: Promise<{ agencyId: string }>;
}) {
  const { agencyId } = await params;
  const data = await getAgencyRevenueDetail(agencyId);
  if (!data) notFound();

  const monthLabel = formatMonthLabel(data.monthStart);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/command/money?tab=revenue" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
          ← Revenue
        </Link>
        <div className="flex items-baseline justify-between mt-2 gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold text-neutral-100">{data.agency.name}</h1>
          <div className="flex items-center gap-4">
            <Link href={`/command/agency/${agencyId}?tab=billing`} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Agency file →
            </Link>
            <p className="text-xs text-neutral-500">{monthLabel} · as of {formatShortDate(data.asOf)}</p>
          </div>
        </div>
      </div>

      <AgencyBillingPanel data={data} />
    </div>
  );
}
