import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { requireSession } from "@/lib/session";
import { resolveAgentVisibility } from "@/lib/services/agent";
import { getSolicitorDirectoryForAgent } from "@/lib/services/solicitors";
import { getBrokerDirectoryForAgent } from "@/lib/services/brokers";
import {
  getSolicitorExchangeStats,
  getReferralStats,
  getBrokerReferralStats,
} from "@/lib/services/analytics";
import { Buildings } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { RecommendedSolicitorsSettings } from "@/components/agent/RecommendedSolicitorsSettings";
import { PreferredBrokerSettings } from "@/components/agent/PreferredBrokerSettings";
import { PartnersDirectory } from "@/components/agent/PartnersDirectory";
import type { DirectoryFirm, FirmIntel } from "@/components/agent/PartnersDirectory";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export default async function AgentPartnersPage() {
  const session = await requireSession();
  const isDirector = session.user.role === "director";
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

  // Index the intelligence by firm id so each card can pull its own numbers.
  const exchangeByFirm = new Map(exchangeStats.map((s) => [s.firmId, s]));
  const solicitorIncomeByFirm = new Map(solicitorReferrals.map((s) => [s.firmId, s]));
  const brokerIncomeByFirm = new Map(brokerReferrals.map((s) => [s.firmId, s]));

  function solicitorIntel(firmId: string): FirmIntel {
    const ex = exchangeByFirm.get(firmId);
    const inc = solicitorIncomeByFirm.get(firmId);
    return {
      avgDaysToExchange: ex && ex.exchangeCount > 0 ? ex.avgDaysToExchange : null,
      income: inc
        ? { receivedPence: inc.feeReceivedPence, pendingPence: inc.feeExpectedPence - inc.feeReceivedPence, pendingCount: inc.pendingCount }
        : null,
    };
  }

  function brokerIntel(firmId: string): FirmIntel {
    const inc = brokerIncomeByFirm.get(firmId);
    return {
      avgDaysToExchange: null,
      income: inc
        ? { receivedPence: inc.feeReceivedPence, pendingPence: inc.feeExpectedPence - inc.feeReceivedPence, pendingCount: inc.pendingCount }
        : null,
    };
  }

  const solicitorDirectory: DirectoryFirm[] = firms.map((f) => ({ ...f, intel: solicitorIntel(f.id) }));
  const brokerDirectory: DirectoryFirm[] = brokerFirms.map((f) => ({ ...f, intel: brokerIntel(f.id) }));

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

  const directoryEmpty = solicitorDirectory.length === 0 && brokerDirectory.length === 0;

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
          <div
            className="agent-glass-strong agent-empty-card"
            style={{ padding: "48px 32px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}
          >
            <Buildings weight="regular" style={{ width: 32, height: 32, color: "var(--agent-text-muted)", margin: "0 auto 12px", opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              No partners yet
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-muted)" }}>
              Solicitors and brokers appear here once they&apos;re on one of your files.
            </p>
          </div>
        ) : (
          <PartnersDirectory
            solicitorFirms={solicitorDirectory}
            brokerFirms={brokerDirectory}
            showIncome={isDirector}
          />
        )}
      </div>
    </>
  );
}
