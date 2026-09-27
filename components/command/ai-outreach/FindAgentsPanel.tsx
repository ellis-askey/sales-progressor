"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { findAgentsAction, getBatchProspectsAction, publishCampaignAction, type FoundRow } from "@/app/actions/outreach";
import { processNextImportItemAction } from "@/app/actions/prospects";

// "Find agents" on an approved experiment, end to end on one screen:
//   1. Search an area for UK estate agents we don't already hold.
//   2. Enrich + add each to prospects (progress-tracked; the drain cron finishes
//      anything left if the tab closes).
//   3. REVIEW the found agents as rows — who, their email, and whether it's
//      verified / a guess / undeliverable — and drop any you don't want.
//   4. PUBLISH to exactly the kept agents. Sending warms up automatically (a few
//      a day at first, climbing over ~3 weeks); the rest send day by day.
type Phase = "idle" | "searching" | "adding" | "review" | "publishing" | "error";

const BADGE: Record<FoundRow["emailStatus"], { label: string; cls: string }> = {
  verified: { label: "verified", cls: "bg-emerald-950 text-emerald-400 border border-emerald-900" },
  guessed: { label: "guessed", cls: "bg-amber-950 text-amber-400 border border-amber-900" },
  invalid: { label: "bad domain", cls: "bg-red-950 text-red-400 border border-red-900" },
  none: { label: "no email", cls: "bg-neutral-800 text-neutral-500" },
};

export function FindAgentsPanel({ experimentId }: { experimentId: string }) {
  const router = useRouter();
  const [area, setArea] = useState("");
  const [count, setCount] = useState(25);
  const [phase, setPhase] = useState<Phase>("idle");
  const [found, setFound] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [rows, setRows] = useState<FoundRow[]>([]);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setPhase("searching");
    setError(null);
    setMsg(null);
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
    // Reveal the reviewable rows.
    const foundRows = await getBatchProspectsAction(res.batchId);
    setRows(foundRows);
    // Default: keep everything with a usable email; drop dead/absent addresses.
    setKept(new Set(foundRows.filter((r) => r.emailStatus === "verified" || r.emailStatus === "guessed").map((r) => r.prospectId)));
    setPhase("review");
  }

  function toggle(id: string) {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function publish() {
    setPhase("publishing");
    setError(null);
    const res = await publishCampaignAction(experimentId, [...kept]);
    if ("ok" in res && res.ok) {
      setMsg(`Published to ${res.actualSample} agent${res.actualSample === 1 ? "" : "s"}. First ${res.initial.sentThisRun} sent now${res.initial.withinHours ? "" : " (outside business hours, so the first send waits for the next window)"}; the rest go out day by day as the domain warms up.`);
      router.refresh();
      return;
    }
    setError("error" in res ? res.error : "Could not publish. Try again.");
    setPhase("review");
  }

  const busy = phase === "searching" || phase === "adding" || phase === "publishing";
  const keptCount = kept.size;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3.5">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-1">Find agents &amp; publish</p>
      <p className="text-[11.5px] text-neutral-500 mb-3">
        Search an area for UK estate agents you don&apos;t already hold, review who was found, then publish to just those. Sending warms up automatically.
      </p>

      {phase !== "review" && phase !== "publishing" && (
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
      )}

      {phase === "adding" && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1">
            <span>Found {found}, researching + adding them</span>
            <span className="tabular-nums">{processed}/{found}</span>
          </div>
          <div className="h-1.5 rounded bg-neutral-800 overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${found ? Math.round((processed / found) * 100) : 0}%` }} />
          </div>
          <p className="mt-1.5 text-[10.5px] text-neutral-600">This keeps running in the background if you close the tab.</p>
        </div>
      )}

      {(phase === "review" || phase === "publishing") && (
        <div className="mt-1">
          {rows.length === 0 ? (
            <p className="text-[12px] text-neutral-500">No new agents were added (they may already be in your prospects). Try a broader area.</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] text-neutral-300"><span className="text-neutral-100 font-medium tabular-nums">{keptCount}</span> of {rows.length} selected to email</p>
                <div className="flex gap-2">
                  <button onClick={() => setKept(new Set(rows.filter((r) => r.email).map((r) => r.prospectId)))} className="text-[11px] text-neutral-500 hover:text-neutral-300">Select all</button>
                  <button onClick={() => setKept(new Set())} className="text-[11px] text-neutral-500 hover:text-neutral-300">Clear</button>
                </div>
              </div>
              <div className="rounded-lg border border-neutral-800 overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-[11.5px]">
                  <tbody>
                    {rows.map((r) => {
                      const on = kept.has(r.prospectId);
                      const canPick = !!r.email;
                      const badge = BADGE[r.emailStatus];
                      return (
                        <tr key={r.prospectId} className={`border-b border-neutral-800/70 last:border-0 ${on ? "" : "opacity-55"}`}>
                          <td className="px-2 py-1.5 align-top">
                            <input type="checkbox" checked={on} disabled={!canPick} onChange={() => toggle(r.prospectId)} className="accent-blue-500 disabled:opacity-40" />
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <div className="text-neutral-200">{r.agencyName}</div>
                            <div className="text-[10.5px] text-neutral-600">
                              {r.contactName ?? "no named contact"}{r.jobTitle ? ` · ${r.jobTitle}` : ""}{r.location ? ` · ${r.location}` : ""}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <div className="text-neutral-400 break-all">{r.email ?? "—"}</div>
                          </td>
                          <td className="px-2 py-1.5 align-top text-right whitespace-nowrap">
                            <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.cls}`}>{badge.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10.5px] text-neutral-600">
                &ldquo;Guessed&rdquo; emails were inferred, not confirmed — worth a quick sleuth before you rely on them. &ldquo;Bad domain&rdquo; can&apos;t receive mail and won&apos;t send.
              </p>

              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <button
                  onClick={publish}
                  disabled={busy || keptCount === 0}
                  className="text-[12px] font-semibold px-3.5 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  {phase === "publishing" ? "Publishing…" : `Publish to ${keptCount} agent${keptCount === 1 ? "" : "s"}`}
                </button>
                <button onClick={() => { setPhase("idle"); setRows([]); setKept(new Set()); }} disabled={busy} className="text-[11px] text-neutral-500 hover:text-neutral-300 disabled:opacity-50">
                  Start over
                </button>
                <span className="text-[10.5px] text-neutral-600">Sends warm up automatically: a few a day at first, climbing over ~3 weeks.</span>
              </div>
            </>
          )}
        </div>
      )}

      {msg && <p className="mt-3 text-[12px] text-emerald-400">{msg}</p>}
      {phase === "error" && error && <p className="mt-3 text-[12px] text-red-400">{error}</p>}
      {phase !== "error" && error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}
    </div>
  );
}
