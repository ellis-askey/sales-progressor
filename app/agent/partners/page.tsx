import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { requireSession } from "@/lib/session";
import { resolveAgentVisibility } from "@/lib/services/agent";
import { getSolicitorDirectoryForAgent } from "@/lib/services/solicitors";
import type { SolicitorFirmWithStats } from "@/lib/services/solicitors";
import { getBrokerDirectoryForAgent } from "@/lib/services/brokers";
import type { BrokerFirmWithStats } from "@/lib/services/brokers";
import {
  getSolicitorExchangeStats,
  getReferralStats,
  getBrokerReferralStats,
} from "@/lib/services/analytics";
import { Buildings, Scales, Bank, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { RecommendedSolicitorsSettings } from "@/components/agent/RecommendedSolicitorsSettings";
import { PreferredBrokerSettings } from "@/components/agent/PreferredBrokerSettings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

type ReferralIncome = { receivedPence: number; pendingPence: number; pendingCount: number };
type FirmIntel = { avgDaysToExchange: number | null; income: ReferralIncome | null };

function formatGBP(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

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

  const directoryEmpty = firms.length === 0 && brokerFirms.length === 0;

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
          <>
            {/* Conveyancers */}
            {firms.length > 0 && (
              <div className="space-y-3">
                <SectionHeading Icon={Scales} label="Conveyancers" count={firms.length} />
                {firms.map((firm: SolicitorFirmWithStats) => (
                  <SolicitorFirmCard key={firm.id} firm={firm} intel={solicitorIntel(firm.id)} showIncome={isDirector} />
                ))}
              </div>
            )}

            {/* Mortgage brokers */}
            {brokerFirms.length > 0 && (
              <div className="space-y-3">
                <SectionHeading Icon={Bank} label="Mortgage brokers" count={brokerFirms.length} />
                {brokerFirms.map((firm: BrokerFirmWithStats) => (
                  <BrokerFirmCard key={firm.id} firm={firm} intel={brokerIntel(firm.id)} showIncome={isDirector} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function SectionHeading({
  Icon,
  label,
  count,
}: {
  Icon: typeof Scales;
  label: string;
  count: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px" }}>
      <Icon weight="regular" style={{ width: 16, height: 16, color: "var(--agent-text-muted)" }} />
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-secondary)", letterSpacing: "-0.01em" }}>
        {label}
      </h2>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-disabled)", fontVariantNumeric: "tabular-nums" }}>
        {count}
      </span>
    </div>
  );
}

// A small muted pill for a single intelligence figure.
function IntelPill({ label, tone = "muted" }: { label: string; tone?: "muted" | "success" | "warn" }) {
  const color =
    tone === "success" ? "var(--agent-success)" : tone === "warn" ? "#b45309" : "var(--agent-text-muted)";
  const bg =
    tone === "success" ? "var(--agent-success-bg)" : tone === "warn" ? "rgba(180,83,9,0.08)" : "var(--agent-surface-glass)";
  const border =
    tone === "success" ? "var(--agent-success-border)" : tone === "warn" ? "rgba(180,83,9,0.18)" : "var(--agent-border-default)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 7,
      fontSize: 11, fontWeight: 600, color,
      background: bg, border: `1px solid ${border}`,
      fontVariantNumeric: "tabular-nums",
    }}>
      {label}
    </span>
  );
}

function IntelRow({ intel, showIncome }: { intel: FirmIntel; showIncome: boolean }) {
  const hasAvg = intel.avgDaysToExchange != null;
  const hasIncome = showIncome && intel.income != null && (intel.income.receivedPence > 0 || intel.income.pendingPence > 0);
  if (!hasAvg && !hasIncome) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "10px 20px 0" }}>
      {hasAvg && <IntelPill label={`${intel.avgDaysToExchange} days avg to exchange`} />}
      {hasIncome && intel.income!.receivedPence > 0 && (
        <IntelPill label={`${formatGBP(intel.income!.receivedPence)} in`} tone="success" />
      )}
      {hasIncome && intel.income!.pendingPence > 0 && (
        <IntelPill label={`${formatGBP(intel.income!.pendingPence)} due`} tone="warn" />
      )}
    </div>
  );
}

function ActiveBadge({ totalActiveFiles, referralActiveFiles }: { totalActiveFiles: number; referralActiveFiles: number }) {
  if (totalActiveFiles === 0) return null;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, flexShrink: 0,
      padding: "3px 10px", borderRadius: 20,
      color: "var(--agent-success)",
      background: "var(--agent-success-bg)",
      border: "1px solid var(--agent-success-border)",
    }}>
      {totalActiveFiles} active
      {referralActiveFiles > 0
        ? ` · ${referralActiveFiles} referral${referralActiveFiles !== 1 ? "s" : ""}`
        : ` file${totalActiveFiles !== 1 ? "s" : ""}`}
    </span>
  );
}

function ContactFileChips({
  files,
}: {
  files: { id: string; propertyAddress: string; role?: "vendor" | "purchaser"; isReferral: boolean }[];
}) {
  if (files.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
      {files.map((f) => (
        <Link
          key={`${f.id}-${f.role ?? "purchaser"}`}
          href={`/agent/transactions/${f.id}`}
          style={{ textDecoration: "none" }}
        >
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 9px", borderRadius: 6,
            fontSize: 11, color: "var(--agent-text-secondary)",
            background: "var(--agent-surface-glass)",
            border: "1px solid var(--agent-border-default)",
            transition: "background 120ms",
          }}
            className="solicitor-file-chip"
          >
            <span style={{
              width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
              background: f.isReferral ? "#f59e0b" : f.role === "vendor" ? "#a78bfa" : "#60a5fa",
            }} />
            <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {f.propertyAddress}
            </span>
            {f.role && (
              <span style={{ color: "var(--agent-text-disabled)", textTransform: "capitalize" }}>
                ({f.role})
              </span>
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}

function ContactRow({
  contact,
  isLast,
}: {
  contact: { name: string; email: string | null; phone: string | null; activeFiles: { id: string; propertyAddress: string; role?: "vendor" | "purchaser"; isReferral: boolean }[] };
  isLast: boolean;
}) {
  return (
    <div style={{
      padding: "14px 20px",
      borderBottom: isLast ? "none" : "0.5px solid var(--agent-border-default)",
    }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
          {contact.name}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px 12px", marginTop: 3 }}>
          {contact.email && (
            <a href={`mailto:${contact.email}`} style={{ fontSize: 12, color: "var(--agent-info)", textDecoration: "none" }}>
              {contact.email}
            </a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} style={{ fontSize: 12, color: "var(--agent-text-muted)", textDecoration: "none" }}>
              {contact.phone}
            </a>
          )}
          {!contact.email && !contact.phone && (
            <span style={{ fontSize: 12, color: "var(--agent-text-disabled)", fontStyle: "italic" }}>
              No contact details
            </span>
          )}
        </div>
      </div>
      <ContactFileChips files={contact.activeFiles} />
    </div>
  );
}

function FirmHeader({
  name,
  badge,
  website,
}: {
  name: string;
  badge: React.ReactNode;
  website?: string | null;
}) {
  const cleanWebsite = website ? website.replace(/^https?:\/\//, "") : null;
  const href = website ? (website.startsWith("http") ? website : `https://${website}`) : null;
  return (
    <div style={{
      padding: "14px 20px",
      borderBottom: "0.5px solid var(--agent-border-default)",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: "rgba(99,102,241,0.10)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Buildings weight="regular" style={{ width: 15, height: 15, color: "#6366f1" }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </p>
          {href && cleanWebsite && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 1, fontSize: 11, color: "#6366f1", textDecoration: "none", opacity: 0.8 }}
            >
              {cleanWebsite}
              <ArrowSquareOut size={10} weight="bold" />
            </a>
          )}
        </div>
      </div>
      {badge}
    </div>
  );
}

function SolicitorFirmCard({
  firm,
  intel,
  showIncome,
}: {
  firm: SolicitorFirmWithStats;
  intel: FirmIntel;
  showIncome: boolean;
}) {
  return (
    <Card padding="none">
      <FirmHeader
        name={firm.name}
        badge={<ActiveBadge totalActiveFiles={firm.totalActiveFiles} referralActiveFiles={firm.referralActiveFiles} />}
      />
      <IntelRow intel={intel} showIncome={showIncome} />
      {firm.contacts.length === 0 ? (
        <p style={{ margin: 0, padding: "14px 20px", fontSize: 13, color: "var(--agent-text-disabled)", fontStyle: "italic" }}>
          No contacts recorded
        </p>
      ) : (
        <div style={{ marginTop: 4 }}>
          {firm.contacts.map((contact, i) => (
            <ContactRow key={contact.id} contact={contact} isLast={i === firm.contacts.length - 1} />
          ))}
        </div>
      )}
    </Card>
  );
}

function BrokerFirmCard({
  firm,
  intel,
  showIncome,
}: {
  firm: BrokerFirmWithStats;
  intel: FirmIntel;
  showIncome: boolean;
}) {
  return (
    <Card padding="none">
      <FirmHeader
        name={firm.name}
        website={firm.website}
        badge={<ActiveBadge totalActiveFiles={firm.totalActiveFiles} referralActiveFiles={firm.referralActiveFiles} />}
      />
      <IntelRow intel={intel} showIncome={showIncome} />
      {firm.contacts.length === 0 ? (
        <p style={{ margin: 0, padding: "14px 20px", fontSize: 13, color: "var(--agent-text-disabled)", fontStyle: "italic" }}>
          No contacts recorded
        </p>
      ) : (
        <div style={{ marginTop: 4 }}>
          {firm.contacts.map((contact, i) => (
            <ContactRow key={contact.id} contact={contact} isLast={i === firm.contacts.length - 1} />
          ))}
        </div>
      )}
    </Card>
  );
}
