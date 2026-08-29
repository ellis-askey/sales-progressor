"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createExperimentFromSuggestionAction,
  generateAiExperimentIdeasAction,
} from "@/app/actions/command-centre";
import { metricLabel } from "@/lib/command/experiment-metric-defs";
import type { ExperimentSuggestion } from "@/lib/command/experiment-suggestions";

export function ExperimentSuggestions({ initial }: { initial: ExperimentSuggestion[] }) {
  const router = useRouter();
  const [aiIdeas, setAiIdeas] = useState<ExperimentSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function askAi() {
    setAiLoading(true);
    setAiError(null);
    try {
      const ideas = await generateAiExperimentIdeasAction();
      if (ideas.length === 0) setAiError("Couldn't think of a fresh one just now. Try again in a moment.");
      // Namespace ids so AI ideas never collide with catalogue ones.
      setAiIdeas(ideas.map((idea, i) => ({ ...idea, id: `ai-${Date.now()}-${i}` })));
    } catch {
      setAiError("Couldn't reach the idea generator just now.");
    } finally {
      setAiLoading(false);
    }
  }

  function propose(s: ExperimentSuggestion) {
    setPendingId(s.id);
    startTransition(async () => {
      try {
        await createExperimentFromSuggestionAction({
          title: s.title,
          change: s.change,
          why: s.why,
          metricKey: s.metricKey,
          guardrailKeys: s.guardrailKeys,
          durationDays: s.durationDays,
          source: s.source,
        });
        setProposed((prev) => new Set(prev).add(s.id));
        router.refresh();
      } finally {
        setPendingId(null);
      }
    });
  }

  const all = [...initial, ...aiIdeas];

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
          Ideas worth testing · {all.length}
        </h2>
        <button
          onClick={askAi}
          disabled={aiLoading}
          className="text-xs px-3 py-1.5 rounded-md bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-700 transition-colors disabled:opacity-40"
        >
          {aiLoading ? "Thinking…" : "Ask AI for a fresh idea"}
        </button>
      </div>

      {aiError && <p className="text-xs text-amber-500/90 mb-3">{aiError}</p>}

      {all.length === 0 ? (
        <p className="text-sm text-neutral-600">
          No stand-out opportunities in the data right now. Try &ldquo;Ask AI for a fresh idea&rdquo;, or add your own below.
        </p>
      ) : (
        <div className="space-y-3">
          {all.map((s) => {
            const isProposed = proposed.has(s.id);
            return (
              <div key={s.id} className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.source === "ai" ? "bg-violet-950 text-violet-300 border border-violet-900" : "bg-neutral-800 text-neutral-400"}`}>
                        {s.source === "ai" ? "AI idea" : s.category}
                      </span>
                      <h3 className="text-sm font-semibold text-neutral-100">{s.title}</h3>
                    </div>
                    <p className="text-xs text-neutral-300 mt-1.5">{s.change}</p>
                    <p className="text-xs text-neutral-500 mt-1">{s.why}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-neutral-500">
                      <span><span className="text-neutral-600">We&rsquo;d watch </span>{metricLabel(s.metricKey)}</span>
                      {s.guardrailKeys.length > 0 && (
                        <span><span className="text-neutral-600">Guardrail </span>{s.guardrailKeys.map(metricLabel).join(", ")}</span>
                      )}
                      <span><span className="text-neutral-600">Run for </span>{s.durationDays} days</span>
                    </div>
                  </div>
                  <button
                    onClick={() => propose(s)}
                    disabled={isProposed || pendingId === s.id}
                    className="text-xs px-2.5 py-1 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-900 hover:bg-emerald-900 transition-colors disabled:opacity-40 shrink-0"
                  >
                    {isProposed ? "Proposed ✓" : pendingId === s.id ? "…" : "Propose this test"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
