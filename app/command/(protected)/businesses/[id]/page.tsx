import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { getBusinessDetail, getBusinessWatch, getBusinessFriction, getBusinessSendingIdentity, type BusinessDetail, type SetupCheck, type AgencySenderStatus, type SenderSource } from "@/lib/command/businesses";
import { BusinessStatusPill } from "@/components/command/businesses/StatusPill";
import { ParamTabs } from "@/components/command/ui/primitives";
import { eventLabel } from "@/lib/command/event-labels";
import { formatGBP, formatShortDate } from "@/lib/command/revenue";

export const dynamic = "force-dynamic";

function fmtTs(d: Date): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/London",
  });
}

const ACCOUNT_TABS = [
  { key: "overview", label: "Overview" },
  { key: "team", label: "Team" },
  { key: "clients", label: "Clients" },
  { key: "billing", label: "Billing" },
  { key: "setup", label: "Setup & settings" },
] as const;
type BusinessTab = (typeof ACCOUNT_TABS)[number]["key"];

// Progression-company account — a READ-ONLY tabbed workspace over the existing
// observational business detail. All data comes from the existing
// lib/command/businesses.ts loaders; there are no mutations here (management is
// the business owner's own self-serve surface, untouched). Header + status pill
// stay above the tabs. Loaders are fetched lazily per active tab.
// See docs/active/admin-workspace/04-PROGRESSION-COMPANY-WORKSPACE.md.
export default async function BusinessDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const active: BusinessTab = (ACCOUNT_TABS.some((t) => t.key === tab) ? tab : "overview") as BusinessTab;
  const hrefFor = (key: string) => `/command/businesses/${id}?tab=${key}`;

  const b = await getBusinessDetail(id);
  if (!b) notFound();

  // Lazy per-tab loads (same loaders the single page used, fetched only when the
  // owning tab is open — no slower than before on any tab).
  const needWatch = active === "overview" || active === "team" || active === "setup";
  const [watch, friction, sending] = await Promise.all([
    needWatch ? getBusinessWatch(b) : Promise.resolve(null),
    active === "overview" ? getBusinessFriction(id) : Promise.resolve(null),
    active === "clients" || active === "setup" ? getBusinessSendingIdentity(id) : Promise.resolve(null),
  ]);
  const setupChecks = watch?.setup ?? [];
  const setupDone = setupChecks.filter((c) => c.state === "done").length;
  const feed = watch?.feed ?? [];
  const vitals = watch?.vitals ?? [];
  const frictionSignals = friction ?? [];

  const payment = paymentLine(b);
  const cancellation =
    b.schedule?.cancelAtPeriodEnd && b.schedule.endsAt
      ? `Cancels ${formatShortDate(b.schedule.endsAt)}`
      : b.subscribed
      ? "No cancellation scheduled"
      : "—";
  const senderText = b.senderEmail ?? b.senderDomain ?? "Platform default";

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/command/businesses" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} /> Businesses
      </Link>

      {/* Header (always visible) */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-neutral-100 break-words">{b.name}</h1>
            {b.senderVerified && <BadgeCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" strokeWidth={2} aria-label="Verified sender" />}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {b.shortName ? `“${b.shortName}” · ` : ""}joined {formatShortDate(b.createdAt)}
          </p>
        </div>
        <BusinessStatusPill status={b.status} />
      </div>

      {/* Tabs */}
      <ParamTabs options={[...ACCOUNT_TABS]} active={active} hrefFor={hrefFor} />

      {/* ── Overview ─────────────────────────────────────────────── */}
      {active === "overview" && (
        <div className="space-y-8">
          {/* Fact strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Fact label="Subscription" value={b.subscribed ? "Active" : "None"} tone={b.subscribed ? "ok" : "muted"} />
            <Fact label="Card on file" value={b.hasCard ? "Yes" : "No"} tone={b.hasCard ? "default" : "muted"} />
            <Fact label="Payment" value={payment.text} tone={payment.tone} />
            <Fact label="Cancellation" value={cancellation} />
            <Fact label="Sends as" value={senderText} sub={b.senderVerified ? "verified" : b.senderEmail || b.senderDomain ? "not verified yet" : undefined} />
            <Fact label="Clients · Team" value={`${b.clients.filter((c) => !c.archived).length} · ${b.members.filter((m) => !m.deactivated).length}`} />
          </div>

          {/* Friction — started-but-stalled patterns, spotted before they raise them */}
          <SectionCard
            title="Friction"
            right={
              frictionSignals.length > 0 ? (
                <span className="text-xs text-amber-300">{frictionSignals.length} {frictionSignals.length === 1 ? "signal" : "signals"}</span>
              ) : (
                <span className="text-xs text-neutral-600">clear</span>
              )
            }
          >
            {frictionSignals.length === 0 ? (
              <Empty>Nothing flagged right now. Signals appear when something looks stuck: repeated sign-ins with no actions, sales missing contacts, clients with no sales, drafted-but-unsent chases, files not progressing.</Empty>
            ) : (
              <ul className="space-y-2.5">
                {frictionSignals.map((s) => (
                  <li key={s.key} className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
                    <div className="min-w-0">
                      <p className="text-sm text-amber-200">{s.label}</p>
                      <p className="text-[11px] text-neutral-500">{s.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Activity — what the team is actually doing, from the event rail */}
          <SectionCard title="Activity" right={<span className="text-xs text-neutral-500">latest {feed.length}</span>}>
            {feed.length === 0 ? (
              <Empty>Nothing yet. Events appear here as the team logs in and works files.</Empty>
            ) : (
              <ul className="space-y-2">
                {feed.map((e) => (
                  <li key={e.id} className="flex items-baseline gap-3 text-sm">
                    <span className="text-[11px] tabular-nums text-neutral-600 flex-shrink-0 w-24">{fmtTs(e.occurredAt)}</span>
                    <span className="min-w-0 truncate">
                      <span className="text-neutral-300">{e.memberName}</span>
                      <span className="text-neutral-500"> · {eventLabel(e.type)}</span>
                      {e.address && <span className="text-neutral-600"> · {e.address}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── Team ─────────────────────────────────────────────────── */}
      {active === "team" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title={`Team (${b.members.length})`}>
            {b.members.length === 0 ? (
              <Empty>No members.</Empty>
            ) : (
              <ul className="space-y-2">
                {b.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3">
                    <span className={`text-sm truncate ${m.deactivated ? "text-neutral-600 line-through" : "text-neutral-200"}`}>{m.name}</span>
                    <span className="flex items-center gap-1.5 flex-shrink-0">
                      {m.isOwner && <Tag className="text-blue-300 bg-blue-950/50 border-blue-900/60">Owner</Tag>}
                      {m.deactivated && <Tag className="text-neutral-500 bg-neutral-800/60 border-neutral-700">Deactivated</Tag>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Team vitals">
            {vitals.length === 0 ? (
              <Empty>No members.</Empty>
            ) : (
              <ul className="space-y-3">
                {vitals.map((m) => (
                  <li key={m.id}>
                    <p className={`text-sm ${m.deactivated ? "text-neutral-600 line-through" : "text-neutral-200"}`}>
                      {m.name}
                      {m.isOwner && <span className="ml-1.5 text-[10px] text-blue-300">Owner</span>}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {m.lastActiveAt ? `Last seen ${fmtTs(m.lastActiveAt)}` : "Never seen"}
                      {" · "}
                      {m.actionsThisWeek === 1 ? "1 action this week" : `${m.actionsThisWeek} actions this week`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── Clients ──────────────────────────────────────────────── */}
      {active === "clients" && (
        <div className="space-y-8">
          <SectionCard title={`Client agencies (${b.clients.filter((c) => !c.archived).length})`}>
            {b.clients.length === 0 ? (
              <Empty>No client agencies yet.</Empty>
            ) : (
              <ul className="space-y-2.5">
                {b.clients.map((c) => (
                  <li key={c.agencyId} className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      {/* Contextual link into the agency's own account workspace.
                          Navigation only — the client link never grants file access. */}
                      <Link href={`/command/agency/${c.agencyId}`} className={`block text-sm truncate transition-colors hover:text-blue-300 ${c.archived ? "text-neutral-600" : "text-neutral-200"}`}>
                        {c.agencyName}
                      </Link>
                      <span className="block text-[11px] text-neutral-500 truncate">{c.feeSummary}</span>
                    </span>
                    {c.archived && <Tag className="text-neutral-500 bg-neutral-800/60 border-neutral-700 flex-shrink-0">Archived</Tag>}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Sending identity — per (company × agency) pairing. The finest real
              granularity: who this business sends as for each agency it handles, and
              whether that's a DNS-authenticated domain, a no-DNS single sender, or the
              platform fallback. (There is no per-agent sender — it's shared by domain.) */}
          {sending && (
            <SectionCard
              title="Sending identity, per agency"
              right={
                <span className="text-xs text-neutral-500">
                  {sending.perAgency.filter((a) => !a.archived && a.method !== "platform").length} of {sending.perAgency.filter((a) => !a.archived).length} sending as their own
                </span>
              }
            >
              {sending.perAgency.length === 0 ? (
                <Empty>No client agencies yet.</Empty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-neutral-800">
                        <th className="text-left py-2 pr-3 text-xs font-medium text-neutral-500">Agency</th>
                        <th className="text-left py-2 pr-3 text-xs font-medium text-neutral-500">Sends as</th>
                        <th className="text-left py-2 text-xs font-medium text-neutral-500">How it sends</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/70">
                      {sending.perAgency.map((a) => (
                        <tr key={a.agencyId} className={a.archived ? "opacity-50" : ""}>
                          <td className="py-2.5 pr-3 align-top">
                            <span className="text-neutral-200">{a.agencyName}</span>
                            {a.archived && <span className="ml-1.5 text-[10px] text-neutral-600">archived</span>}
                            {a.agencyProgressorCount > 1 && (
                              <span className="block text-[10px] text-neutral-600">shared agency · {a.agencyProgressorCount} progressors</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 align-top">
                            <span className="block font-mono text-[11px] text-neutral-300 break-all">{a.effectiveSender}</span>
                            <span className="block text-[10px] text-neutral-600">{SOURCE_LABEL[a.source]}</span>
                          </td>
                          <td className="py-2.5 align-top"><SenderMethodBadge a={a} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {sending.businessDnsDomains.length > 0 && (
                <p className="mt-3 text-[11px] text-neutral-600">
                  Company domain{sending.businessDnsDomains.length === 1 ? "" : "s"}:{" "}
                  {sending.businessDnsDomains.map((d) => `${d.domain} ${d.verified ? "✓ authenticated" : "pending"}`).join(" · ")}
                </p>
              )}
              <p className="mt-2 text-[11px] text-neutral-600">
                Sender and DNS are shared by everyone on a domain. There is no per-agent setup; this is the finest level the send pipeline uses.
              </p>
            </SectionCard>
          )}
        </div>
      )}

      {/* ── Billing ──────────────────────────────────────────────── */}
      {active === "billing" && (
        <SectionCard title="Money this month" right={<span className="text-xs text-neutral-500">{formatShortDate(b.summary.monthStart)} onward</span>}>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-2 mb-4">
            <Metric label="Recurring MRR" value={`${formatGBP(b.mrrPence)}/mo`} tone="primary" />
            <Metric label="Total this month" value={formatGBP(b.monthTotalPence)} />
            <Metric label="Sales" value={`${b.summary.saleCount} this month · ${b.lifetimeSaleCount} lifetime`} small />
          </div>
          <div className="border-t border-neutral-800 pt-3 space-y-1.5">
            <StatementLine desc="Subscription (main user)" amount={b.summary.basePence} />
            {b.summary.extraMembers > 0 && (
              <StatementLine desc={`Team members (${b.summary.extraMembers} × £39)`} amount={b.summary.seatsPence} />
            )}
            {b.summary.saleCount > 0 && (
              <StatementLine desc={`Sales this month (${b.summary.saleCount} × £5)`} amount={b.summary.perSalePence} />
            )}
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-neutral-800">
              <span className="text-sm font-semibold text-neutral-200">Total</span>
              <span className="text-sm font-semibold tabular-nums text-neutral-100">{formatGBP(b.summary.totalPence)}</span>
            </div>
            <p className="pt-1 text-[11px] text-neutral-600">No VAT. TSP isn&apos;t VAT-registered on this.</p>
          </div>
          <div className="mt-4 border-t border-neutral-800 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Fact label="Payment" value={payment.text} tone={payment.tone} />
            <Fact label="Billing schedule" value={cancellation} sub={b.subscribed ? "subscription active" : undefined} />
          </div>
        </SectionCard>
      )}

      {/* ── Setup & settings ─────────────────────────────────────── */}
      {active === "setup" && (
        <div className="space-y-8">
          {/* Getting set up — live scorecard, green/grey progress not red errors */}
          <SectionCard title="Getting set up" right={<span className="text-xs text-neutral-500">{setupDone} of {setupChecks.length}</span>}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
              {setupChecks.map((c) => (
                <SetupCheckRow key={c.key} check={c} />
              ))}
            </div>
          </SectionCard>

          {/* Configuration — read-only view of the business's own preferences
              (chase/update behaviour, portal defaults, invites, billing point,
              terms). Display-only; editing happens in the owner's self-serve
              settings, which this does not touch. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SectionCard title="Chasing & updates">
              <div className="space-y-1.5">
                <SettingRow label="Chase clients" on={b.settings.chaseClientsEnabled} />
                <SettingRow label="Escalate after" value={`${b.settings.clientChaseEscalateAfter} ${b.settings.clientChaseEscalateAfter === 1 ? "chase" : "chases"}`} />
                <SettingRow label="Chase solicitors" on={b.settings.chaseSolicitorsEnabled} />
                <SettingRow label="Chase enquiries" on={b.settings.chaseEnquiriesEnabled} />
                <SettingRow label="Chase advisors" on={b.settings.chaseAdvisorsEnabled} />
                <SettingRow label="Weekly client updates" on={b.settings.weeklyClientUpdatesEnabled} />
                <SettingRow label="Chain updates" on={b.settings.chainUpdatesEnabled} />
                <SettingRow label="Auto chain invites" on={b.settings.autoChainInvitesEnabled} />
              </div>
            </SectionCard>

            <SectionCard title="Client portal defaults">
              <div className="space-y-1.5">
                <SettingRow label="Key dates card" on={b.settings.showPortalKeyDates} />
                <SettingRow label="Costs card" on={b.settings.showPortalCosts} />
                <SettingRow label="Progress %" on={b.settings.showPortalProgressPercent} />
                <SettingRow label="Welcome sheet" on={b.settings.showPortalWelcomeSheet} />
                <SettingRow label="AI explain in emails" on={b.settings.aiExplainEmailEnabled} />
              </div>
            </SectionCard>

            <SectionCard title="Invites, billing & terms">
              <div className="space-y-1.5">
                <SettingRow label="Auto-invite · agency-added sales" on={b.settings.autoInviteOnAgentAdd} />
                <SettingRow label="Auto-invite · own-added sales" on={b.settings.autoInviteOnOwnAdd} />
                <SettingRow label="Client billing point" value={b.settings.billAtCompletion ? "On completion" : "On exchange"} />
                <SettingRow
                  label="Terms accepted"
                  value={b.settings.termsAcceptedVersion
                    ? `${b.settings.termsAcceptedVersion}${b.settings.termsAcceptedAt ? ` · ${formatShortDate(b.settings.termsAcceptedAt)}` : ""}`
                    : "Not accepted"}
                />
              </div>
            </SectionCard>
          </div>

          {/* Sending setup (business-level) — the per-agency detail is on Clients. */}
          {sending && (
            <SectionCard title="Sending setup">
              {sending.businessDnsDomains.length > 0 ? (
                <p className="text-[11px] text-neutral-500">
                  Company domain{sending.businessDnsDomains.length === 1 ? "" : "s"}:{" "}
                  {sending.businessDnsDomains.map((d) => `${d.domain} ${d.verified ? "✓ authenticated" : "pending"}`).join(" · ")}
                </p>
              ) : (
                <Empty>No company sending domain set up. Agencies fall back to their own sender or the platform default.</Empty>
              )}
              <p className="mt-2 text-[11px] text-neutral-600">
                Sender and DNS are shared by everyone on a domain. Per-agency detail is on the Clients tab.
              </p>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}

const SOURCE_LABEL: Record<SenderSource, string> = {
  link: "Own address for this agency",
  agency: "Agency's own address",
  business: "Company default address",
  platform: "No sender set up",
};

function SenderMethodBadge({ a }: { a: AgencySenderStatus }) {
  if (a.method === "dns") {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-900/60 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 w-fit">
          <BadgeCheck className="w-3 h-3" strokeWidth={2} /> DNS authenticated
        </span>
        {a.domain && <span className="text-[10px] text-neutral-600 font-mono">{a.domain}</span>}
      </span>
    );
  }
  if (a.method === "single_sender") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-900/60 bg-sky-950/50 px-2 py-0.5 text-[10px] font-semibold text-sky-300 w-fit">
        Single sender · no DNS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-900/60 bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300 w-fit">
      Platform fallback
    </span>
  );
}

function SetupCheckRow({ check }: { check: SetupCheck }) {
  const icon =
    check.state === "done" ? (
      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
    ) : check.state === "attention" ? (
      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
    ) : (
      <Circle className="w-4 h-4 text-neutral-700 flex-shrink-0 mt-0.5" strokeWidth={2} />
    );
  return (
    <div className="flex items-start gap-2.5">
      {icon}
      <div className="min-w-0">
        <p className={`text-sm ${check.state === "done" ? "text-neutral-200" : check.state === "attention" ? "text-amber-200" : "text-neutral-400"}`}>{check.label}</p>
        <p className="text-[11px] text-neutral-500 truncate">{check.detail}</p>
      </div>
    </div>
  );
}

function paymentLine(b: BusinessDetail): { text: string; tone: "ok" | "warn" | "bad" | "muted" } {
  const s = b.paymentState;
  if (s.kind === "warning") return { text: `Failed ${formatShortDate(s.paymentFailedAt)} · grace to ${formatShortDate(s.gracePeriodEndsAt)}`, tone: "warn" };
  if (s.kind === "blocked") return { text: `Blocked ${formatShortDate(s.blockedAt)} · new sales paused`, tone: "bad" };
  return b.subscribed ? { text: "Up to date", tone: "ok" } : { text: "Not set up yet", tone: "muted" };
}

// ── presentational helpers ──────────────────────────────────────────────────

function Fact({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "ok" | "warn" | "bad" | "muted" }) {
  const cls =
    tone === "ok" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : tone === "bad" ? "text-red-300" : tone === "muted" ? "text-neutral-500" : "text-neutral-100";
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-sm font-medium break-words ${cls}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-neutral-600">{sub}</p>}
    </div>
  );
}

function SectionCard({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-5 py-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value, tone = "default", small }: { label: string; value: string; tone?: "default" | "primary"; small?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 tabular-nums font-semibold ${small ? "text-sm text-neutral-300" : "text-2xl"} ${tone === "primary" ? "text-blue-300" : "text-neutral-100"}`}>{value}</p>
    </div>
  );
}

function StatementLine({ desc, amount }: { desc: string; amount: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-neutral-400 truncate">{desc}</span>
      <span className="text-sm tabular-nums text-neutral-300 flex-shrink-0">{formatGBP(amount)}</span>
    </div>
  );
}

function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${className ?? ""}`}>{children}</span>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-600">{children}</p>;
}

// Read-only setting row: a boolean renders as On/Off, otherwise a plain value.
function SettingRow({ label, on, value }: { label: string; on?: boolean; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-neutral-400">{label}</span>
      {value !== undefined ? (
        <span className="text-neutral-300 text-right truncate">{value}</span>
      ) : (
        <span className={on ? "text-emerald-400 font-medium" : "text-neutral-600"}>{on ? "On" : "Off"}</span>
      )}
    </div>
  );
}
