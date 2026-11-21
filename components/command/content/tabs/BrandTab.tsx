import { ParamTabs } from "@/components/command/ui/primitives";
import { Section } from "@/components/command/ui/primitives";
import { commandDb } from "@/lib/command/prisma";
import { aiEnabled } from "@/lib/ai/enabled";
import { getBrandProfile, getBrandMemory } from "@/lib/command/content/brand";
import { getBalance } from "@/lib/command/content/balance";
import { getLatestReview } from "@/lib/command/content/strategy-review";
import { BrandPositioning } from "@/components/command/content/BrandPositioning";
import { BrandMemoryManager } from "@/components/command/content/BrandMemoryManager";
import { QuarterFocusEditor } from "@/components/command/content/QuarterFocusEditor";
import { ContentBalance } from "@/components/command/content/ContentBalance";
import { BrandReviewPanel } from "@/components/command/content/BrandReviewPanel";
import { VOICE_QUESTIONS } from "@/lib/command/content/voice-questions";
import { getVoiceProfile, MIN_EDITS } from "@/lib/command/content/voice-learning";
import { VoiceLearningPanel } from "@/components/command/content/VoiceLearningPanel";
import { addVoiceSampleAction, deleteVoiceSampleAction } from "@/app/actions/voice-samples";

// Content workspace → Brand tab. Consolidates the three identity/guardrail
// surfaces as addressable secondary views (?view=): Positioning (brand profile +
// memory), Strategy (quarter focus + balance + AI brand review), Voice (voice
// samples + learned profile). Each view is verbatim from its former page; each
// keeps its own AI gate; only the active view's loaders run.

const BRAND_VIEWS = [
  { key: "positioning", label: "Positioning" },
  { key: "strategy", label: "Strategy" },
  { key: "voice", label: "Voice" },
] as const;
type BrandView = (typeof BRAND_VIEWS)[number]["key"];

export async function BrandTab({ view, error }: { view?: string; error?: string }) {
  const active: BrandView = (BRAND_VIEWS.some((v) => v.key === view) ? view : "positioning") as BrandView;
  const hrefFor = (v: string) => `/command/content?tab=brand&view=${v}`;

  return (
    <div className="space-y-6">
      <ParamTabs options={[...BRAND_VIEWS]} active={active} hrefFor={hrefFor} />
      {active === "positioning" && <PositioningView />}
      {active === "strategy" && <StrategyView />}
      {active === "voice" && <VoiceView error={error} />}
    </div>
  );
}

// ── Positioning: brand profile + memory (the never-invent backbone) ──────────
async function PositioningView() {
  const [profile, memory] = await Promise.all([getBrandProfile(), getBrandMemory()]);
  return (
    <div className="space-y-8">
      <p className="max-w-xl text-[13px] text-neutral-500">
        Who you are publicly, and the things we know are genuinely true about how you think and speak. The content
        engine never invents any of this. It only works from what&rsquo;s here.
      </p>
      <Section title="Positioning" subtitle="A short, honest statement of who you are and what you want to be known for.">
        <BrandPositioning profile={profile} />
      </Section>
      <Section
        title="Brand memory"
        subtitle="Opinions, phrases, expertise and no-go topics. Each is classified so nothing unverified ever reads as fact."
      >
        <BrandMemoryManager
          entries={memory.map((m) => ({
            id: m.id,
            createdAt: m.createdAt.toISOString(),
            kind: m.kind,
            body: m.body,
            claimClass: m.claimClass,
            status: m.status,
            source: m.source,
          }))}
        />
      </Section>
    </div>
  );
}

// ── Strategy: quarter focus + balance + AI brand review ──────────────────────
async function StrategyView() {
  const [balance, profile, review] = await Promise.all([getBalance(), getBrandProfile(), getLatestReview()]);
  const aiOn = await aiEnabled(); // AI master switch (#291): hide the AI "Brand review" section when off
  return (
    <div className="space-y-8">
      <p className="max-w-xl text-[13px] text-neutral-500">
        What you want to be known for, the shape of what you&rsquo;re publishing, and an honest read of where your brand
        stands.
      </p>
      <Section title="This quarter" subtitle="What you want to be known for right now. Steers your review and your opportunities.">
        <QuarterFocusEditor initial={profile?.quarterFocus ?? ""} />
      </Section>
      <Section title="Balance" subtitle="The recent mix across your content pillars. A guide, not a rigid calendar.">
        <ContentBalance balance={balance} />
      </Section>
      {aiOn && (
        <Section title="Brand review" subtitle="A PR consultant's read of where your brand stands and where to lean next.">
          <BrandReviewPanel
            initial={
              review
                ? {
                    id: review.id,
                    createdAt: review.createdAt.toISOString(),
                    summary: review.summary,
                    leanInto: review.leanInto,
                    overused: review.overused,
                    breakout: review.breakout,
                    underusedExpertise: review.underusedExpertise,
                  }
                : null
            }
          />
        </Section>
      )}
    </div>
  );
}

// ── Voice: learned profile + intake Q&A + manual samples ─────────────────────
async function VoiceView({ error }: { error?: string }) {
  const [samples, profile] = await Promise.all([
    commandDb.voiceSample.findMany({ orderBy: { createdAt: "desc" } }),
    getVoiceProfile(),
  ]);
  const aiOn = await aiEnabled(); // AI master switch (#291): hide the AI "Learned from your edits" section when off

  const answeredKeys = new Set(samples.filter((s) => s.sampleType === "qa_response").map((s) => s.questionKey));
  const qaAnswers = samples.filter((s) => s.sampleType === "qa_response");
  const manualSamples = samples.filter((s) => s.sampleType !== "qa_response");

  return (
    <div className="space-y-10 max-w-2xl">
      {aiOn && (
        <section className="space-y-4">
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Learned from your edits</h2>
          <VoiceLearningPanel
            initial={{
              characteristics: profile.characteristics,
              generatedAt: profile.generatedAt ? profile.generatedAt.toISOString() : null,
              sampleCount: profile.sampleCount,
              totalEdits: profile.totalEdits,
            }}
            minEdits={MIN_EDITS}
          />
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
          Intake questions ({answeredKeys.size} / {VOICE_QUESTIONS.length} answered)
        </h2>
        {VOICE_QUESTIONS.map((q, i) => {
          const answer = qaAnswers.find((s) => s.questionKey === q.key);
          return (
            <div key={q.key} className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-1">Question {i + 1}</p>
                  <p className="text-sm font-medium text-neutral-300 leading-snug mb-2">{q.text}</p>
                  {answer ? (
                    <p className="text-xs text-neutral-400 leading-relaxed whitespace-pre-wrap">{answer.content}</p>
                  ) : (
                    <p className="text-xs text-neutral-600 italic">Not answered yet</p>
                  )}
                </div>
                {answer && (
                  <form action={deleteVoiceSampleAction} className="shrink-0">
                    <input type="hidden" name="id" value={answer.id} />
                    <button type="submit" className="text-[11px] text-neutral-600 hover:text-red-400 transition-colors">Delete</button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Manual samples ({manualSamples.length})</h2>
        {manualSamples.length === 0 && <p className="text-xs text-neutral-600">No manual samples added yet.</p>}
        {manualSamples.map((s) => (
          <div key={s.id} className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-semibold bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded">
                    {s.sampleType === "manual_paste" ? "paste" : s.sampleType}
                  </span>
                  {s.notes && <span className="text-[11px] text-neutral-600 truncate">{s.notes}</span>}
                  <span className="text-[11px] text-neutral-700 ml-auto shrink-0">
                    {new Date(s.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed whitespace-pre-wrap line-clamp-6">{s.content}</p>
              </div>
              <form action={deleteVoiceSampleAction} className="shrink-0">
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" className="text-[11px] text-neutral-600 hover:text-red-400 transition-colors">Delete</button>
              </form>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Add a sample</h2>
        <p className="text-xs text-neutral-600 leading-relaxed">
          Paste a post you wrote, an email, a tweet — anything in your natural voice. The more samples exist, the better
          the AI can match how you write.
        </p>
        {error === "empty" && <p className="text-xs text-red-400 px-1">Content cannot be empty.</p>}
        <form action={addVoiceSampleAction} className="space-y-3">
          <textarea
            name="content"
            rows={6}
            placeholder="Paste a post, email, or anything you wrote in your own voice…"
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 resize-y leading-relaxed"
          />
          <input
            type="text"
            name="notes"
            placeholder={`Optional note (e.g. "LinkedIn post, June 2025")`}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
          />
          <button type="submit" className="text-sm px-5 py-2 bg-neutral-200 text-neutral-900 rounded-lg font-medium hover:bg-white transition-colors">
            Save sample
          </button>
        </form>
      </section>
    </div>
  );
}
