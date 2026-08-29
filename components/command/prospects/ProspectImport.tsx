"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createImportBatchAction, processNextImportItemAction, getImportBatchAction, retryImportItemAction,
} from "@/app/actions/prospects";
import type { ImportBatchView } from "@/lib/command/prospects";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "Queued", cls: "bg-neutral-800 text-neutral-400 border-neutral-700" },
  researching: { label: "Researching…", cls: "bg-violet-950 text-violet-300 border-violet-900" },
  imported: { label: "Imported", cls: "bg-emerald-950 text-emerald-300 border-emerald-900" },
  needs_review: { label: "Review required", cls: "bg-amber-950 text-amber-300 border-amber-900" },
  exists: { label: "Already exists", cls: "bg-neutral-800 text-neutral-500 border-neutral-700" },
  failed: { label: "Failed", cls: "bg-red-950 text-red-400 border-red-900" },
};

export function ProspectImport() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [batch, setBatch] = useState<ImportBatchView | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  async function runLoop(batchId: string) {
    setRunning(true);
    while (!cancelled.current) {
      const r = await processNextImportItemAction(batchId);
      const view = await getImportBatchAction(batchId);
      if (view) setBatch(view);
      if (r.done) break;
    }
    setRunning(false);
    router.refresh();
  }

  async function start() {
    setError(null);
    const res = await createImportBatchAction(raw);
    if (!res.ok) { setError(res.error); return; }
    cancelled.current = false;
    const first = await getImportBatchAction(res.batchId);
    setBatch(first);
    void runLoop(res.batchId);
  }

  async function retry(itemId: string, batchId: string) {
    await retryImportItemAction(itemId);
    const view = await getImportBatchAction(batchId);
    if (view) setBatch(view);
    cancelled.current = false;
    void runLoop(batchId);
  }

  function reset() { cancelled.current = true; setBatch(null); setRaw(""); setError(null); setRunning(false); }

  const lineCount = raw.split(/\r?\n/).filter((l) => l.trim()).length;

  if (!batch) {
    return (
      <div className="max-w-2xl space-y-3">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-200">Import a batch</h2>
          <p className="text-[12px] text-neutral-500">One agency per line, as <span className="text-neutral-300">Name | Location</span> (location optional). We research each, skip duplicates, and add branches to the right business. Up to 15 at a time.</p>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={8}
            placeholder={"99home | London\nBloggs Estates | Hertford\nABC Estates | Ware"}
            className="w-full text-xs bg-[#0a0a0a] border border-[#262626] rounded-lg px-3 py-2 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#2563eb] font-mono"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center gap-3">
            <button onClick={start} disabled={lineCount === 0} className="text-xs px-3 py-1.5 rounded-md bg-blue-600/20 text-blue-300 border border-blue-600/40 hover:bg-blue-600/30 transition-colors disabled:opacity-40">
              Research + import {lineCount > 0 ? `(${Math.min(lineCount, 15)})` : ""}
            </button>
            {lineCount > 15 && <span className="text-[11px] text-amber-400/80">Only the first 15 will run this batch.</span>}
          </div>
          <p className="text-[11px] text-neutral-600">Keep this tab open while it runs (about a minute per agency). It picks up where it left off if interrupted.</p>
        </div>
      </div>
    );
  }

  const done = batch.items.filter((i) => ["imported", "needs_review", "exists", "failed"].includes(i.status)).length;
  const count = (s: string) => batch.items.filter((i) => i.status === s).length;
  const allDone = !running && done === batch.items.length;

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-neutral-300">
          {running ? <span className="text-violet-300">Processing… {done}/{batch.items.length}</span> : <span>Done · {done}/{batch.items.length}</span>}
        </div>
        <button onClick={reset} className="text-[11px] text-neutral-500 hover:text-neutral-300">New import</button>
      </div>

      {allDone && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-200">
          {count("imported")} imported · {count("needs_review")} need review · {count("exists")} already existed · {count("failed")} failed
        </div>
      )}

      <div className="space-y-1.5">
        {batch.items.map((i) => {
          const meta = STATUS_META[i.status] ?? STATUS_META.pending;
          return (
            <div key={i.id} className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-neutral-200 truncate">{i.agencyName ?? i.inputAgency}{i.inputLocation ? <span className="text-neutral-600"> · {i.inputLocation}</span> : ""}</div>
                {i.error && <div className="text-[11px] text-red-400/80 truncate">{i.error}</div>}
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${meta.cls}`}>{meta.label}</span>
              {i.status === "failed" && !running && (
                <button onClick={() => retry(i.id, batch.id)} className="text-[11px] text-neutral-400 hover:text-neutral-200 shrink-0">Retry</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
