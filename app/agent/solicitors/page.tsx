import Link from "next/link";
import { requireSession } from "@/lib/session";
import { resolveAgentVisibility } from "@/lib/services/agent";
import { getSolicitorDirectoryForAgent } from "@/lib/services/solicitors";
import type { SolicitorFirmWithStats } from "@/lib/services/solicitors";
import { Buildings } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { RecommendedSolicitorsSettings } from "@/components/agent/RecommendedSolicitorsSettings";

export default async function AgentSolicitorsPage() {
  const session = await requireSession();
  const isDirector = session.user.role === "director";
  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);

  const [firms, recommendedSolicitors, allFirms] = await Promise.all([
    getSolicitorDirectoryForAgent(vis),
    isDirector
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (prisma as any).agencyRecommendedSolicitor.findMany({
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
  ]);

  const totalContacts = firms.reduce((n, f) => n + f.contacts.length, 0);

  return (
    <>
      {/* Header */}
      <div style={{
        background: "rgba(255,255,255,0.52)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        borderBottom: "0.5px solid rgba(255,255,255,0.70)",
        boxShadow: "0 4px 24px rgba(255,138,101,0.07), 0 1px 0 rgba(255,255,255,0.80) inset",
        position: "relative",
        overflow: "hidden",
      }}>
        <div aria-hidden="true" style={{ position: "absolute", top: -60, right: -40, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,138,101,0.13) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "absolute", bottom: -40, left: 60, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,220,100,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div className="relative px-4 pt-6 pb-7 md:px-8 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="agent-eyebrow" style={{ marginBottom: 12 }}>{session.user.firmName ?? "Agent Portal"}</p>
            <h1 style={{ margin: 0, fontSize: "var(--agent-text-h1)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>
              Solicitors
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: "var(--agent-text-body-sm)", color: "var(--agent-text-tertiary)" }}>
              Firms and contacts across your{vis.seeAll ? "" : " own"} files.
            </p>
          </div>

          {firms.length > 0 && (
            <div className="flex items-center gap-3 md:gap-7 flex-shrink-0">
              <StatChip value={firms.length} label="firms" />
              <StatChip value={totalContacts} label="contacts" />
            </div>
          )}
        </div>
      </div>

      <div className="px-4 md:px-8 py-5 md:py-7 space-y-4">

        {/* Recommended solicitors — directors only */}
        {isDirector && (
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
              allFirms={allFirms}
            />
          </div>
        )}

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
          firms.map((firm) => <FirmCard key={firm.id} firm={firm} />)
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
        borderBottom: "0.5px solid rgba(255,255,255,0.40)",
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
            {firm.totalActiveFiles} active file{firm.totalActiveFiles !== 1 ? "s" : ""}
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
              borderBottom: i < firm.contacts.length - 1 ? "0.5px solid rgba(255,255,255,0.25)" : "none",
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
                        background: "rgba(255,255,255,0.45)",
                        border: "1px solid rgba(255,255,255,0.50)",
                        transition: "background 120ms",
                      }}
                        className="solicitor-file-chip"
                      >
                        <span style={{
                          width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                          background: f.role === "vendor" ? "#a78bfa" : "#60a5fa",
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
