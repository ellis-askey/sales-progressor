import Link from "next/link";
import { VOICE_QUESTIONS } from "@/lib/command/content/voice-questions";
import { saveVoiceSamplesAction } from "@/app/actions/voice-samples";

export function VoiceIntakePanel({ error }: { error?: string }) {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-6 py-5">
        <p className="text-sm font-semibold text-neutral-200 mb-2">
          Before drafting can sound like you, we need a few voice samples.
        </p>
        <p className="text-xs text-neutral-500 leading-relaxed">
          Answer the questions below in your natural writing voice. Don&apos;t polish — rough and
          specific beats clean and generic. These answers will be used to calibrate every draft
          the AI generates on your behalf.
        </p>
      </div>

      {error === "empty" && (
        <p className="text-xs text-red-400 px-1">
          Please answer at least one question before submitting.
        </p>
      )}

      <form action={saveVoiceSamplesAction} className="space-y-6">
        {VOICE_QUESTIONS.map((q, i) => (
          <div key={q.key} className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-5">
            <label htmlFor={q.key} className="block mb-3">
              <span className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">
                Question {i + 1} of {VOICE_QUESTIONS.length}
              </span>
              <p className="text-sm font-medium text-neutral-200 mt-1 leading-snug">{q.text}</p>
            </label>
            <textarea
              id={q.key}
              name={q.key}
              rows={5}
              placeholder={q.placeholder}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 resize-y leading-relaxed"
            />
            <p className="text-[11px] text-neutral-600 mt-1.5">
              Don&apos;t polish — write the way you&apos;d say it.
            </p>
          </div>
        ))}

        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            className="text-sm px-5 py-2 bg-neutral-200 text-neutral-900 rounded-lg font-medium hover:bg-white transition-colors"
          >
            Save voice samples
          </button>
          <p className="text-[11px] text-neutral-600">
            You can edit or add more samples anytime at{" "}
            <Link href="/command/content/voice" className="underline underline-offset-2 hover:text-neutral-400 transition-colors">
              /content/voice
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
