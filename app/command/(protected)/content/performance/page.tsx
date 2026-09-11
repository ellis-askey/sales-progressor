import Link from "next/link";
import { getPerformance } from "@/lib/command/content/performance";
import { pillarLabel } from "@/lib/command/content/pillars";
import { isPosthogConfigured } from "@/lib/command/posthog-read";
import { UtmTagger } from "@/components/command/content/UtmTagger";
import { Section, KpiCard, TrackingDisabled } from "@/components/command/ui/primitives";

// Content performance (docs/active/content-brand/SPEC.md, Phase 6.2). Real logged
// numbers + honest empty states. Website attribution is gated on PostHog and on
// posting actually happening. Superadmin gating handled by the (protected) layout.

export const dynamic = "force-dynamic";

function pillarChip(label: string | null) {
  if (!label) return null;
  return <span className="rounded-full border border-neutral-700 bg-neutral-800/60 px-2 py-0.5 text-[10.5px] text-neutral-400">{label}</span>;
}

export default async function PerformancePage() {
  const perf = await getPerformance();
  const posthog = isPosthogConfigured();

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Performance</h1>
          <p className="mt-1 max-w-xl text-[13px] text-neutral-500">
            How your posts are doing, and which subjects earn the right attention. Real numbers only. The rest fills in
            as you publish and log results.
          </p>
        </div>
        <Link href="/command/content" className="shrink-0 text-xs text-neutral-500 transition-colors hover:text-neutral-300">
          ← Content
        </Link>
      </div>

      <Section title="So far">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard label="Published" value={String(perf.totals.published)} />
          <KpiCard label="With results logged" value={String(perf.totals.withEngagement)} sub={`of ${perf.totals.published}`} />
          <KpiCard label="Total engagement" value={String(perf.totals.totalEngagement)} sub="likes + comments + shares" />
        </div>
      </Section>

      {perf.byPillar.length > 0 && (
        <Section title="By pillar" subtitle="Which subjects earn engagement. A signal for what to lean into.">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-1.5">
            {perf.byPillar.map((p) => (
              <div key={p.pillar} className="flex items-center gap-3">
                <span className="w-44 shrink-0 text-[12px] text-neutral-400">{p.label}</span>
                <span className="text-[12px] tabular-nums text-neutral-500">{p.posts} post{p.posts === 1 ? "" : "s"}</span>
                <span className="ml-auto text-[13px] font-semibold tabular-nums text-neutral-200">{p.engagement}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Published posts">
        {perf.posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 px-4 py-8 text-center">
            <p className="text-sm text-neutral-300 font-medium">No published posts yet</p>
            <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-600">Mark a draft as posted and it shows up here, ready to log results against.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {perf.posts.map((p) => (
              <div key={p.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
                <p className="line-clamp-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-neutral-200">{p.text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
                  <span className="rounded border border-neutral-700 bg-neutral-800/60 px-1.5 py-0.5 text-neutral-400">{p.channel}</span>
                  {p.pillar ? pillarChip(pillarLabel(p.pillar)) : null}
                  {p.engagement ? (
                    <span className="tabular-nums text-neutral-400">
                      {p.engagement.likes} likes · {p.engagement.comments} comments · {p.engagement.shares} shares
                      {p.engagement.impressions != null ? ` · ${p.engagement.impressions} impressions` : ""}
                    </span>
                  ) : (
                    <Link href={`/command/content/engagement/${p.id}`} className="font-medium text-blue-400 hover:text-blue-300">Log results →</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Tag a link" subtitle="Make links in your posts attributable, so results can be tied back to a post.">
        <UtmTagger />
      </Section>

      <Section title="Website attribution" subtitle="Which posts bring the right visitors, and what they do next.">
        {posthog ? (
          <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 px-4 py-3 text-[13px] text-neutral-300">
            Website analytics are connected. Once tagged links start driving visits, this ties posts to visits, accounts
            and demos.
          </div>
        ) : (
          <TrackingDisabled
            what="Website attribution"
            why="Connect PostHog (POSTHOG_API_KEY + POSTHOG_PROJECT_ID) and share tagged links to see which subjects bring the right visitors and what they do next."
          />
        )}
      </Section>
    </div>
  );
}
