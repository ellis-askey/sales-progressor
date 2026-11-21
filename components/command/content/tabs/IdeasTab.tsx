import { ParamTabs } from "@/components/command/ui/primitives";
import { getInboxBoard } from "@/lib/command/content/inbox";
import { InboxList } from "@/components/command/content/InboxList";
import { getOpportunitiesBoard } from "@/lib/command/content/opportunities";
import { OpportunitiesList } from "@/components/command/content/OpportunitiesList";
import { getThoughtsBoard } from "@/lib/command/content/thoughts";
import { ThoughtsPanel } from "@/components/command/content/ThoughtsPanel";
import { commandDb } from "@/lib/command/prisma";
import {
  addTopicAction,
  skipTopicAction,
  prioritiseTopicAction,
  deleteTopicAction,
  restoreTopicAction,
} from "@/app/actions/content-topics";

// Content workspace → Ideas tab. Consolidates the four idea *inputs* that all
// feed Create — inbox (AI signals), opportunities (reputation moves), thoughts
// (raw opinions), topics (queue) — into one tab with an addressable secondary
// strip (?source=). Only the active source's loader runs (lazy), so this is no
// heavier than opening one of the former pages. Each source renders the exact
// existing component + loader + write path; nothing here is new behaviour.

const IDEA_SOURCES = [
  { key: "inbox", label: "Inbox" },
  { key: "opportunities", label: "Opportunities" },
  { key: "thoughts", label: "Thoughts" },
  { key: "topics", label: "Topics" },
] as const;
type IdeaSource = (typeof IDEA_SOURCES)[number]["key"];

export async function IdeasTab({ source }: { source?: string }) {
  const active: IdeaSource = (IDEA_SOURCES.some((s) => s.key === source) ? source : "inbox") as IdeaSource;
  const hrefFor = (s: string) => `/command/content?tab=ideas&source=${s}`;

  return (
    <div className="space-y-6">
      <ParamTabs options={[...IDEA_SOURCES]} active={active} hrefFor={hrefFor} />
      {active === "inbox" && <InboxView />}
      {active === "opportunities" && <OpportunitiesView />}
      {active === "thoughts" && <ThoughtsView />}
      {active === "topics" && <TopicsView />}
    </div>
  );
}

async function InboxView() {
  const board = await getInboxBoard();
  return (
    <div className="space-y-4">
      <p className="max-w-xl text-[13px] text-neutral-500">
        Real things worth talking about, pulled from your data, your activity and your saved thoughts. Each comes with
        why it&rsquo;s interesting and a few different angles. Nothing here is a finished post. Pick what you agree is
        worth saying.
      </p>
      <InboxList
        board={{
          fresh: board.fresh.map(serialiseInbox),
          saved: board.saved.map(serialiseInbox),
          counts: board.counts,
        }}
      />
    </div>
  );
}

async function OpportunitiesView() {
  const board = await getOpportunitiesBoard();
  return (
    <div className="space-y-4">
      <p className="max-w-xl text-[13px] text-neutral-500">
        Bigger moves that build your reputation, not just the next post: a position to establish, an article or series
        to start, a case study, a press or podcast angle. Grounded in your brand, never invented.
      </p>
      <OpportunitiesList
        board={{
          open: board.open.map(serialiseOpportunity),
          pursuing: board.pursuing.map(serialiseOpportunity),
          counts: board.counts,
        }}
      />
    </div>
  );
}

async function ThoughtsView() {
  const board = await getThoughtsBoard();
  return (
    <div className="space-y-4">
      <p className="max-w-xl text-[13px] text-neutral-500">
        Save the half-formed opinions and observations you have during the day. They don&rsquo;t need to look like
        posts. We&rsquo;ll bring them back when there&rsquo;s a real reason to say them.
      </p>
      <ThoughtsPanel
        board={{
          open: board.open.map(serialiseThought),
          used: board.used.map(serialiseThought),
          archived: board.archived.map(serialiseThought),
          counts: board.counts,
        }}
      />
    </div>
  );
}

async function TopicsView() {
  const [pending, skipped] = await Promise.all([
    commandDb.contentTopic.findMany({
      where: { status: "pending" },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    }),
    commandDb.contentTopic.findMany({
      where: { status: "skipped" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-10 max-w-2xl">
      {/* Add manual topic */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Add a topic</h2>
        <form action={addTopicAction} className="flex gap-2">
          <input
            type="text"
            name="text"
            placeholder="A specific topic idea — the more concrete the better"
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
            required
          />
          <button
            type="submit"
            className="text-sm px-4 py-2 bg-neutral-200 text-neutral-900 rounded-lg font-medium hover:bg-white transition-colors shrink-0"
          >
            Add
          </button>
        </form>
      </section>

      {/* Pending topics */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Pending ({pending.length})</h2>

        {pending.length === 0 && (
          <p className="text-xs text-neutral-600">No topics queued. Add one above or wait for the overnight activity scan.</p>
        )}

        <div className="space-y-2">
          {pending.map((t) => (
            <div key={t.id} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-200 leading-snug">{t.text}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-semibold bg-neutral-800 text-neutral-600 px-1.5 py-0.5 rounded">
                    {t.source === "activity_derived" ? "from activity" : "manual"}
                  </span>
                  {t.priority > 0 && <span className="text-[10px] text-amber-500">priority +{t.priority}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <form action={prioritiseTopicAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" title="Bump priority" className="text-[11px] text-neutral-600 hover:text-amber-400 px-1.5 py-1 transition-colors">↑</button>
                </form>
                <form action={skipTopicAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className="text-[11px] text-neutral-600 hover:text-neutral-300 px-1.5 py-1 transition-colors">Skip</button>
                </form>
                <form action={deleteTopicAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className="text-[11px] text-neutral-600 hover:text-red-400 px-1.5 py-1 transition-colors">Delete</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Skipped */}
      {skipped.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Skipped ({skipped.length})</h2>
          <div className="space-y-2">
            {skipped.map((t) => (
              <div key={t.id} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 flex items-center gap-3 opacity-50">
                <p className="text-sm text-neutral-400 flex-1 leading-snug line-clamp-1">{t.text}</p>
                <div className="flex gap-1 shrink-0">
                  <form action={restoreTopicAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="text-[11px] text-neutral-600 hover:text-neutral-300 px-1.5 py-1 transition-colors">Restore</button>
                  </form>
                  <form action={deleteTopicAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="text-[11px] text-neutral-600 hover:text-red-400 px-1.5 py-1 transition-colors">Delete</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Serialisers (verbatim from the former pages) ─────────────────────────────

function serialiseInbox(it: {
  id: string; sourceType: string; observation: string; whyInteresting: string; brandFit: string | null;
  reachReason: string | null; claimClass: string; likelyAudience: string[];
  suggestedAngles: { angle: string; point: string }[]; evidence: Record<string, unknown> | null; freshnessAt: Date; status: string;
}) {
  return {
    id: it.id,
    sourceType: it.sourceType,
    observation: it.observation,
    whyInteresting: it.whyInteresting,
    brandFit: it.brandFit,
    reachReason: it.reachReason,
    claimClass: it.claimClass,
    likelyAudience: it.likelyAudience,
    suggestedAngles: it.suggestedAngles,
    evidence: it.evidence,
    freshnessAt: it.freshnessAt.toISOString(),
    status: it.status,
  };
}

function serialiseOpportunity(o: {
  id: string; kind: string; title: string; rationale: string; suggestedAction: string;
  audience: string[]; effort: string | null; horizon: string | null; brandFit: string | null; claimClass: string; status: string;
}) {
  return {
    id: o.id,
    kind: o.kind,
    title: o.title,
    rationale: o.rationale,
    suggestedAction: o.suggestedAction,
    audience: o.audience,
    effort: o.effort,
    horizon: o.horizon,
    brandFit: o.brandFit,
    claimClass: o.claimClass,
    status: o.status,
  };
}

function serialiseThought(t: {
  id: string; createdAt: Date; body: string; topic: string | null; source: string; status: string;
}) {
  return {
    id: t.id,
    createdAt: t.createdAt.toISOString(),
    body: t.body,
    topic: t.topic,
    source: t.source,
    status: t.status,
  };
}
