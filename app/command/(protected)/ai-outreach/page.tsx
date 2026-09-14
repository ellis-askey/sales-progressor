// AI Outreach (Command Centre → Growth). Read-only surface (Build Order E): the
// outreach objective funnel, segment performance, experiments, learnings, and AI
// activity. NOTHING here mutates, generates, approves, launches, or sends — those
// controls arrive in later build orders. Distinct from "Growth tests" (the general
// product-experiment tracker); this is outbound prospect experimentation.

import {
  Section,
  KpiCard,
  FunnelBars,
  ParamTabs,
  TableShell,
  Tr,
  Td,
  CardEmpty,
  InsightCard,
  fmtInt,
  fmtPct,
  fmtGBP,
} from "@/components/command/ui/primitives";
import { getOutreachMetrics } from "@/lib/outreach/metrics";
import { getAllSegmentFunnels } from "@/lib/outreach/metrics";
import { SEGMENT_DIMENSIONS, type SegmentDimension } from "@/lib/outreach/segments";
import { listExperimentsWithDetail, listLearnings, getAiActivity, getEligibilityCounts, listCycles, type ExperimentListItem } from "@/lib/outreach/read";
import { GenerateProposalButton } from "@/components/command/ai-outreach/GenerateProposalButton";
import { ExperimentReviewActions } from "@/components/command/ai-outreach/ExperimentReviewActions";

export const dynamic = "force-dynamic";

type ViewKey = "overview" | "segments" | "experiments" | "learnings" | "cycles" | "activity";
const VIEW_OPTIONS: { key: ViewKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "segments", label: "Segments" },
  { key: "experiments", label: "Experiments" },
  { key: "learnings", label: "Learnings" },
  { key: "cycles", label: "Cycle history" },
  { key: "activity", label: "AI activity" },
];

const SEGMENT_LABEL: Record<SegmentDimension, string> = {
  source: "Lead source",
  branch_structure: "Branch structure",
  contact_history: "Contact history",
  region: "Region (from postcode)",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-neutral-800 text-neutral-400",
  awaiting_approval: "bg-amber-950 text-amber-400 border border-amber-900",
  approved: "bg-blue-950 text-blue-400 border border-blue-900",
  running: "bg-emerald-950 text-emerald-400 border border-emerald-900",
  review_ready: "bg-blue-950 text-blue-300 border border-blue-900",
  completed: "bg-neutral-800 text-neutral-300",
  rejected: "bg-red-950 text-red-400 border border-red-900",
  archived: "bg-neutral-800 text-neutral-500",
};

const REVIEW_TONE: Record<string, string> = {
  sound: "bg-emerald-950 text-emerald-400 border border-emerald-900",
  needs_revision: "bg-amber-950 text-amber-400 border border-amber-900",
  reject: "bg-red-950 text-red-400 border border-red-900",
};
const REVIEW_LABEL: Record<string, string> = {
  sound: "Reviewer: sound",
  needs_revision: "Reviewer: needs revision",
  reject: "Reviewer rejected",
};

const LEARNING_TONE: Record<string, string> = {
  candidate: "bg-neutral-800 text-neutral-400",
  weak: "bg-amber-950 text-amber-400 border border-amber-900",
  supported: "bg-emerald-950 text-emerald-400 border border-emerald-900",
  disproven: "bg-red-950 text-red-400 border border-red-900",
};

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{children}</span>;
}

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export default async function AiOutreachPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const sp = await searchParams;
  const view = (VIEW_OPTIONS.some((v) => v.key === sp.view) ? sp.view : "overview") as ViewKey;
  const href = (k: string) => `/command/ai-outreach?view=${k}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">AI Outreach</h1>
        <p className="text-[13px] text-neutral-500 mt-0.5">
          Outbound prospect experiments, measured on real business outcomes. Read-only for now: nothing here sends,
          launches, or generates.
        </p>
      </div>

      <ParamTabs options={VIEW_OPTIONS} active={view} hrefFor={href} />

      {view === "overview" && <Overview />}
      {view === "segments" && <Segments />}
      {view === "experiments" && <Experiments />}
      {view === "learnings" && <Learnings />}
      {view === "cycles" && <Cycles />}
      {view === "activity" && <Activity />}
    </div>
  );
}

// ── Overview: business outcomes dominate; diagnostics clearly subordinate ─────
async function Overview() {
  const [m, elig] = await Promise.all([getOutreachMetrics(), getEligibilityCounts()]);
  const f = m.funnel;
  const d = m.diagnostics;

  return (
    <div className="space-y-8">
      <Section
        title="Business outcomes"
        subtitle="What outreach actually produced. Activated agency (a converted agency with at least one genuine sale) is the objective."
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Replies" value={fmtInt(f.replied)} sub="prospects who replied" />
          <KpiCard label="Interested" value={fmtInt(f.interested)} sub="positive / interested" />
          <KpiCard label="Converted agencies" value={fmtInt(f.convertedToAgency)} sub="signed up" />
          <KpiCard label="Activated agencies" value={fmtInt(f.activatedAgency)} sub="≥1 genuine sale" accent />
          <KpiCard label="Further activity" value={fmtInt(f.furtherActivity)} sub="≥2 genuine sales" />
        </div>
      </Section>

      <Section title="Objective funnel" subtitle="Prospect grain, top to deepest. Outreach-attributed only.">
        <FunnelBars
          stages={[
            { label: "Contacted", value: f.contacted },
            { label: "Replied", value: f.replied },
            { label: "Interested", value: f.interested },
            { label: "Converted", value: f.convertedToAgency },
            { label: "Activated", value: f.activatedAgency, tip: "Converted agency with at least one genuine (non-demo, non-migrated) sale." },
            { label: "Further activity", value: f.furtherActivity },
          ]}
        />
        <InsightCard>
          Revenue is <span className="text-neutral-100">outreach-attributed only</span> (agencies converted from a
          prospect), never platform-wide: {fmtInt(m.revenue.exchangedGenuineTransactions)} genuine exchanged,{" "}
          {fmtInt(m.revenue.billedGenuineTransactions)} billed. Sparse pre-launch, tracked not optimised.
        </InsightCard>
      </Section>

      <Section title="Eligibility" subtitle="Deterministic and application-controlled. Counts only; the model never sees prospect identities.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Eligible now" value={fmtInt(elig.eligibleNow)} sub="reachable, not converted" />
          <KpiCard label="Opted out" value={fmtInt(elig.suppressedOptedOut)} sub="suppressed" />
          <KpiCard label="Bounced" value={fmtInt(elig.suppressedBounced)} sub="suppressed" />
          <KpiCard label="Already converted" value={fmtInt(elig.alreadyConverted)} sub="excluded" />
        </div>
      </Section>

      {/* Diagnostics: visually subordinate. Never a success metric. */}
      <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/30 px-4 py-4">
        <p className="text-[10px] uppercase tracking-wider text-neutral-600 font-semibold">
          Diagnostics — leading indicators only, not success metrics
        </p>
        <p className="text-[11px] text-neutral-600 mt-0.5 mb-3">
          Deliverability and opens/clicks are noisy signals used to spot problems, never to judge whether outreach worked.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Emails sent" value={fmtInt(d.emailsSent)} />
          <MiniStat label="Delivered" value={fmtInt(d.delivered)} rate={fmtPct(d.emailsSent ? d.deliveredRate * 100 : null)} />
          <MiniStat label="Opened" value={fmtInt(d.opened)} rate={fmtPct(d.emailsSent ? d.openRate * 100 : null)} diagnostic />
          <MiniStat label="Clicked" value={fmtInt(d.clicked)} rate={fmtPct(d.emailsSent ? d.clickRate * 100 : null)} diagnostic />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, rate, diagnostic = false }: { label: string; value: string; rate?: string; diagnostic?: boolean }) {
  return (
    <div className="rounded-lg border border-neutral-800/70 bg-neutral-900/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-neutral-600">
        {label}
        {diagnostic && <span className="ml-1 text-neutral-700">(diagnostic)</span>}
      </p>
      <p className="mt-0.5 text-base font-medium tabular-nums text-neutral-400">{value}</p>
      {rate && <p className="text-[10px] text-neutral-600 tabular-nums">{rate}</p>}
    </div>
  );
}

// ── Segments ─────────────────────────────────────────────────────────────────
async function Segments() {
  const all = await getAllSegmentFunnels();
  return (
    <div className="space-y-8">
      <InsightCard tone="neutral">
        Segments use only verified structured fields. Region is derived from the postcode for analysis and targeting
        only, and is never asserted as a fact in outreach copy.
      </InsightCard>
      {SEGMENT_DIMENSIONS.map((dim) => {
        const rows = all[dim];
        return (
          <Section key={dim} title={SEGMENT_LABEL[dim]}>
            {rows.length === 0 ? (
              <CardEmpty>No prospect data in this segment yet.</CardEmpty>
            ) : (
              <TableShell head={["Segment", "Prospects", "Contacted", "Replied", "Interested", "Converted", "Activated", "Maturity"]}>
                {rows.map((r) => (
                  <Tr key={r.segment}>
                    <Td first>{r.segment}</Td>
                    <Td>{fmtInt(r.funnel.totalProspects)}</Td>
                    <Td>{fmtInt(r.funnel.contacted)}</Td>
                    <Td>{fmtInt(r.funnel.replied)}</Td>
                    <Td>{fmtInt(r.funnel.interested)}</Td>
                    <Td>{fmtInt(r.funnel.convertedToAgency)}</Td>
                    <Td>{fmtInt(r.funnel.activatedAgency)}</Td>
                    <Td muted>{r.maturity}</Td>
                  </Tr>
                ))}
              </TableShell>
            )}
          </Section>
        );
      })}
    </div>
  );
}

// ── Experiments ──────────────────────────────────────────────────────────────
async function Experiments() {
  const experiments = await listExperimentsWithDetail();
  return (
    <Section
      title="Experiments"
      subtitle="Control vs challenger outreach experiments. Winners are only declared when the evidence supports it."
      right={<GenerateProposalButton />}
    >
      {experiments.length === 0 ? (
        <CardEmpty>
          No experiments yet. Use &ldquo;Generate a proposal&rdquo; to have the strategist draft one for review. Nothing
          sends or launches; a proposal only appears here for you to approve later.
        </CardEmpty>
      ) : (
        <div className="space-y-3">
          {experiments.map((e) => (
            <ExperimentRow key={e.id} e={e} />
          ))}
        </div>
      )}
    </Section>
  );
}

function ExperimentRow({ e }: { e: ExperimentListItem }) {
  const cmp = e.rollup?.comparison;
  const verdict = cmp
    ? cmp.winner
      ? `Winner: ${cmp.winner}`
      : "No winner yet"
    : e.rollup && e.rollup.variants.length < 2
      ? "Awaiting variants"
      : "No data yet";
  const challenger = e.variants.find((v) => v.role === "challenger");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const challengerSteps = Array.isArray(challenger?.emails)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (challenger!.emails as any[]).map((s) => ({ stepIndex: Number(s.stepIndex ?? 0), gapDays: Number(s.gapDays ?? 0), subject: String(s.subject ?? ""), body: String(s.body ?? "") }))
    : [];
  const tgt = e.targetSegment as { kind?: string; dimension?: string; values?: string[] } | null;
  const targetKind: "all_eligible" | "segment" = tgt?.kind === "segment" ? "segment" : "all_eligible";
  const feas = e.feasibility as { feasible?: boolean } | null;
  return (
    <details className="rounded-xl border border-neutral-800 bg-neutral-900 group">
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-neutral-100 truncate">{e.title}</span>
            <Badge tone={STATUS_TONE[e.status] ?? "bg-neutral-800 text-neutral-400"}>{e.status.replace(/_/g, " ")}</Badge>
            {e.reviewOutcome && (
              <Badge tone={REVIEW_TONE[e.reviewOutcome] ?? "bg-neutral-800 text-neutral-400"}>
                {REVIEW_LABEL[e.reviewOutcome] ?? `Reviewer: ${e.reviewOutcome}`}
              </Badge>
            )}
            {e.reviewerOverriddenAt && <Badge tone="bg-amber-950 text-amber-400 border border-amber-900">Reviewer rejection overridden</Badge>}
            {e.editedAfterReview && <Badge tone="bg-amber-950 text-amber-300 border border-amber-900">Edited after AI review</Badge>}
          </div>
          <p className="text-[11px] text-neutral-600 mt-0.5">
            Primary metric: {e.primaryMetric ?? "—"} · {verdict} · created {fmtDate(e.createdAt)}
          </p>
        </div>
        <span className="text-[11px] text-neutral-600 group-open:hidden shrink-0">View</span>
      </summary>

      <div className="border-t border-neutral-800 px-4 py-4 space-y-4">
        {/* Plain-English design */}
        <Field label="Hypothesis" value={e.hypothesis} />
        <Field label="Rationale" value={e.rationale} />
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Audience</p>
          <p className="text-[12px] text-neutral-300">{targetLabel(e.targetSegment)}</p>
        </div>

        <FeasibilityBlock data={e.feasibility} />
        <ReviewerFindings data={e.reviewerResult} />

        {/* Variants side by side */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">Variants</p>
          <div className="grid md:grid-cols-2 gap-3">
            {e.variants.map((v) => {
              const roll = e.rollup?.variants.find((rv) => rv.variantId === v.id);
              return (
                <div key={v.id} className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-200">{v.name}</span>
                    <Badge tone={v.role === "control" ? "bg-neutral-800 text-neutral-300" : "bg-blue-950 text-blue-300 border border-blue-900"}>{v.role}</Badge>
                  </div>
                  {roll && (
                    <p className="text-[11px] text-neutral-500 mt-1 tabular-nums">
                      {fmtInt(roll.successes)}/{fmtInt(roll.exposure)} ({fmtPct(roll.rate * 100)}) · {roll.maturity}
                    </p>
                  )}
                  <pre className="mt-2 text-[11px] text-neutral-500 whitespace-pre-wrap break-words max-h-40 overflow-auto">
                    {typeof v.emails === "string" ? v.emails : JSON.stringify(v.emails, null, 2)}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>

        {/* Verdict */}
        {cmp && (
          <InsightCard tone={cmp.winner ? "good" : "neutral"}>
            <span className="font-medium text-neutral-100">{verdict}.</span> {cmp.reason}
            {cmp.pValue != null && <> (test: {cmp.test}, p = {cmp.pValue.toFixed(4)})</>}
          </InsightCard>
        )}

        {/* Technical detail, collapsed */}
        <details className="rounded-lg border border-neutral-800 bg-neutral-950/40">
          <summary className="cursor-pointer px-3 py-2 text-[11px] text-neutral-500">Technical detail (model reasoning, provider, cost)</summary>
          <div className="px-3 py-2 space-y-2 border-t border-neutral-800">
            <Field label="Strategist reasoning" value={e.strategistReasoning} small />
            <Field label="Reviewer critique" value={e.reviewerCritique} small />
            <Field label="Strategist revision" value={e.strategistRevision} small />
            <Field label="Final conclusion" value={e.finalConclusion} small />
            {e.modelRuns.length > 0 && (
              <div className="text-[11px] text-neutral-600">
                {e.modelRuns.map((r, i) => (
                  <div key={i} className="tabular-nums">
                    {r.purpose} · {r.provider}/{r.model} · {fmtInt(r.tokensIn)}+{fmtInt(r.tokensOut)} tok · {fmtGBP(r.costPence)} · {fmtDate(r.createdAt)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>

        {/* Original (pre-revision) proposal + revision note, when a revision ran */}
        {e.originalProposal != null ? (
          <details className="rounded-lg border border-neutral-800 bg-neutral-950/40">
            <summary className="cursor-pointer px-3 py-2 text-[11px] text-neutral-500">Original proposal (before revision) + what changed</summary>
            <div className="px-3 py-2 space-y-2 border-t border-neutral-800">
              <Field label="What the strategist changed and why" value={e.strategistRevision} small />
              <pre className="text-[10px] text-neutral-600 whitespace-pre-wrap break-words max-h-56 overflow-auto">{JSON.stringify(e.originalProposal, null, 2)}</pre>
            </div>
          </details>
        ) : (
          <p className="text-[11px] text-neutral-600">No revision was needed (the reviewer had no actionable objections).</p>
        )}

        <ExperimentReviewActions
          experimentId={e.id}
          status={e.status}
          reviewOutcome={e.reviewOutcome}
          feasible={feas?.feasible ?? null}
          sampleSize={e.sampleSize}
          allocationPct={e.allocationPct}
          primaryMetric={e.primaryMetric}
          challengerSteps={challengerSteps}
          targetKind={targetKind}
          targetDimension={tgt?.dimension}
          targetValues={tgt?.values}
        />
      </div>
    </details>
  );
}

function targetLabel(target: unknown): string {
  const t = target as { kind?: string; dimension?: string; values?: string[] } | null;
  if (!t) return "—";
  if (t.kind === "all_eligible") return "All eligible prospects";
  if (t.kind === "segment") return `Segment: ${t.dimension} = ${(t.values ?? []).join(", ")}`;
  // Legacy shape tolerance
  if (t.dimension) return `Segment: ${t.dimension} = ${(t.values ?? []).join(", ")}`;
  return "—";
}

async function Cycles() {
  const cycles = await listCycles();
  return (
    <Section title="Cycle history" subtitle="Every strategy cycle, successful and failed. Failed cycles keep their model runs for audit even though no experiment was created.">
      {cycles.length === 0 ? (
        <CardEmpty>No strategy cycles yet.</CardEmpty>
      ) : (
        <div className="space-y-2">
          {cycles.map((c) => {
            const cost = c.modelRuns.reduce((s, r) => s + r.costPence, 0);
            const failed = c.outcome !== "succeeded";
            return (
              <div key={c.id} className={`rounded-lg border px-3.5 py-2.5 ${failed ? "border-red-900/50 bg-red-950/10" : "border-neutral-800 bg-neutral-900"}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone={failed ? "bg-red-950 text-red-400 border border-red-900" : "bg-emerald-950 text-emerald-400 border border-emerald-900"}>{c.outcome}</Badge>
                  {c.failedStage && <span className="text-[11px] text-neutral-500">failed at: {c.failedStage}</span>}
                  <span className="text-[11px] text-neutral-600">{c.modelRuns.length} model call(s) · {fmtGBP(cost)} · {fmtDate(c.startedAt)}</span>
                  {c.experimentId ? <span className="text-[10px] text-neutral-600">experiment linked</span> : <span className="text-[10px] text-neutral-700">no experiment</span>}
                </div>
                {c.error && <p className="text-[11px] text-red-400/80 mt-1">{c.error}</p>}
                <div className="mt-1 text-[10px] text-neutral-600 tabular-nums">
                  {c.modelRuns.map((r, i) => (
                    <span key={i} className="mr-3">{r.purpose}:{r.provider}/{r.model}{r.promptVersion ? `@${r.promptVersion}` : ""} {r.tokensIn}+{r.tokensOut}t {fmtGBP(r.costPence)}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function FeasibilityBlock({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") return null;
  const f = data as { recommendedSample?: number; eligiblePopulation?: number; feasible?: boolean; note?: string };
  return (
    <InsightCard tone={f.feasible ? "neutral" : "watch"}>
      <span className="font-medium text-neutral-100">Sample feasibility: {f.feasible ? "feasible" : "not feasible right now"}.</span>{" "}
      Recommended {fmtInt(f.recommendedSample ?? 0)} · eligible population {fmtInt(f.eligiblePopulation ?? 0)}.
      {f.note ? ` ${f.note}` : ""}
    </InsightCard>
  );
}

function ReviewerFindings({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") return null;
  const r = data as {
    objections?: { category: string; severity: string; issue: string; recommendation: string }[];
    unsupportedPersonalisation?: string[];
    sampleSizeConcern?: string | null;
    suggestedBetterMetric?: string | null;
    alternativeInterpretation?: string | null;
  };
  const hasAny =
    (r.objections?.length ?? 0) > 0 ||
    (r.unsupportedPersonalisation?.length ?? 0) > 0 ||
    r.sampleSizeConcern ||
    r.suggestedBetterMetric ||
    r.alternativeInterpretation;
  if (!hasAny) return null;
  const sevTone: Record<string, string> = {
    high: "bg-red-950 text-red-400 border border-red-900",
    med: "bg-amber-950 text-amber-400 border border-amber-900",
    low: "bg-neutral-800 text-neutral-400",
  };
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">Reviewer findings</p>
      <div className="space-y-1.5">
        {(r.objections ?? []).map((o, i) => (
          <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <Badge tone={sevTone[o.severity] ?? sevTone.low}>{o.severity}</Badge>
              <span className="text-[11px] text-neutral-500 uppercase tracking-wide">{o.category}</span>
            </div>
            <p className="text-[12px] text-neutral-300 mt-1">{o.issue}</p>
            {o.recommendation && <p className="text-[11px] text-neutral-500 mt-0.5">Recommendation: {o.recommendation}</p>}
          </div>
        ))}
        {(r.unsupportedPersonalisation?.length ?? 0) > 0 && (
          <p className="text-[11px] text-amber-400">Unsupported personalisation flagged: {r.unsupportedPersonalisation!.join("; ")}</p>
        )}
        {r.sampleSizeConcern && <p className="text-[11px] text-neutral-500">Sample-size concern: {r.sampleSizeConcern}</p>}
        {r.suggestedBetterMetric && <p className="text-[11px] text-neutral-500">Suggested better metric: {r.suggestedBetterMetric}</p>}
        {r.alternativeInterpretation && <p className="text-[11px] text-neutral-500">Alternative interpretation: {r.alternativeInterpretation}</p>}
      </div>
    </div>
  );
}

function Field({ label, value, small = false }: { label: string; value: string | null; small?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">{label}</p>
      <p className={`${small ? "text-[11px]" : "text-[13px]"} text-neutral-300 whitespace-pre-wrap mt-0.5`}>{value}</p>
    </div>
  );
}

// ── Learnings ────────────────────────────────────────────────────────────────
async function Learnings() {
  const learnings = await listLearnings();
  return (
    <Section title="Learnings" subtitle="Evidence-tagged. A learning never becomes a fact without the evidence to back it.">
      {learnings.length === 0 ? (
        <CardEmpty>No learnings yet. They accrue from completed experiments, with their evidence and confidence.</CardEmpty>
      ) : (
        <div className="space-y-2">
          {learnings.map((l) => (
            <div key={l.id} className="rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <Badge tone={LEARNING_TONE[l.status] ?? "bg-neutral-800 text-neutral-400"}>{l.status}</Badge>
                {!l.stillActive && <Badge tone="bg-neutral-800 text-neutral-600">inactive</Badge>}
                <span className="text-[13px] text-neutral-200">{l.statement}</span>
              </div>
              <p className="text-[11px] text-neutral-600 mt-1">
                {l.segment ? `Segment: ${l.segment} · ` : ""}
                {l.metric ? `Metric: ${l.metric} · ` : ""}
                {l.sampleSize != null ? `Sample: ${fmtInt(l.sampleSize)} · ` : ""}
                {l.evidenceExperimentIds.length} experiment(s) · reviewed {fmtDate(l.lastReviewedAt)}
              </p>
              {l.evidenceSummary && <p className="text-[12px] text-neutral-500 mt-1">{l.evidenceSummary}</p>}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ── AI activity (technical, secondary) ───────────────────────────────────────
async function Activity() {
  const a = await getAiActivity();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Model runs" value={fmtInt(a.totalRuns)} />
        <KpiCard label="Est. AI cost" value={fmtGBP(a.totalCostPence)} />
        <KpiCard label="Tokens in" value={fmtInt(a.totalTokensIn)} />
        <KpiCard label="Tokens out" value={fmtInt(a.totalTokensOut)} />
      </div>
      <Section title="Recent AI runs" subtitle="Every strategist/reviewer/generation call, for cost and audit.">
        {a.recent.length === 0 ? (
          <CardEmpty>No AI runs yet.</CardEmpty>
        ) : (
          <TableShell head={["When", "Purpose", "Provider / model", "Tokens", "Cost"]}>
            {a.recent.map((r, i) => (
              <Tr key={i}>
                <Td first>{fmtDate(r.createdAt)}</Td>
                <Td muted>{r.purpose}</Td>
                <Td muted>{r.provider}/{r.model}</Td>
                <Td>{fmtInt(r.tokensIn)}+{fmtInt(r.tokensOut)}</Td>
                <Td>{fmtGBP(r.costPence)}</Td>
              </Tr>
            ))}
          </TableShell>
        )}
      </Section>
    </div>
  );
}
