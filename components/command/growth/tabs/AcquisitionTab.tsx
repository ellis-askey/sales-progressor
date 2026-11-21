import Link from "next/link";
import {
  getGrowthDashboard, GROWTH_PERIODS, GROWTH_TIERS,
  type GrowthPeriodKey, type GrowthTier,
} from "@/lib/command/growth-analytics";
import {
  Section, KpiCard, DeltaPill, FunnelBars, ParamTabs, TableShell, Tr, Td,
  CardEmpty, TrackingDisabled, InsightCard, fmtGBP, fmtInt, fmtPct,
} from "@/components/command/ui/primitives";
import { getWebsiteBehaviour, getHomepageSectionReach } from "@/lib/command/posthog-read";
import { getChainInviteReport, getUninvitedNeighbours, getClaimActivation, getLoopMetrics, type ChainFunnel, type ChainInviteFollowUp, type UninvitedNeighbour, type ClaimActivation, type LoopMetrics } from "@/lib/command/chain-invites";

// Growth workspace → Acquisition tab. Two secondary views (?view=), each a
// verbatim extraction of its former page; the shell provides the "Growth"
// heading + top tab strip, and this provides the Website/Invites strip:
//   • Website — /command/website-growth (getGrowthDashboard + the PostHog
//               behaviour/section-reach reads, both null-gated on
//               isPosthogConfigured). Keeps its period/tier controls.
//   • Invites — /command/chain-invites (four commandDb loaders, no PostHog).
//               Keeps its range control.
// Only the active view's loaders run (lazy `view === key &&`). In particular,
// Website's two PostHog reads only fire on the Website view — switching to
// Invites makes ZERO PostHog calls. Datasets, charts, tables, empty states,
// gating and visual hierarchy are unchanged; only each page's own <h1> is
// dropped (the shell + strips label it). Internal filter links (period/tier/
// range) are repointed to the workspace URL so the controls stay in-tab.

const ACQ_VIEWS = [
  { key: "website", label: "Website" },
  { key: "invites", label: "Invites" },
] as const;
type AcqView = (typeof ACQ_VIEWS)[number]["key"];

export async function AcquisitionTab({
  view,
  period,
  tier,
  range,
}: {
  view?: string;
  period?: string;
  tier?: string;
  range?: string;
}) {
  const active: AcqView = (ACQ_VIEWS.some((v) => v.key === view) ? view : "website") as AcqView;
  const hrefFor = (v: string) => `/command/growth?tab=acquisition&view=${v}`;

  return (
    <div className="space-y-6">
      <ParamTabs options={[...ACQ_VIEWS]} active={active} hrefFor={hrefFor} />
      {active === "website" && <WebsiteView period={period} tier={tier} />}
      {active === "invites" && <InvitesView range={range} />}
    </div>
  );
}

// ── Website view (verbatim from /command/website-growth) ─────────────────────

// Homepage sections in visual order (matches marketing-site SectionView ids).
const HOMEPAGE_SECTIONS: Array<{ id: string; label: string }> = [
  { id: "hero", label: "Hero" },
  { id: "tier_choice", label: "Tier choice" },
  { id: "intelligence_layer", label: "Intelligence" },
  { id: "outsourced_service", label: "Service" },
  { id: "client_portal", label: "Client portal" },
  { id: "social_proof", label: "Social proof" },
  { id: "faq", label: "FAQ" },
  { id: "pricing_preview", label: "Pricing" },
  { id: "final_cta", label: "Final CTA" },
];

const parsePeriod = (v: string | undefined): GrowthPeriodKey =>
  (GROWTH_PERIODS.some((p) => p.key === v) ? v : "30d") as GrowthPeriodKey;
const parseTier = (v: string | undefined): GrowthTier =>
  (GROWTH_TIERS.some((t) => t.key === v) ? v : "all") as GrowthTier;

async function WebsiteView({ period, tier }: { period?: string; tier?: string }) {
  const periodKey = parsePeriod(period);
  const tierKey = parseTier(tier);
  const d = await getGrowthDashboard(periodKey, tierKey);
  // Website-behaviour half (PostHog). null when not configured → TrackingDisabled.
  const [behaviour, sectionReach] = await Promise.all([
    getWebsiteBehaviour(d.period.start, d.period.end),
    getHomepageSectionReach(d.period.start, d.period.end),
  ]);

  function href(over: { period?: string; tier?: string }): string {
    const p = over.period ?? periodKey;
    const t = over.tier ?? tierKey;
    const params = new URLSearchParams();
    params.set("tab", "acquisition");
    params.set("view", "website");
    if (p !== "30d") params.set("period", p);
    if (t !== "all") params.set("tier", t);
    return `/command/growth?${params.toString()}`;
  }

  const o = d.overview;

  return (
    <div className="space-y-8">
      {/* Header + controls */}
      <div className="space-y-3">
        <p className="text-sm text-neutral-400">Find us → behaviour → intent → signup → first sale → repeat use → exchange → revenue. One continuous view.</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ParamTabs options={GROWTH_PERIODS.map((p) => ({ key: p.key, label: p.label }))} active={periodKey} hrefFor={(k) => href({ period: k })} />
          <ParamTabs options={GROWTH_TIERS.map((t) => ({ key: t.key, label: t.label }))} active={tierKey} hrefFor={(k) => href({ tier: k })} />
        </div>
      </div>

      {/* A. Overview — are we growing? */}
      <Section title="Are we growing?" subtitle={`${d.period.label} vs the previous ${d.period.label.toLowerCase()}`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard label="Signups" value={fmtInt(o.signups)} tip="Agencies that registered in this period (real customers only)." delta={<DeltaPill current={o.signups} previous={o.prevSignups} />} />
          <KpiCard label="Activated" value={fmtInt(o.activated)} tip="Of this period's signups, how many created their first real sale." delta={<DeltaPill current={o.activated} previous={o.prevActivated} />} />
          <KpiCard label="Activation rate" value={fmtPct(o.activationRate)} sub="signups → first sale" />
          <KpiCard label="Exchanges" value={fmtInt(o.exchanges)} tip="Real sales that reached exchange in this period." delta={<DeltaPill current={o.exchanges} previous={o.prevExchanges} />} />
          <KpiCard label="TSP revenue" value={fmtGBP(o.revenuePence)} accent tip="Banked InvoiceLine revenue for sales exchanged in this period. Free/trial exchanges bank £0." delta={<DeltaPill current={o.revenuePence} previous={o.prevRevenuePence} />} />
        </div>
        <p className="text-[11px] text-neutral-600">Website visitors and sources need website analytics (PostHog) connected — see Tracking health below.</p>
      </Section>

      {/* B. Full growth funnel */}
      <Section title="The full funnel" tip="Cohort funnel: of the agencies that signed up in this period, how many reach each stage." subtitle="Segment by tier with the control above.">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <FunnelBars stages={d.funnel} />
          <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500">Banked revenue from this cohort</span>
            <span className="text-lg font-semibold text-emerald-300 tabular-nums">{fmtGBP(d.cohortRevenuePence)}</span>
          </div>
        </div>
      </Section>

      {/* C. Acquisition — where do valuable users come from? */}
      <Section title="Acquisition" tip="Signup cohort grouped by first-touch channel (classified from utm/referrer captured at registration)." subtitle="Which sources produce agencies that actually activate and generate revenue.">
        {d.acquisition.length === 0 ? (
          <CardEmpty>No attributed signups in this period yet.</CardEmpty>
        ) : (
          <TableShell head={["Source", "Signups", "Activated", "Activation", "Exchanged", "Revenue"]}>
            {d.acquisition.map((r) => (
              <Tr key={r.source}>
                <Td first>{r.source}</Td>
                <Td>{fmtInt(r.signups)}</Td>
                <Td>{fmtInt(r.activated)}</Td>
                <Td muted={r.activationRate == null}>{fmtPct(r.activationRate)}</Td>
                <Td>{fmtInt(r.exchangedAgencies)}</Td>
                <Td>{r.revenuePence > 0 ? fmtGBP(r.revenuePence) : "—"}</Td>
              </Tr>
            ))}
          </TableShell>
        )}
      </Section>

      {/* F. CTA performance — which CTA creates customers? */}
      <Section title="CTA performance" tip="Which on-site CTA a signup came from (captured on the outbound link). Measures customers created, not just clicks." subtitle="Clicks themselves need PostHog; this is the DB truth on which CTAs led to real signups.">
        {d.cta.length === 0 ? (
          <CardEmpty>No CTA-attributed signups yet. Once the marketing site is deployed with the tier/CTA handoff, new signups will carry their CTA here.</CardEmpty>
        ) : (
          <TableShell head={["CTA location", "Signups", "Activated", "Revenue"]}>
            {d.cta.map((r) => (
              <Tr key={r.cta}>
                <Td first>{r.cta}</Td>
                <Td>{fmtInt(r.signups)}</Td>
                <Td>{fmtInt(r.activated)}</Td>
                <Td>{r.revenuePence > 0 ? fmtGBP(r.revenuePence) : "—"}</Td>
              </Tr>
            ))}
          </TableShell>
        )}
      </Section>

      {/* G. Activation & adoption — signup → 1st → 2nd → 5th → 10th sale */}
      <Section title="Activation &amp; adoption" tip="All-time, tier-filtered. Connects acquisition to how deeply agencies actually adopt the product." subtitle="The specialist Getting started / Repeat use pages stay for deeper analysis; this is the growth-level summary.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Activation rate" value={fmtPct(d.adoption.activationRate)} sub={`${fmtInt(d.adoption.activated)} of ${fmtInt(d.adoption.totalAgencies)} agencies`} />
          <KpiCard label="Avg days to first sale" value={d.adoption.avgDaysToFirstSale == null ? "—" : `${d.adoption.avgDaysToFirstSale}`} sub={d.adoption.avgDaysToFirstSale == null ? "" : "days"} />
          <KpiCard label="Never activated" value={fmtInt(d.adoption.neverActivated)} sub="signed up, no real sale" />
          <KpiCard label="Reached 10th sale" value={fmtInt(d.adoption.reached10)} sub="deeply adopted" />
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <FunnelBars stages={[
            { label: "Signed up", value: d.adoption.totalAgencies },
            { label: "1st sale", value: d.adoption.activated },
            { label: "2nd sale", value: d.adoption.reached2 },
            { label: "5th sale", value: d.adoption.reached5 },
            { label: "10th sale", value: d.adoption.reached10 },
          ]} />
        </div>
      </Section>

      {/* J. Insights */}
      <Section title="Worth looking at" subtitle="Deterministic, evidence-based observations. Correlation, not causation.">
        <div className="space-y-2">
          {d.insights.map((i, idx) => <InsightCard key={idx} tone={i.tone}>{i.text}</InsightCard>)}
        </div>
      </Section>

      {/* D. Website behaviour (PostHog read layer) */}
      <Section title="Website behaviour" subtitle="Visitors, top pages and sources from the marketing site.">
        {behaviour ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KpiCard label="Visitors" value={fmtInt(behaviour.visitors)} />
              <KpiCard label="Pageviews" value={fmtInt(behaviour.pageviews)} />
              <KpiCard label="Views / visitor" value={behaviour.visitors ? (behaviour.pageviews / behaviour.visitors).toFixed(1) : "—"} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">Top pages</p>
                {behaviour.topPages.length === 0 ? <CardEmpty>No pageviews yet.</CardEmpty> : (
                  <TableShell head={["Page", "Views"]}>
                    {behaviour.topPages.map((p) => <Tr key={p.path}><Td first>{p.path}</Td><Td>{fmtInt(p.views)}</Td></Tr>)}
                  </TableShell>
                )}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">Top sources</p>
                {behaviour.topSources.length === 0 ? <CardEmpty>No sources yet.</CardEmpty> : (
                  <TableShell head={["Referrer", "Visitors"]}>
                    {behaviour.topSources.map((s) => <Tr key={s.source}><Td first>{s.source}</Td><Td>{fmtInt(s.visitors)}</Td></Tr>)}
                  </TableShell>
                )}
              </div>
            </div>
          </div>
        ) : (
          <TrackingDisabled what="Website behaviour" why="Visitors, pages, sources, scroll and CTA clicks come from PostHog on the marketing site. This lights up once the PostHog key is set (both repos) and the marketing site is deployed with instrumentation." />
        )}
      </Section>

      {/* E. Homepage performance — section reach funnel (PostHog mkt_section_viewed) */}
      <Section title="Homepage performance" subtitle="How far down the homepage visitors actually get.">
        {sectionReach && sectionReach.length > 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <FunnelBars stages={HOMEPAGE_SECTIONS.map((s) => ({ label: s.label, value: sectionReach.find((r) => r.section === s.id)?.views ?? 0 }))} />
          </div>
        ) : (
          <TrackingDisabled what="Homepage section reach" why="Each homepage section fires mkt_section_viewed via an IntersectionObserver on the marketing site. Once PostHog is live you'll see the scroll funnel (hero → … → final CTA)." />
        )}
      </Section>

      {/* K. Tracking health */}
      <Section title="Tracking health" subtitle="So analytics never breaks silently.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <HealthTile label="PostHog capture key" ok={d.tracking.posthogClientKey} />
          <HealthTile label="PostHog read key" ok={d.tracking.posthogReadKey} />
          <HealthTile label="PostHog project id" ok={d.tracking.posthogProjectId} />
          <KpiCard label="Known attribution" value={fmtPct(d.tracking.knownAttributionPct)} sub={`${fmtInt(d.tracking.attributedSignups)} of ${fmtInt(d.tracking.totalSignups)} signups`} />
        </div>
        <p className="text-[11px] text-neutral-600">Reporting excludes internal agencies, demo files, and migrated data. Revenue counts banked InvoiceLine only; free/trial exchanges bank £0.</p>
      </Section>
    </div>
  );
}

function HealthTile({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold flex items-center gap-1.5 ${ok ? "text-emerald-400" : "text-neutral-500"}`}>
        <span className={`w-2 h-2 rounded-full ${ok ? "bg-emerald-500" : "bg-neutral-600"}`} />
        {ok ? "Connected" : "Not set"}
      </p>
    </div>
  );
}

// ── Invites view (verbatim from /command/chain-invites) ──────────────────────

const RANGES: { label: string; days: number | null; key: string }[] = [
  { label: "30 days", days: 30, key: "30" },
  { label: "90 days", days: 90, key: "90" },
  { label: "All time", days: null, key: "all" },
];

async function InvitesView({ range }: { range?: string }) {
  const active = RANGES.find((r) => r.key === range) ?? RANGES[1]; // default 90 days
  const [report, uninvited, activation, loop] = await Promise.all([
    getChainInviteReport(active.days),
    getUninvitedNeighbours(),
    getClaimActivation(),
    getLoopMetrics(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-sm text-neutral-400 max-w-2xl">
          When an agent invites the agency above or below them into a chain, this is how far
          that invite gets. The drop between two steps is where we&apos;re losing them.
        </p>
        <div className="flex gap-0.5 bg-[#1a1a1a] rounded-md p-0.5">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/command/growth?tab=acquisition&view=invites&range=${r.key}`}
              className={`text-[12px] px-3 py-1 rounded font-semibold transition-all ${
                r.key === active.key ? "bg-[#2563eb] text-white" : "text-[#525252] hover:text-[#a3a3a3]"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <Funnel funnel={report.funnel} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Awaiting" value={report.awaitingView} sub="sent, no sign they've opened it" />
        <Stat label="Declined" value={report.declined} sub="said it isn't their sale" />
        <Stat label="Bounced" value={report.bounced} sub="email couldn't be delivered" warn={report.bounced > 0} />
        <Stat label="Expired" value={report.expired} sub="link lapsed before they joined" warn={report.expired > 0} />
      </div>

      <FollowUps rows={report.followUps} />

      <AfterJoin activation={activation} />

      <KnockOn m={loop} />

      <UninvitedList rows={uninvited} />

      <p className="text-[12px] text-neutral-600 leading-relaxed">
        &ldquo;Viewed&rdquo; means they clicked through from the email and saw the chain.
        &ldquo;Started&rdquo; means they clicked &ldquo;Claim this sale&rdquo; and reached the
        sign-up. Email open-rate isn&apos;t tracked yet (see the phase notes), so the funnel
        begins at the click-through.
      </p>
    </div>
  );
}

// Funnel: each stage as a horizontal bar scaled to its share of invites sent,
// with the count, that share, and the drop-off from the stage above.
function Funnel({ funnel }: { funnel: ChainFunnel }) {
  const total = funnel.sent;
  const stages: { label: string; value: number; hint: string }[] = [
    { label: "Sent", value: funnel.sent, hint: "invite emailed" },
    { label: "Viewed", value: funnel.viewed, hint: "opened the chain page" },
    { label: "Started", value: funnel.started, hint: "clicked Claim this sale" },
    { label: "Joined", value: funnel.joined, hint: "account created, file linked" },
  ];
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-4">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">Invite funnel</p>
      <div className="mt-3 space-y-2">
        {stages.map((s, i) => {
          const share = total === 0 ? 0 : Math.round((s.value / total) * 100);
          const prev = i === 0 ? null : stages[i - 1].value;
          const dropped = prev != null ? prev - s.value : 0;
          return (
            <div key={s.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0">
                <span className="text-[12px] text-neutral-300 block leading-tight">{s.label}</span>
                <span className="text-[10px] text-neutral-600 block leading-tight">{s.hint}</span>
              </span>
              <div className="flex-1 h-6 rounded bg-neutral-800/60 overflow-hidden">
                <div className="h-full bg-[#2563eb]/70 rounded" style={{ width: `${share}%` }} aria-hidden />
              </div>
              <span className="w-16 shrink-0 text-right text-[13px] text-neutral-200 tabular-nums">
                {s.value}
                <span className="text-neutral-600"> ({share}%)</span>
              </span>
              <span className="w-20 shrink-0 text-right text-[11px] text-neutral-600 tabular-nums">
                {prev != null && dropped > 0 ? `-${dropped} lost` : ""}
              </span>
            </div>
          );
        })}
      </div>
      {total === 0 && (
        <p className="mt-3 text-[13px] text-neutral-600">
          No invites sent in this window yet. As agents send chain invites, the funnel fills in here.
        </p>
      )}
    </div>
  );
}

// The call-list. Agents who opened the invite but haven't joined or declined —
// the warmest leads for a personal nudge.
function FollowUps({ rows }: { rows: ChainInviteFollowUp[] }) {
  const fmt = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "-";

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800">
        <p className="text-[13px] font-semibold text-neutral-200">Looked but haven&apos;t joined</p>
        <p className="text-[11px] text-neutral-500 mt-0.5">
          They opened the invite and saw the chain, but haven&apos;t joined. A personal nudge is worth it.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-neutral-600">
          Nobody in this state right now. Anyone who opens an invite but stalls before joining will show here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-neutral-500 text-left">
                <th className="font-medium px-4 py-2">Invited agent</th>
                <th className="font-medium px-4 py-2">Their sale</th>
                <th className="font-medium px-4 py-2">Invited by</th>
                <th className="font-medium px-4 py-2 text-right">Sent</th>
                <th className="font-medium px-4 py-2 text-right">Viewed</th>
                <th className="font-medium px-4 py-2 text-right">Got to sign-up</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.linkId} className="border-t border-neutral-800/70">
                  <td className="px-4 py-2.5">
                    <span className="text-neutral-200 block">{r.invitedName ?? r.invitedAgency ?? "Unknown agent"}</span>
                    {r.invitedEmail && <span className="text-neutral-600 block text-[11px]">{r.invitedEmail}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-400">{r.address}</td>
                  <td className="px-4 py-2.5 text-neutral-400">
                    {r.invitingAgent ?? "-"}
                    {r.invitingAgency ? <span className="text-neutral-600"> · {r.invitingAgency}</span> : ""}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-500 tabular-nums">{fmt(r.sentAt)}</td>
                  <td className="px-4 py-2.5 text-right text-neutral-300 tabular-nums">{fmt(r.viewedAt)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.startedAt ? (
                      <span className="text-[#6ee7b7]">{fmt(r.startedAt)}</span>
                    ) : (
                      <span className="text-neutral-600">not yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// The compounding loop: joiners who then invited their own neighbours.
function KnockOn({ m }: { m: LoopMetrics }) {
  const cells: { label: string; value: number; sub: string }[] = [
    { label: "Joined", value: m.joiners, sub: "claimed an invite" },
    { label: "Then invited", value: m.joinersWhoInvited, sub: "invited others in turn" },
    { label: "Invites they sent", value: m.invitesByJoiners, sub: "onward invites" },
    { label: "Joined from those", value: m.claimsFromJoiners, sub: "the chain spreading" },
  ];
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-4">
      <p className="text-[13px] font-semibold text-neutral-200">Knock-on</p>
      <p className="text-[11px] text-neutral-500 mt-0.5 mb-3">
        The flywheel: agents who joined, then invited their own neighbours. When &ldquo;joined from
        those&rdquo; starts to outpace &ldquo;joined&rdquo;, the product is spreading on its own.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cells.map((c) => (
          <div key={c.label} className="rounded-lg bg-neutral-800/40 px-3 py-2">
            <p className="text-xl font-semibold tabular-nums text-neutral-100">{c.value}</p>
            <p className="text-[11px] font-medium text-neutral-300 mt-0.5">{c.label}</p>
            <p className="text-[10px] text-neutral-600">{c.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Activation after a claim. Joining isn't the win; confirming a first step is.
function AfterJoin({ activation }: { activation: ClaimActivation }) {
  const fmt = (d: Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const share = activation.claimed === 0 ? 0 : Math.round((activation.activated / activation.claimed) * 100);
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[13px] font-semibold text-neutral-200">After they join</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Joining isn&apos;t the win, using it is. How many who joined have confirmed at least one step on their file.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-semibold tabular-nums text-neutral-100">
            {activation.activated}
            <span className="text-neutral-600 text-lg">/{activation.claimed}</span>
          </p>
          <p className="text-[11px] text-neutral-500">confirmed a step ({share}%)</p>
        </div>
      </div>
      {activation.dormant.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-neutral-600">
          {activation.claimed === 0
            ? "No one has joined a chain yet."
            : "Everyone who joined has confirmed a step."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-neutral-500 text-left">
                  <th className="font-medium px-4 py-2">Agent</th>
                  <th className="font-medium px-4 py-2">Their file</th>
                  <th className="font-medium px-4 py-2 text-right">Joined</th>
                </tr>
              </thead>
              <tbody>
                {activation.dormant.map((d) => (
                  <tr key={d.linkId} className="border-t border-neutral-800/70">
                    <td className="px-4 py-2.5 text-neutral-200">{d.claimerName ?? d.agency ?? "Unknown"}</td>
                    <td className="px-4 py-2.5 text-neutral-400">{d.address}</td>
                    <td className="px-4 py-2.5 text-right text-neutral-500 tabular-nums">{fmt(d.claimedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-neutral-800/70">
            <p className="text-[11px] text-neutral-600">Joined but no step confirmed yet. Worth a check-in.</p>
          </div>
        </>
      )}
    </div>
  );
}

// Neighbours added to a chain with an email but never invited. Not part of the
// funnel (nothing was ever sent) — shown so idle invites get a prod.
function UninvitedList({ rows }: { rows: UninvitedNeighbour[] }) {
  const fmt = (d: Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800">
        <p className="text-[13px] font-semibold text-neutral-200">Ready to invite ({rows.length})</p>
        <p className="text-[11px] text-neutral-500 mt-0.5">
          Neighbours added to a chain with an email, but no invite sent yet. Free pipeline. Prod the agency to send, or reach the neighbour yourself.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-neutral-600">
          Nothing sitting idle. Every neighbour with an email on file has been invited.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-neutral-500 text-left">
                <th className="font-medium px-4 py-2">Neighbour</th>
                <th className="font-medium px-4 py-2">Their sale</th>
                <th className="font-medium px-4 py-2">Added by</th>
                <th className="font-medium px-4 py-2 text-right">Added</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.linkId} className="border-t border-neutral-800/70">
                  <td className="px-4 py-2.5">
                    <span className="text-neutral-200 block">{r.neighbourAgency ?? "Unknown agency"}</span>
                    {r.neighbourEmail && <span className="text-neutral-600 block text-[11px]">{r.neighbourEmail}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-400">{r.neighbourAddress}</td>
                  <td className="px-4 py-2.5 text-neutral-400">
                    {r.invitingAgent ?? "-"}
                    {r.invitingAgency ? <span className="text-neutral-600"> · {r.invitingAgency}</span> : ""}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-500 tabular-nums">{fmt(r.addedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: number; sub?: string; warn?: boolean }) {
  return (
    <div className={`bg-neutral-900 border rounded-xl px-4 py-3 ${warn ? "border-[#5a3f2c]" : "border-neutral-800"}`}>
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${warn ? "text-[#f6b17a]" : "text-neutral-100"}`}>{value}</p>
      {sub && <p className="text-[11px] text-neutral-600 mt-0.5">{sub}</p>}
    </div>
  );
}
