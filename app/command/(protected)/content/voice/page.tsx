import Link from "next/link";
import { commandDb } from "@/lib/command/prisma";
import { VOICE_QUESTIONS } from "@/lib/command/content/voice-questions";
import {
  addVoiceSampleAction,
  deleteVoiceSampleAction,
} from "@/app/actions/voice-samples";

export default async function VoicePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  const samples = await commandDb.voiceSample.findMany({
    orderBy: { createdAt: "desc" },
  });

  const answeredKeys = new Set(
    samples.filter((s) => s.sampleType === "qa_response").map((s) => s.questionKey)
  );

  const qaAnswers = samples.filter((s) => s.sampleType === "qa_response");
  const manualSamples = samples.filter((s) => s.sampleType !== "qa_response");

  return (
    <div className="space-y-10 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-100">Voice samples</h1>
        <Link
          href="/command/content"
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          ← Back to content
        </Link>
      </div>

      {/* Q&A answers */}
      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
          Intake questions ({answeredKeys.size} / {VOICE_QUESTIONS.length} answered)
        </h2>

        {VOICE_QUESTIONS.map((q, i) => {
          const answer = qaAnswers.find((s) => s.questionKey === q.key);
          return (
            <div
              key={q.key}
              className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-1">
                    Question {i + 1}
                  </p>
                  <p className="text-sm font-medium text-neutral-300 leading-snug mb-2">
                    {q.text}
                  </p>
                  {answer ? (
                    <p className="text-xs text-neutral-400 leading-relaxed whitespace-pre-wrap">
                      {answer.content}
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-600 italic">Not answered yet</p>
                  )}
                </div>
                {answer && (
                  <form action={deleteVoiceSampleAction} className="shrink-0">
                    <input type="hidden" name="id" value={answer.id} />
                    <button
                      type="submit"
                      className="text-[11px] text-neutral-600 hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Manual samples */}
      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
          Manual samples ({manualSamples.length})
        </h2>

        {manualSamples.length === 0 && (
          <p className="text-xs text-neutral-600">No manual samples added yet.</p>
        )}

        {manualSamples.map((s) => (
          <div
            key={s.id}
            className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-semibold bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded">
                    {s.sampleType === "manual_paste" ? "paste" : s.sampleType}
                  </span>
                  {s.notes && (
                    <span className="text-[11px] text-neutral-600 truncate">{s.notes}</span>
                  )}
                  <span className="text-[11px] text-neutral-700 ml-auto shrink-0">
                    {new Date(s.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed whitespace-pre-wrap line-clamp-6">
                  {s.content}
                </p>
              </div>
              <form action={deleteVoiceSampleAction} className="shrink-0">
                <input type="hidden" name="id" value={s.id} />
                <button
                  type="submit"
                  className="text-[11px] text-neutral-600 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
      </section>

      {/* Add manual sample */}
      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
          Add a sample
        </h2>
        <p className="text-xs text-neutral-600 leading-relaxed">
          Paste a post you wrote, an email, a tweet — anything in your natural voice. The more
          samples exist, the better the AI can match how you write.
        </p>

        {sp.error === "empty" && (
          <p className="text-xs text-red-400 px-1">Content cannot be empty.</p>
        )}

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
          <button
            type="submit"
            className="text-sm px-5 py-2 bg-neutral-200 text-neutral-900 rounded-lg font-medium hover:bg-white transition-colors"
          >
            Save sample
          </button>
        </form>
      </section>
    </div>
  );
}
