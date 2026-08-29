"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManualExperimentAction } from "@/app/actions/command-centre";
import { METRIC_DEFS, METRIC_KEYS } from "@/lib/command/experiment-metric-defs";

export function NewExperimentForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [metric, setMetric] = useState<string>("milestonesConfirmed");
  const [guardrail, setGuardrail] = useState<string>("");
  const [days, setDays] = useState(14);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await createManualExperimentAction({
          name,
          hypothesis,
          primaryMetric: metric,
          guardrailMetrics: guardrail ? [guardrail] : [],
          windowDays: days,
        });
        setName(""); setHypothesis(""); setGuardrail(""); setDays(14); setMetric("milestonesConfirmed");
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't create the test.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded-md bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-700 transition-colors"
      >
        + New test from scratch
      </button>
    );
  }

  const inputCls = "w-full text-xs bg-neutral-800 text-neutral-200 border border-neutral-700 rounded px-2.5 py-1.5 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500";

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 space-y-3">
      <div className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-[11px] text-neutral-500">What are you testing? (a short name)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Shorter welcome sheet" />
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] text-neutral-500">Hypothesis (what you&rsquo;ll change and what you expect)</span>
          <textarea value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} rows={2} className={inputCls} placeholder="If we shorten the welcome sheet, more clients will come back." />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="grid gap-1">
            <span className="text-[11px] text-neutral-500">Metric to watch</span>
            <select value={metric} onChange={(e) => setMetric(e.target.value)} className={inputCls}>
              {METRIC_KEYS.map((k) => <option key={k} value={k} className="bg-neutral-900">{METRIC_DEFS[k].label}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] text-neutral-500">Guardrail (optional)</span>
            <select value={guardrail} onChange={(e) => setGuardrail(e.target.value)} className={inputCls}>
              <option value="" className="bg-neutral-900">None</option>
              {METRIC_KEYS.map((k) => <option key={k} value={k} className="bg-neutral-900">{METRIC_DEFS[k].label}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] text-neutral-500">Before/after window (days)</span>
            <input type="number" min={7} max={60} value={days} onChange={(e) => setDays(Number(e.target.value))} className={inputCls} />
          </label>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <button onClick={submit} disabled={pending || !name.trim() || !hypothesis.trim()} className="text-xs px-3 py-1.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-900 hover:bg-emerald-900 transition-colors disabled:opacity-40">
          {pending ? "Creating…" : "Create proposed test"}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs px-2 py-1 text-neutral-500 hover:text-neutral-300 transition-colors">Cancel</button>
      </div>
    </div>
  );
}
