"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { findAgentsAction } from "@/app/actions/outreach";
import { processNextImportItemAction } from "@/app/actions/prospects";

// "Find agents" on an approved experiment: discover UK estate agents we don't
// already hold (Claude web search), then drive the existing enrichment pipeline
// that researches + dedupes + adds each to prospects. Launch (below) then sends
// the flow to them. Runs while open; the drain cron finishes anything left if the
// tab is closed. Discovery + per-agency research take time, so this is a
// progress-tracked background job, not an instant click.
export function FindAgentsPanel() {
  const router = useRouter();
  const [area, setArea] = useState("");
  const [count, setCount] = useState(25);
  const [phase, setPhase] = useState<"idle" | "searching" | "adding" | "done" | "error">("idle");
  const [found, setFound] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPhase("searching");
    setError(null);
    setFound(0);
    setProcessed(0);
    const res = await findAgentsAction(area, count);
    if (!res.ok) {
      setError(res.error);
      setPhase("error");
      return;
    }
    setFound(res.found);
    setPhase("adding");
    // Enrich + add each discovered agency, one per call (each does a web-search
    // research pass). The drain cron backstops if this tab closes.
    let done = false;
    let guard = res.found + 5;
    while (!done && guard-- > 0) {
      try {
        const step = await processNextImportItemAction(res.batchId);
        setProcessed(res.found - step.remaining);
        done = step.done;
      } catch {
        break; // the cron will finish the rest
      }
    }
    setPhase("done");
    router.refresh();
  }

  const busy = phase === "searching" || phase === "adding";

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3.5">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-1">Find agents</p>
      <p className="text-[11.5px] text-neutral-500 mb-3">
        Search for UK estate agents in an area, skip any you already hold, and add the rest to prospects. Then launch below to start the flow.
      </p>

      <div className="flex items-end gap-2 flex-wrap">
        <label className="flex-1 min-w-[160px]">
          <span className="block text-[10px] uppercase tracking-wide text-neutral-600 mb-1">Area</span>
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            disabled={busy}
            placeholder="e.g. Kent, or Leeds"
            className="w-full text-[12.5px] bg-neutral-900 border border-neutral-800 rounded-md px-2.5 py-1.5 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 disabled:opacity-50"
          />
        </label>
        <label>
          <span className="block text-[10px] uppercase tracking-wide text-neutral-600 mb-1">How many</span>
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 25)))}
            disabled={busy}
            className="w-20 text-[12.5px] bg-neutral-900 border border-neutral-800 rounded-md px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-neutral-600 disabled:opacity-50"
          />
        </label>
        <button
          type="button"
          onClick={run}
          disabled={busy || !area.trim()}
          className="text-[12px] font-semibold px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {phase === "searching" ? "Searching…" : phase === "adding" ? "Adding…" : "Find agents"}
        </button>
      </div>

      {phase === "adding" && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1">
            <span>Found {found}, adding them to prospects</span>
            <span className="tabular-nums">{processed}/{found}</span>
          </div>
          <div className="h-1.5 rounded bg-neutral-800 overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${found ? Math.round((processed / found) * 100) : 0}%` }} />
          </div>
          <p className="mt-1.5 text-[10.5px] text-neutral-600">This keeps running in the background if you close the tab.</p>
        </div>
      )}

      {phase === "done" && (
        <p className="mt-3 text-[12px] text-emerald-400">
          {found} agent{found === 1 ? "" : "s"} added to prospects{processed < found ? ` (${found - processed} still finishing in the background)` : ""}. Launch below to start the flow.
        </p>
      )}

      {phase === "error" && error && <p className="mt-3 text-[12px] text-red-400">{error}</p>}
    </div>
  );
}
