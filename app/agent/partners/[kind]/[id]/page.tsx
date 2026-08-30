import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getAccessScope } from "@/lib/security/access-scope";
import { hasAdminPowers } from "@/lib/agent-session";
import { resolveAgentVisibility } from "@/lib/services/agent";
import { getSolicitorFirmDetail, getSolicitorFirmDetailForScope } from "@/lib/services/solicitors";
import type { FirmFileRow } from "@/lib/services/solicitors";
import { getBrokerFirmDetail, getBrokerFirmDetailForScope } from "@/lib/services/brokers";
import type { BrokerFirmFileRow } from "@/lib/services/brokers";
import {
  getSolicitorExchangeStats,
  getSolicitorExchangeStatsForScope,
  getReferralStats,
  getReferralStatsForScope,
  getBrokerReferralStats,
  getBrokerReferralStatsForScope,
} from "@/lib/services/analytics";
import { CaretLeft, ArrowSquareOut, Scales, Bank } from "@phosphor-icons/react/dist/ssr";

type FileRow = { id: string; propertyAddress: string; status: string; role?: "vendor" | "purchaser" | "both"; isReferral: boolean; createdAt: Date };

function formatGBP(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  withdrawn: "Withdrawn",
  fallen_through: "Fell through",
};

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

export default async function PartnerFirmDetailPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (kind !== "solicitor" && kind !== "broker") notFound();

  const session = await requireSession();
  const scope = getAccessScope(session);
  const isAgent = scope.kind === "agency";
  // Referral income: agents gate on director; internal staff gate on admin
  // powers (so a plain sales_progressor never sees fees, but admin / superadmin
  // and the hybrid founder account do).
  const showIncome = isAgent ? session.user.role === "director" : hasAdminPowers(session);
  const vis = isAgent ? await resolveAgentVisibility(session.user.id, session.user.agencyId) : null;

  let firmName: string;
  let website: string | null = null;
  let contacts: { id: string; name: string; phone: string | null; email: string | null; secondaryEmail?: string | null }[];
  let files: FileRow[];
  let avgDaysToExchange: number | null = null;
  let exchangeCount = 0;
  let income: { receivedPence: number; pendingPence: number } | null = null;

  if (kind === "solicitor") {
    const [detail, exchangeStats, referrals] = await Promise.all([
      isAgent ? getSolicitorFirmDetail(vis!, id) : getSolicitorFirmDetailForScope(scope, id),
      (isAgent ? getSolicitorExchangeStats(vis!) : getSolicitorExchangeStatsForScope(scope)).catch(() => []),
      showIncome
        ? (isAgent ? getReferralStats(session.user.agencyId) : getReferralStatsForScope(scope)).catch(() => [])
        : Promise.resolve([]),
    ]);
    if (!detail) notFound();
    firmName = detail.name;
    contacts = detail.contacts;
    files = detail.files as FirmFileRow[];
    const ex = exchangeStats.find((s) => s.firmId === id);
    if (ex && ex.exchangeCount > 0) {
      avgDaysToExchange = ex.avgDaysToExchange;
      exchangeCount = ex.exchangeCount;
    }
    const inc = referrals.find((r) => r.firmId === id);
    if (inc) income = { receivedPence: inc.feeReceivedPence, pendingPence: inc.feeExpectedPence - inc.feeReceivedPence };
  } else {
    const [detail, referrals] = await Promise.all([
      isAgent ? getBrokerFirmDetail(vis!, id) : getBrokerFirmDetailForScope(scope, id),
      showIncome
        ? (isAgent ? getBrokerReferralStats(session.user.agencyId) : getBrokerReferralStatsForScope(scope)).catch(() => [])
        : Promise.resolve([]),
    ]);
    if (!detail) notFound();
    firmName = detail.name;
    website = detail.website;
    contacts = detail.contacts;
    files = detail.files as BrokerFirmFileRow[];
    const inc = referrals.find((r) => r.firmId === id);
    if (inc) income = { receivedPence: inc.feeReceivedPence, pendingPence: inc.feeExpectedPence - inc.feeReceivedPence };
  }

  const KindIcon = kind === "solicitor" ? Scales : Bank;
  const activeCount = files.filter((f) => f.status === "active" || f.status === "on_hold").length;
  const cleanWebsite = website ? website.replace(/^https?:\/\//, "") : null;
  const websiteHref = website ? (website.startsWith("http") ? website : `https://${website}`) : null;

  return (
    <div className="px-4 md:px-8 py-4 md:py-6 space-y-5" style={{ maxWidth: 860, margin: "0 auto" }}>
      {/* Back */}
      <Link
        href="/agent/partners"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: "var(--agent-text-muted)", textDecoration: "none" }}
      >
        <CaretLeft size={14} weight="bold" />
        Partners
      </Link>

      {/* Firm header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12, flexShrink: 0,
          background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.16)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <KindIcon weight="regular" style={{ width: 22, height: 22, color: "#6366f1" }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            {firmName}
          </h1>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--agent-text-muted)" }}>
            {kind === "solicitor" ? "Conveyancer" : "Mortgage broker"}
          </p>
          {websiteHref && cleanWebsite && (
            <a
              href={websiteHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 12, color: "#6366f1", textDecoration: "none" }}
            >
              {cleanWebsite}
              <ArrowSquareOut size={11} weight="bold" />
            </a>
          )}
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <StatTile value={String(activeCount)} label="Active files" />
        <StatTile value={String(files.length)} label="Files all time" />
        {kind === "solicitor" && (
          avgDaysToExchange != null ? (
            <StatTile
              value={String(avgDaysToExchange)}
              label="Days avg to exchange"
              sub={`over ${exchangeCount} exchange${exchangeCount !== 1 ? "s" : ""}`}
            />
          ) : (
            <StatTile value="0" label="Exchanges tracked" sub="No exchange history yet" />
          )
        )}
        {showIncome && income && (
          <StatTile
            value={formatGBP(income.receivedPence)}
            label="Referral income in"
            sub={income.pendingPence > 0 ? `${formatGBP(income.pendingPence)} still due` : undefined}
            tone="success"
          />
        )}
      </div>

      {/* Contacts */}
      <section>
        <h2 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--agent-text-secondary)" }}>
          Contacts
        </h2>
        {contacts.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-disabled)", fontStyle: "italic" }}>
            No contacts recorded
          </p>
        ) : (
          <div className="glass-card" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
            {contacts.map((c, i) => (
              <div key={c.id} style={{ padding: "13px 18px", borderBottom: i < contacts.length - 1 ? "0.5px solid var(--agent-border-default)" : "none" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>{c.name}</p>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px 12px", marginTop: 3 }}>
                  {c.email && <a href={`mailto:${c.email}`} style={{ fontSize: 12, color: "var(--agent-info)", textDecoration: "none" }}>{c.email}</a>}
                  {c.phone && <a href={`tel:${c.phone}`} style={{ fontSize: 12, color: "var(--agent-text-muted)", textDecoration: "none" }}>{c.phone}</a>}
                  {c.secondaryEmail && (
                    <span style={{ fontSize: 12, color: "var(--agent-text-disabled)" }}>cc {c.secondaryEmail}</span>
                  )}
                  {!c.email && !c.phone && (
                    <span style={{ fontSize: 12, color: "var(--agent-text-disabled)", fontStyle: "italic" }}>No contact details</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Files */}
      <section>
        <h2 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--agent-text-secondary)" }}>
          Files ({files.length})
        </h2>
        <div className="glass-card" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
          {files.map((f, i) => (
            <Link
              key={f.id}
              href={`/agent/transactions/${f.id}`}
              className="partner-file-row"
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                padding: "13px 18px", textDecoration: "none",
                borderBottom: i < files.length - 1 ? "0.5px solid var(--agent-border-default)" : "none",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.propertyAddress}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, fontSize: 11, color: "var(--agent-text-muted)" }}>
                  <span>{formatDate(f.createdAt)}</span>
                  {f.role && <span style={{ textTransform: "capitalize" }}>· {f.role}</span>}
                  {f.isReferral && <span style={{ color: "#b45309", fontWeight: 600 }}>· Referral</span>}
                </div>
              </div>
              <StatusPill status={f.status} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatTile({ value, label, sub, tone }: { value: string; label: string; sub?: string; tone?: "success" }) {
  return (
    <div className="glass-card" style={{ padding: "14px 16px", borderRadius: "var(--agent-radius-xl)" }}>
      <p style={{
        margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1.1,
        color: tone === "success" ? "var(--agent-success)" : "var(--agent-text-primary)",
      }}>
        {value}
      </p>
      <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>{label}</p>
      {sub && <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-disabled)" }}>{sub}</p>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const isDone = status === "completed";
  const isActive = status === "active" || status === "on_hold";
  const color = isDone ? "var(--agent-success)" : isActive ? "var(--agent-info)" : "var(--agent-text-muted)";
  const bg = isDone ? "var(--agent-success-bg)" : isActive ? "rgba(96,165,250,0.10)" : "var(--agent-surface-glass)";
  const border = isDone ? "var(--agent-success-border)" : isActive ? "rgba(96,165,250,0.22)" : "var(--agent-border-default)";
  return (
    <span style={{
      flexShrink: 0, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
      color, background: bg, border: `1px solid ${border}`,
    }}>
      {statusLabel(status)}
    </span>
  );
}
