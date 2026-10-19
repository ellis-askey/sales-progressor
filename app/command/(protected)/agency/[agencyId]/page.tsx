import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAgencyFileHeader, getAgencySales, getAgencyEmailLog, getAgencyReachability,
  fmtDate, fmtDateTime, fmtAgo, fmtGBP,
  type AgencyTeamMember, type AgencySaleRow, type AgencyEmailRow, type AgencyEmailSummary,
  type EmailDeliveryState, type AgencyReachability, type UnreachableContact,
} from "@/lib/command/agency-file";
import { ViewAsButton } from "@/components/command/ViewAsButton";

export const dynamic = "force-dynamic";

// The Agency File — the founder's single deep view of one customer agency.
// Tier 1a: header + settings snapshot + team. Sales health (1b), client email
// log (1c) and reachability (1d) land as further sections on this same page.
export default async function AgencyFilePage({
  params,
}: {
  params: Promise<{ agencyId: string }>;
}) {
  const { agencyId } = await params;
  const now = new Date();
  const [data, sales, emails, reach] = await Promise.all([
    getAgencyFileHeader(agencyId),
    getAgencySales(agencyId, now),
    getAgencyEmailLog(agencyId),
    getAgencyReachability(agencyId, now),
  ]);
  if (!data) notFound();
  const s = data.settings;

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <Link href="/command/agencies" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
          ← Agencies
        </Link>
        <div className="flex items-baseline justify-between mt-2 gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold text-neutral-100">
            {data.name}
            {data.isInternal && <span className="ml-2 text-[11px] uppercase tracking-wider text-neutral-500">internal</span>}
            {data.archivedAt && <span className="ml-2 text-[11px] uppercase tracking-wider text-amber-400">archived</span>}
          </h1>
          <div className="flex items-center gap-4">
            <Link href={`/command/revenue/${data.id}`} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Revenue →
            </Link>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          {modeLabel(data.modeProfile)} · {data.activeFileCount} active of {data.totalFileCount} file{data.totalFileCount === 1 ? "" : "s"} · opened {fmtDate(data.createdAt)}
          {data.firstSubmissionAt && <> · first sale {fmtDate(data.firstSubmissionAt)}</>}
        </p>
      </div>

      {/* ── Alerts strip (payment / blocked) ────────────────────── */}
      {(s.newFileCreationBlockedAt || s.paymentFailedAt) && (
        <div className="bg-red-950/40 border border-red-900/60 rounded-xl px-5 py-3 text-sm">
          {s.newFileCreationBlockedAt ? (
            <span className="text-red-300">Blocked from creating new files since {fmtDate(s.newFileCreationBlockedAt)}.</span>
          ) : (
            <span className="text-amber-300">Payment failed {fmtDate(s.paymentFailedAt)}. Not yet blocked.</span>
          )}
        </div>
      )}

      {/* ── Sales with health ───────────────────────────────────── */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          Live sales · {sales.length}
        </h2>
        {sales.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-6">
            <p className="text-sm text-neutral-600">No live sales.</p>
          </div>
        ) : (
          <SalesTable rows={sales} />
        )}
      </section>

      {/* ── Client emails + delivery ────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Client emails</h2>
          <p className="text-[11px] text-neutral-500">
            {emails.totalSent} sent · {emails.delivered} delivered · <span className="text-emerald-400">{emails.opened} opened ({emails.openRatePct}%)</span>
            {emails.bouncedFailed > 0 && <> · <span className="text-red-400">{emails.bouncedFailed} bounced/failed</span></>}
          </p>
        </div>
        {emails.rows.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-6">
            <p className="text-sm text-neutral-600">No emails sent yet.</p>
          </div>
        ) : (
          <EmailTable summary={emails} />
        )}
      </section>

      {/* ── Reachability ────────────────────────────────────────── */}
      {(reach.contacts.length > 0 || reach.pausedFiles.length > 0) && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Reachability</h2>
            <p className="text-[11px] text-neutral-500">
              {reach.bouncedCount > 0 && <span className="text-red-400">{reach.bouncedCount} bounced</span>}
              {reach.bouncedCount > 0 && (reach.unsubscribedCount > 0 || reach.pausedContactCount > 0) && " · "}
              {reach.unsubscribedCount > 0 && <span className="text-amber-400">{reach.unsubscribedCount} unsubscribed</span>}
              {reach.unsubscribedCount > 0 && reach.pausedContactCount > 0 && " · "}
              {reach.pausedContactCount > 0 && <span className="text-neutral-400">{reach.pausedContactCount} paused</span>}
            </p>
          </div>

          {reach.pausedFiles.length > 0 && (
            <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl px-5 py-3 text-xs text-amber-200/90 mb-3">
              Client emails switched off on {reach.pausedFiles.length} live file{reach.pausedFiles.length === 1 ? "" : "s"}:{" "}
              {reach.pausedFiles.slice(0, 6).map((f) => f.propertyAddress).join(" · ")}
              {reach.pausedFiles.length > 6 && ` · +${reach.pausedFiles.length - 6} more`}
            </div>
          )}

          {reach.contacts.length > 0 && <ReachabilityTable rows={reach.contacts} />}
        </section>
      )}

      {/* ── Settings snapshot ───────────────────────────────────── */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">Settings snapshot</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <SettingsGroup title="Automation">
            <Toggle label="Client chase emails" on={s.chaseEmailsEnabled} />
            <Toggle label="Solicitor confirmations" on={s.solicitorChaseEnabled} />
            <Toggle label="Enquiry reply chase" on={s.enquiryReplyChaseEnabled} />
            <Toggle label="Enquiry raise chase" on={s.enquiryRaiseChaseEnabled} />
            <Toggle label="Advisor chase" on={s.advisorChaseEnabled} />
            <Toggle label="Weekly client updates" on={s.weeklyClientUpdatesEnabled} />
            <Toggle label="Chain-neighbour updates" on={s.chainNeighbourUpdatesEnabled} />
            <Row label="Hand back after" value={`${s.clientChaseEscalateAfter} unanswered chases`} />
          </SettingsGroup>

          <SettingsGroup title="Client portal">
            <Toggle label="Key dates card" on={s.showPortalKeyDates} />
            <Toggle label="Costs card" on={s.showPortalCosts} />
            <Toggle label="Progress %" on={s.showPortalProgressPercent} />
            <Toggle label="Welcome sheet" on={s.showPortalWelcomeSheet} />
            <Toggle label="Auto-invite clients on add" on={s.autoInviteClientsOnAdd} />
            <Toggle label="WhatsApp capture" on={s.whatsAppCaptureEnabled} />
            <Toggle label="WhatsApp auto to-dos" on={s.whatsAppTasksEnabled} />
          </SettingsGroup>

          <SettingsGroup title="Branding & sender">
            <Toggle label="Custom logo" on={s.hasLogo} />
            <Toggle label="Custom email theme" on={s.hasEmailTheme} />
            <Row label="Logo tile colour" value={s.logoTileColor ?? "—"} />
            <Row label="Quote sender" value={s.quoteSenderEmail ?? "Sales Progressor fallback"} />
            <Row
              label="Sender verified"
              value={s.quoteSenderEmail ? (s.quoteSenderVerified ? "Verified" : "Not sendable") : "n/a"}
              tone={s.quoteSenderEmail ? (s.quoteSenderVerified ? "good" : "warn") : "muted"}
            />
          </SettingsGroup>

          <SettingsGroup title="Money & billing">
            <Row
              label="Fee tier"
              value={s.feeTier === "legacy"
                ? `Legacy · ${fmtGBP(s.legacyOutsourcedFeePence)} per sale`
                : "Standard sliding scale"}
              tone={s.feeTier === "legacy" ? "warn" : "default"}
            />
            <Row label="Monthly fee target" value={s.monthlyFeeTargetPence != null ? fmtGBP(s.monthlyFeeTargetPence) : "Not set"} />
            <Row label="VAT" value={s.vatRegisteredAt ? `Registered ${fmtDate(s.vatRegisteredAt)}` : "Not registered"} />
            <Row label="Stripe customer" value={s.stripeCustomerId ?? "None"} mono={!!s.stripeCustomerId} />
            <Row
              label="Payment"
              value={s.newFileCreationBlockedAt ? "Blocked" : s.paymentFailedAt ? "Failed" : "Healthy"}
              tone={s.newFileCreationBlockedAt ? "bad" : s.paymentFailedAt ? "warn" : "good"}
            />
          </SettingsGroup>

          <SettingsGroup title="Where they came from">
            <Row label="Source" value={s.signupSource ?? "—"} />
            <Row label="Medium" value={s.signupMedium ?? "—"} />
            <Row label="Campaign" value={s.signupCampaign ?? "—"} />
            <Row label="Tier clicked" value={s.signupTier ?? "—"} />
            <Row label="CTA" value={s.signupCtaLocation ?? "—"} />
            <Row label="Signed up" value={fmtDate(s.signupAt)} />
          </SettingsGroup>
        </div>
      </section>

      {/* ── Team ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          Team · {data.team.length} {data.team.length === 1 ? "person" : "people"}
        </h2>
        {data.team.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-6">
            <p className="text-sm text-neutral-600">No users on this agency.</p>
          </div>
        ) : (
          <TeamTable rows={data.team} now={now} />
        )}
      </section>
    </div>
  );
}

function modeLabel(m: string): string {
  return m === "self_progressed" ? "Self-progressed"
    : m === "progressor_managed" ? "Progressor-managed"
    : "Mixed";
}

function SalesTable({ rows }: { rows: AgencySaleRow[] }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-800/50">
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Property</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Stage</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Progress</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Chasing</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Last worked</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Predicted exchange</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {rows.map((f) => (
            <tr key={f.transactionId} className="hover:bg-neutral-800/50 transition-colors">
              <td className="px-4 py-3 text-xs text-neutral-200">
                {f.propertyAddress}
                {f.onHold && <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-400">on hold</span>}
                <span className="ml-2 text-[10px] text-neutral-600">{f.serviceType === "self_managed" ? "in-house" : "outsourced"}</span>
              </td>
              <td className="px-4 py-3 text-xs text-neutral-300 whitespace-nowrap">{f.stage}</td>
              <td className="px-4 py-3 text-xs whitespace-nowrap">
                <span className="text-neutral-300 tabular-nums">{f.stepsDone}/{f.stepsLive}</span>
                <span className="text-neutral-600"> · {f.percent}%</span>
              </td>
              <td className="px-4 py-3 text-xs whitespace-nowrap">
                <ChaseHealth f={f} />
              </td>
              <td className={`px-4 py-3 text-xs whitespace-nowrap ${f.idleDays != null && f.idleDays >= 14 ? "text-amber-400" : "text-neutral-400"}`}>
                {f.idleDays == null ? "—" : f.idleDays === 0 ? "today" : f.idleDays === 1 ? "yesterday" : `${f.idleDays}d ago`}
              </td>
              <td className={`px-4 py-3 text-right text-xs whitespace-nowrap ${f.isExchangeOverdue ? "text-amber-400" : "text-neutral-400"}`}>
                {f.predictedExchangeDate ? fmtDate(f.predictedExchangeDate) : "—"}
                {f.isExchangeOverdue && <span className="ml-1 text-[10px] uppercase tracking-wider">overdue</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const EMAIL_STATE_META: Record<EmailDeliveryState, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "text-neutral-600" },
  sent: { label: "Sent", cls: "text-neutral-400" },
  delivered: { label: "Delivered", cls: "text-sky-400" },
  opened: { label: "Opened", cls: "text-emerald-400" },
  clicked: { label: "Clicked", cls: "text-emerald-300" },
  bounced: { label: "Bounced", cls: "text-red-400" },
  failed: { label: "Failed", cls: "text-red-400" },
};

function EmailTable({ summary }: { summary: AgencyEmailSummary }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-800/50">
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Sent</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">To</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Subject</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Property</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {summary.rows.map((m) => (
            <tr key={m.id} className="hover:bg-neutral-800/50 transition-colors">
              <td className="px-4 py-3 text-xs text-neutral-400 whitespace-nowrap">{fmtDateTime(m.sentAt)}</td>
              <td className="px-4 py-3 text-xs text-neutral-300">
                {m.recipientName ?? "—"}
                {m.recipientEmail && <div className="text-[10px] text-neutral-600 font-mono">{m.recipientEmail}</div>}
              </td>
              <td className="px-4 py-3 text-xs text-neutral-300 max-w-[260px] truncate">
                {m.subject ?? "—"}
                {m.isAutomated && <span className="ml-1.5 text-[9px] uppercase tracking-wider text-neutral-600">auto</span>}
              </td>
              <td className="px-4 py-3 text-xs text-neutral-500 max-w-[180px] truncate">{m.propertyAddress ?? "—"}</td>
              <td className="px-4 py-3 text-xs whitespace-nowrap">
                <EmailState m={m} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {summary.totalSent > summary.rows.length && (
        <p className="px-4 py-2.5 text-[11px] text-neutral-600 border-t border-neutral-800">
          Showing the {summary.rowLimit} most recent of {summary.totalSent}.
        </p>
      )}
    </div>
  );
}

function EmailState({ m }: { m: AgencyEmailRow }) {
  const meta = EMAIL_STATE_META[m.state];
  return (
    <span className={meta.cls} title={m.failureReason ?? undefined}>
      {meta.label}
      {(m.state === "bounced" || m.state === "failed") && m.failureReason && (
        <span className="text-neutral-600"> · {m.failureReason.slice(0, 40)}</span>
      )}
    </span>
  );
}

function ChaseHealth({ f }: { f: AgencySaleRow }) {
  if (f.escalatedChases > 0) {
    return <span className="text-red-400">⚠ {f.escalatedChases} escalated{f.maxChaseCount > 0 && <span className="text-neutral-600"> · chased {f.maxChaseCount}×</span>}</span>;
  }
  if (f.overdueChases > 0) {
    return <span className="text-amber-400">{f.overdueChases} overdue{f.maxChaseCount > 0 && <span className="text-neutral-600"> · chased {f.maxChaseCount}×</span>}</span>;
  }
  if (f.pendingChases > 0) {
    return <span className="text-neutral-400">{f.pendingChases} chasing{f.maxChaseCount > 0 && <span className="text-neutral-600"> · {f.maxChaseCount}×</span>}</span>;
  }
  return <span className="text-neutral-700">—</span>;
}

const ISSUE_META: Record<string, { label: string; cls: string }> = {
  bounced: { label: "Bounced", cls: "bg-red-950/60 text-red-300" },
  unsubscribed: { label: "Unsubscribed", cls: "bg-amber-950/60 text-amber-300" },
  paused: { label: "Paused", cls: "bg-neutral-800 text-neutral-400" },
};

function ReachabilityTable({ rows }: { rows: UnreachableContact[] }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-800/50">
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Client</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Property</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Issue</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Since</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {rows.map((c) => (
            <tr key={c.contactId} className="hover:bg-neutral-800/50 transition-colors">
              <td className="px-4 py-3 text-xs text-neutral-200">
                {c.name}
                <span className="ml-2 text-[10px] text-neutral-600">{c.role === "vendor" ? "seller" : c.role === "purchaser" ? "buyer" : c.role}</span>
                {c.email && <div className="text-[10px] text-neutral-600 font-mono">{c.email}</div>}
              </td>
              <td className="px-4 py-3 text-xs text-neutral-400 max-w-[200px] truncate">{c.propertyAddress}</td>
              <td className="px-4 py-3 text-xs whitespace-nowrap">
                <span className="inline-flex gap-1">
                  {c.issues.map((i) => (
                    <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ISSUE_META[i].cls}`}>
                      {ISSUE_META[i].label}
                    </span>
                  ))}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">{fmtDate(c.since)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
      <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Toggle({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-neutral-400">{label}</span>
      <span className={on ? "text-emerald-400 font-medium" : "text-neutral-600"}>
        {on ? "On" : "Off"}
      </span>
    </div>
  );
}

function Row({
  label, value, tone = "default", mono = false,
}: {
  label: string; value: string;
  tone?: "default" | "good" | "warn" | "bad" | "muted";
  mono?: boolean;
}) {
  const cls =
    tone === "good" ? "text-emerald-400" :
    tone === "warn" ? "text-amber-400" :
    tone === "bad" ? "text-red-400" :
    tone === "muted" ? "text-neutral-600" :
    "text-neutral-300";
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-neutral-400 flex-shrink-0">{label}</span>
      <span className={`${cls} ${mono ? "font-mono text-[10px]" : ""} text-right truncate`}>{value}</span>
    </div>
  );
}

function TeamTable({ rows, now }: { rows: AgencyTeamMember[]; now: Date }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-800/50">
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Name</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Email</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Role</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Last login</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Status</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {rows.map((u) => (
            <tr key={u.id} className="hover:bg-neutral-800/50 transition-colors">
              <td className="px-4 py-3 text-xs text-neutral-200">
                {u.name}
                {u.canViewAllFiles && <span className="ml-2 text-[10px] text-neutral-500">sees all</span>}
              </td>
              <td className="px-4 py-3 text-xs text-neutral-400 font-mono text-[11px]">{u.email}</td>
              <td className="px-4 py-3 text-xs text-neutral-400">{roleLabel(u.role)}</td>
              <td className="px-4 py-3 text-xs text-neutral-400 whitespace-nowrap">{fmtAgo(u.lastLoginAt, now)}</td>
              <td className="px-4 py-3 text-xs whitespace-nowrap">
                {u.deactivatedAt
                  ? <span className="text-neutral-600">Deactivated</span>
                  : <span className="text-emerald-400">Active</span>}
              </td>
              <td className="px-4 py-3 text-xs text-right whitespace-nowrap">
                {!u.deactivatedAt && ["director", "negotiator", "viewer"].includes(u.role) && (
                  <ViewAsButton userId={u.id} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function roleLabel(r: string): string {
  return r === "director" ? "Director"
    : r === "negotiator" ? "Negotiator"
    : r === "sales_progressor" ? "Progressor"
    : r === "admin" ? "Admin"
    : r === "superadmin" ? "Superadmin"
    : r === "viewer" ? "Viewer"
    : r;
}
