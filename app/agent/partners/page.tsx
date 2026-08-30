import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { requireSession } from "@/lib/session";
import { getAccessScope } from "@/lib/security/access-scope";
import { hasAdminPowers } from "@/lib/agent-session";
import { resolveAgentVisibility } from "@/lib/services/agent";
import {
  getSolicitorDirectoryForAgent,
  getSolicitorDirectoryForScope,
} from "@/lib/services/solicitors";
import type { SolicitorFirmWithStats } from "@/lib/services/solicitors";
import {
  getBrokerDirectoryForAgent,
  getBrokerDirectoryForScope,
} from "@/lib/services/brokers";
import type { BrokerFirmWithStats } from "@/lib/services/brokers";
import {
  getSolicitorExchangeStats,
  getSolicitorExchangeStatsForScope,
  getReferralStats,
  getReferralStatsForScope,
  getBrokerReferralStats,
  getBrokerReferralStatsForScope,
} from "@/lib/services/analytics";
import type { SolicitorExchangeStat, ReferralStat, BrokerReferralStat } from "@/lib/services/analytics";
import { Buildings } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { RecommendedSolicitorsSettings } from "@/components/agent/RecommendedSolicitorsSettings";
import { PreferredBrokerSettings } from "@/components/agent/PreferredBrokerSettings";
import { PartnersDirectory } from "@/components/agent/PartnersDirectory";
import type { DirectoryFirm, FirmIntel } from "@/components/agent/PartnersDirectory";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/** Attach per-firm intelligence to the raw directory rows. */
function buildDirectories(
  solicitorFirms: SolicitorFirmWithStats[],
  brokerFirms: BrokerFirmWithStats[],
  exchangeStats: SolicitorExchangeStat[],
  solicitorReferrals: ReferralStat[],
  brokerReferrals: BrokerReferralStat[],
): { solicitor: DirectoryFirm[]; broker: DirectoryFirm[] } {
  const exchangeByFirm = new Map(exchangeStats.map((s) => [s.firmId, s]));
  const solicitorIncomeByFirm = new Map(solicitorReferrals.map((s) => [s.firmId, s]));
  const brokerIncomeByFirm = new Map(brokerReferrals.map((s) => [s.firmId, s]));

  const solicitorIntel = (firmId: string): FirmIntel => {
    const ex = exchangeByFirm.get(firmId);
    const inc = solicitorIncomeByFirm.get(firmId);
    return {
      avgDaysToExchange: ex && ex.exchangeCount > 0 ? ex.avgDaysToExchange : null,
      income: inc
        ? { receivedPence: inc.feeReceivedPence, pendingPence: inc.feeExpectedPence - inc.feeReceivedPence, pendingCount: inc.pendingCount }
        : null,
    };
  };
  const brokerIntel = (firmId: string): FirmIntel => {
    const inc = brokerIncomeByFirm.get(firmId);
    return {
      avgDaysToExchange: null,
      income: inc
        ? { receivedPence: inc.feeReceivedPence, pendingPence: inc.feeExpectedPence - inc.feeReceivedPence, pendingCount: inc.pendingCount }
        : null,
    };
  };

  return {
    solicitor: solicitorFirms.map((f) => ({ ...f, intel: solicitorIntel(f.id) })),
    broker: brokerFirms.map((f) => ({ ...f, intel: brokerIntel(f.id) })),
  };
}

export default async function AgentPartnersPage() {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const isAgent = scope.kind === "agency";
  const isDirector = session.user.role === "director";

  // Internal staff (sales_progressor / admin / superadmin) — access-scope aware,
  // cross-agency for admin powers, own assigned files for a plain progressor.
  // Referral income (commercial data) follows hasAdminPowers: shown to admin /
  // superadmin and the hybrid founder account, hidden from a plain progressor.
  if (!isAgent) {
    const showIncome = hasAdminPowers(session);
    const [firms, brokerFirms, exchangeStats, solicitorReferrals, brokerReferrals] = await Promise.all([
      getSolicitorDirectoryForScope(scope),
      getBrokerDirectoryForScope(scope),
      getSolicitorExchangeStatsForScope(scope).catch(() => []),
      showIncome ? getReferralStatsForScope(scope).catch(() => []) : Promise.resolve([]),
      showIncome ? getBrokerReferralStatsForScope(scope).catch(() => []) : Promise.resolve([]),
    ]);
    const { solicitor, broker } = buildDirectories(firms, brokerFirms, exchangeStats, solicitorReferrals, brokerReferrals);
    const empty = solicitor.length === 0 && broker.length === 0;

    return (
      <>
        <PageHeader
          title="Partners"
          subtitle={scope.kind === "all" ? "Solicitors and brokers across every file on the platform." : "Solicitors and brokers on the files assigned to you."}
        />
        <div className="px-4 md:px-8 py-2 md:py-4 space-y-4">
          {empty ? (
            <EmptyDirectory internal />
          ) : (
            <PartnersDirectory solicitorFirms={solicitor} brokerFirms={broker} showIncome={showIncome} />
          )}
        </div>
      </>
    );
  }

  // Agent path (director / negotiator) — agency-scoped, director-only settings.
  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const [
    firms,
    brokerFirms,
    exchangeStats,
    solicitorReferrals,
    brokerReferrals,
    recommendedSolicitors,
    allSolicitorFirms,
    preferredBrokerRow,
  ] = await Promise.all([
    getSolicitorDirectoryForAgent(vis),
    getBrokerDirectoryForAgent(vis),
    getSolicitorExchangeStats(vis).catch(() => []),
    // Referral income is commercial data — directors only.
    isDirector ? getReferralStats(session.user.agencyId).catch(() => []) : Promise.resolve([]),
    isDirector ? getBrokerReferralStats(session.user.agencyId).catch(() => []) : Promise.resolve([]),
    isDirector
      ? db.agencyRecommendedSolicitor.findMany({
          where: { agencyId: session.user.agencyId },
          orderBy: { solicitorFirm: { name: "asc" } },
          select: {
            id: true,
            solicitorFirmId: true,
            defaultReferralFeePence: true,
            solicitorFirm: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    isDirector
      ? prisma.solicitorFirm.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
    isDirector
      ? Promise.resolve().then(() =>
          prisma.agencyPreferredBroker.findUnique({
            where: { agencyId: session.user.agencyId },
            select: {
              defaultReferralFeePence: true,
              brokerFirm: {
                select: {
                  id: true,
                  name: true,
                  website: true,
                  handlers: { take: 1, select: { id: true, name: true, phone: true, email: true } },
                },
              },
            },
          })
        ).catch(() => null)
      : Promise.resolve(null),
  ]);

  const { solicitor, broker } = buildDirectories(firms, brokerFirms, exchangeStats, solicitorReferrals, brokerReferrals);
  const directoryEmpty = solicitor.length === 0 && broker.length === 0;

  const preferredBroker = preferredBrokerRow?.brokerFirm
    ? {
        firmId: preferredBrokerRow.brokerFirm.id,
        firmName: preferredBrokerRow.brokerFirm.name,
        firmWebsite: preferredBrokerRow.brokerFirm.website ?? null,
        contactName: preferredBrokerRow.brokerFirm.handlers[0]?.name ?? null,
        contactPhone: preferredBrokerRow.brokerFirm.handlers[0]?.phone ?? null,
        contactEmail: preferredBrokerRow.brokerFirm.handlers[0]?.email ?? null,
        defaultReferralFeePence: preferredBrokerRow.defaultReferralFeePence ?? null,
      }
    : null;

  return (
    <>
      <PageHeader title="Partners" subtitle="Solicitors, brokers, and preferred professional partners." />
      <div className="px-4 md:px-8 py-2 md:py-4 space-y-4">

        {/* Director-only settings — preferred broker + recommended solicitors (side by side) */}
        {isDirector && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* Preferred mortgage broker */}
            <Card padding="lg">
              <div className="mb-5">
                <h2 className="text-sm font-bold text-slate-900/80 mb-1">Preferred mortgage broker</h2>
                <p className="text-xs text-slate-900/50">
                  Set one preferred broker for your agency. They&apos;ll be pre-filled on new sales and their referral fee included in your income analytics.
                </p>
              </div>
              <PreferredBrokerSettings
                initialBroker={preferredBroker}
              />
            </Card>

            {/* Recommended solicitors. overflow-visible + raised stacking so the
                firm-search dropdown can spill past the card edge and sit above
                the cards below, instead of being clipped by Card's overflow-hidden. */}
            <Card padding="lg" className="relative z-30" style={{ overflow: "visible" }}>
              <div className="mb-5">
                <h2 className="text-sm font-bold text-slate-900/80 mb-1">Recommended solicitors</h2>
                <p className="text-xs text-slate-900/50">
                  Mark solicitor firms you recommend to clients and set a default referral fee. These feed into your referral income analytics.
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-900/40">
                  <span>Toggle = recommended</span>
                  <span>·</span>
                  <span>Fee field = default referral fee (£)</span>
                </div>
              </div>
              <RecommendedSolicitorsSettings
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                initialRecommended={(recommendedSolicitors as any[]).map((r) => ({
                  id: r.id,
                  firmId: r.solicitorFirmId,
                  firmName: r.solicitorFirm.name,
                  defaultReferralFeePence: r.defaultReferralFeePence,
                }))}
                allFirms={allSolicitorFirms}
              />
            </Card>
          </div>
        )}

        {/* Directory */}
        {directoryEmpty ? (
          <EmptyDirectory />
        ) : (
          <PartnersDirectory solicitorFirms={solicitor} brokerFirms={broker} showIncome={isDirector} />
        )}
      </div>
    </>
  );
}

function EmptyDirectory({ internal = false }: { internal?: boolean }) {
  return (
    <div
      className="agent-glass-strong agent-empty-card"
      style={{ padding: "48px 32px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}
    >
      <Buildings weight="regular" style={{ width: 32, height: 32, color: "var(--agent-text-muted)", margin: "0 auto 12px", opacity: 0.5 }} />
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
        No partners yet
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-muted)" }}>
        {internal
          ? "Solicitors and brokers appear here once they're on a file in your view."
          : "Solicitors and brokers appear here once they're on one of your files."}
      </p>
    </div>
  );
}
