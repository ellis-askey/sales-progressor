import {
  getGrowthDashboard, GROWTH_PERIODS, GROWTH_TIERS,
  type GrowthPeriodKey, type GrowthTier,
} from "@/lib/command/growth-analytics";
import {
  Section, KpiCard, DeltaPill, FunnelBars, ParamTabs, TableShell, Tr, Td,
  CardEmpty, TrackingDisabled, InsightCard, fmtGBP, fmtInt, fmtPct,
} from "@/components/command/ui/primitives";

// Command Centre → Growth → Website & Growth. ONE page telling the whole
// journey: find us → behaviour → intent → signup/demo → first sale → repeat →
// exchange → revenue. DB-authoritative today; the website-behaviour half lights
// up when PostHog is connected. Superadmin-gated by the (protected) layout.
// Spec: docs/GROWTH_ANALYTICS_FORENSIC_AUDIT.md. Log: docs/GROWTH_ANALYTICS_IMPLEMENTATION.md.

export const dynamic = "force-dynamic";

type SP = { period?: string; tier?: string };

const parsePeriod = (v: string | undefined): GrowthPeriodKey =>
  (GROWTH_PERIODS.some((p) => p.key === v) ? v : "30d") as GrowthPeriodKey;
const parseTier = (v: string | undefined): GrowthTier =>
  (GROWTH_TIERS.some((t) => t.key === v) ? v : "all") as GrowthTier;

export default async function WebsiteGrowthPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const periodKey = parsePeriod(sp.period);
  const tierKey = parseTier(sp.tier);
  const d = await getGrowthDashboard(periodKey, tierKey);

  function href(over: { period?: string; tier?: string }): string {
    const period = over.period ?? periodKey;
    const tier = over.tier ?? tierKey;
    const p = new URLSearchParams();
    if (period !== "30d") p.set("period", period);
    if (tier !== "all") p.set("tier", tier);
    const qs = p.toString();
    return `/command/website-growth${qs ? `?${qs}` : ""}`;
  }

  const o = d.overview;

  return (
    <div className="space-y-8">
      {/* Header + controls */}
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Website &amp; Growth</h1>
          <p className="text-sm text-neutral-400 mt-1">Find us → behaviour → intent → signup → first sale → repeat use → exchange → revenue. One continuous view.</p>
        </div>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

      {/* D + E. Website behaviour + homepage — tracking-disabled until PostHog */}
      <Section title="Website behaviour" subtitle="Pages, paths, scroll, sections, CTA clicks — owned by PostHog once connected.">
        <TrackingDisabled
          what="Website behaviour"
          why="This half of the journey (visitors, landing pages, where they go/leave, homepage section reach, CTA clicks) is captured by PostHog on the marketing site. It lights up once the PostHog key is set and the marketing site is instrumented."
        />
      </Section>

      {/* K. Tracking health */}
      <Section title="Tracking health" subtitle="So analytics never breaks silently.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
