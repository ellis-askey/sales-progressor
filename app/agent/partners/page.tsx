import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { resolveAgentVisibility } from "@/lib/services/agent";
import { getSolicitorDirectoryForAgent } from "@/lib/services/solicitors";
import type { SolicitorFirmWithStats } from "@/lib/services/solicitors";
import { Buildings } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { RecommendedSolicitorsSettings } from "@/components/agent/RecommendedSolicitorsSettings";
import { PreferredBrokerSettings } from "@/components/agent/PreferredBrokerSettings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export default async function AgentPartnersPage() {
  const session = await requireSession();
  const isDirector = session.user.role === "director";
  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);

  const [firms, recommendedSolicitors, allSolicitorFirms, preferredBrokerRow] = await Promise.all([
    getSolicitorDirectoryForAgent(vis),
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

  const totalContacts = firms.reduce((n: number, f: SolicitorFirmWithStats) => n + f.contacts.length, 0);

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
            <div className="glass-card p-6">
              <div className="mb-5">
                <h2 className="text-sm font-bold text-slate-900/80 mb-1">Preferred mortgage broker</h2>
                <p className="text-xs text-slate-900/50">
                  Set one preferred broker for your agency. They&apos;ll be pre-filled on new sales and their referral fee included in your income analytics.
                </p>
              </div>
              <PreferredBrokerSettings
                initialBroker={preferredBroker}
              />
            </div>

            {/* Recommended solicitors */}
            <div className="glass-card p-6">
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
            </div>
          </div>
        )}

        {/* Solicitor directory */}
        {firms.length === 0 ? (
          <div className="glass-card" style={{ padding: "48px 32px", textAlign: "center" }}>
            <Buildings weight="regular" style={{ width: 32, height: 32, color: "var(--agent-text-muted)", margin: "0 auto 12px", opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              No solicitor firms yet
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-muted)" }}>
              Solicitors appear here once assigned to a transaction.
            </p>
          </div>
        ) : (
          firms.map((firm: SolicitorFirmWithStats) => <FirmCard key={firm.id} firm={firm} />)
        )}
      </div>
    </>
  );
}

function StatChip({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
      <span style={{ fontSize: 22, fontWeight: 600, color: "var(--agent-text-primary)", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{label}</span>
    </div>
  );
}

function FirmCard({ firm }: { firm: SolicitorFirmWithStats }) {
  return (
    <div className="glass-card" style={{ overflow: "hidden" }}>
      {/* Firm header */}
      <div style={{
        padding: "14px 20px",
        borderBottom: "0.5px solid var(--agent-border-default)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: "rgba(99,102,241,0.10)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Buildings weight="regular" style={{ width: 15, height: 15, color: "#6366f1" }} />
          </div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>
            {firm.name}
          </p>
        </div>
        {firm.totalActiveFiles > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 600,
            padding: "3px 10px", borderRadius: 20,
            color: "var(--agent-success)",
            background: "var(--agent-success-bg)",
            border: "1px solid var(--agent-success-border)",
          }}>
            {firm.totalActiveFiles} active
            {firm.referralActiveFiles > 0
              ? ` · ${firm.referralActiveFiles} referral${firm.referralActiveFiles !== 1 ? "s" : ""}`
              : ` file${firm.totalActiveFiles !== 1 ? "s" : ""}`}
          </span>
        )}
      </div>

      {/* Contacts */}
      {firm.contacts.length === 0 ? (
        <p style={{ margin: 0, padding: "14px 20px", fontSize: 13, color: "var(--agent-text-disabled)", fontStyle: "italic" }}>
          No contacts recorded
        </p>
      ) : (
        <div>
          {firm.contacts.map((contact, i) => (
            <div key={contact.id} style={{
              padding: "14px 20px",
              borderBottom: i < firm.contacts.length - 1 ? "0.5px solid var(--agent-border-default)" : "none",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                    {contact.name}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px 12px", marginTop: 3 }}>
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        style={{ fontSize: 12, color: "var(--agent-info)", textDecoration: "none" }}
                      >
                        {contact.email}
                      </a>
                    )}
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        style={{ fontSize: 12, color: "var(--agent-text-muted)", textDecoration: "none" }}
                      >
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
              </div>

              {/* Files this contact handles */}
              {contact.activeFiles.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {contact.activeFiles.map((f) => (
                    <Link
                      key={`${f.id}-${f.role}`}
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
                        <span style={{ color: "var(--agent-text-disabled)", textTransform: "capitalize" }}>
                          ({f.role})
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
