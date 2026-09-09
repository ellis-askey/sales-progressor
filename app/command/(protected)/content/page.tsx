import Link from "next/link";
import { getContentOverview } from "@/lib/command/content/overview";
import { Section, KpiCard, InsightCard, TrackingDisabled } from "@/components/command/ui/primitives";

// Content overview (docs/active/content-brand/SPEC.md, Phase 1.5). The landing
// for the Content area: a compact, honest operational summary, a single primary
// action, and the few things most worth saying right now. No vanity charts.
// Superadmin gating handled by the (protected) layout.

export const dynamic = "force-dynamic";

function agoLabel(d: Date | null): string {
  if (!d) return "nothing posted yet";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return "posted today";
  if (days === 1) return "posted yesterday";
  if (days < 14) return `last posted ${days} days ago`;
  const weeks = Math.round(days / 7);
  return `last posted ${weeks} weeks ago`;
}

export default async function ContentOverviewPage() {
  const o = await getContentOverview(new Date());

  const quiet = o.published.last28 === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Content</h1>
          <p className="mt-1 max-w-xl text-[13px] text-neutral-500">
            What&rsquo;s worth saying, and where things stand. Start from something real.
          </p>
        </div>
        <Link
          href="/command/content/create"
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-500"
        >
          Create something
        </Link>
      </div>

      <Section title="Where things stand">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Link href="/command/content/inbox"><KpiCard label="Ideas in inbox" value={String(o.inbox.fresh)} accent={o.inbox.fresh > 0} sub={o.inbox.saved > 0 ? `${o.inbox.saved} saved` : undefined} /></Link>
          <Link href="/command/content/thoughts"><KpiCard label="Your thoughts" value={String(o.thoughtsOpen)} sub="open" /></Link>
          <Link href="/command/content/drafts"><KpiCard label="Ready to send" value={String(o.readyToSend)} sub="in batch" /></Link>
          <KpiCard label="Published" value={String(o.published.thisWeek)} sub="this week" />
          <KpiCard label="Published" value={String(o.published.last28)} sub="last 4 weeks" />
          <KpiCard label="Cadence" value={quiet ? "Quiet" : "Active"} sub={agoLabel(o.lastPostedAt)} />
        </div>
      </Section>

      {quiet && (
        <InsightCard tone="watch">
          You haven&rsquo;t posted in the last 4 weeks. One genuine take is enough to restart. Open the inbox and pick
          something you actually agree with.
        </InsightCard>
      )}

      <Section title="Worth saying right now" subtitle="The freshest things from your inbox. Draft the one you agree with.">
        {o.opportunities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 px-4 py-8 text-center">
            <p className="text-sm text-neutral-300 font-medium">Nothing in the inbox yet</p>
            <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-600">
              Open the inbox and hit Refresh to surface real things worth talking about from your data and activity.
            </p>
            <Link href="/command/content/inbox" className="mt-3 inline-block text-[12px] font-medium text-blue-400 hover:text-blue-300">
              Open the inbox →
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {o.opportunities.map((op) => (
              <Link
                key={op.id}
                href={`/command/content/create?item=${op.id}`}
                className="block rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700"
              >
                <p className="text-[14px] font-medium leading-snug text-neutral-100">{op.observation}</p>
                {op.whyInteresting && <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-500">{op.whyInteresting}</p>}
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Scheduling">
        <TrackingDisabled
          what="Automatic scheduling"
          why="Posts are prepared here and you publish them yourself for now. Scheduling and autopilot arrive once the publishing integration is connected."
        />
      </Section>
    </div>
  );
}
