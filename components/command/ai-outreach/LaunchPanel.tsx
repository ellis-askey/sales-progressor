"use client";

// Build Order H launch controls (superadmin-only page). APPROVED != SEND: this
// preflights, then launches on a deliberate second action, and resumes a partial
// launch. All authority is server-side; this is only UI. Nothing sends outside the
// Europe/London business window.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { preflightExperimentAction, launchExperimentAction, resumeLaunchAction } from "@/app/actions/outreach";
import type { Preflight, LaunchResult } from "@/lib/outreach/launch";

type LaunchSummary = {
  actualSample: number;
  assignedControl: number;
  assignedChallenger: number;
  initialSent: number;
  initialFailed: number;
  initialUncertain: number;
  initialSuppressed: number;
  status: string;
} | null;

export function LaunchPanel({ experimentId, status, launch }: { experimentId: string; status: string; launch: LaunchSummary }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pf, setPf] = useState<Preflight | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [needConfirm, setNeedConfirm] = useState(false);

  function preflight() {
    setMsg(null);
    start(async () => {
      const res = await preflightExperimentAction(experimentId);
      if ("error" in res) setMsg(res.error);
      else { setPf(res); setNeedConfirm(res.underSample); }
    });
  }

  function doLaunch(confirmUnderSample: boolean) {
    setMsg(null);
    start(async () => {
      const res: LaunchResult = await launchExperimentAction(experimentId, { confirmUnderSample });
      if ("ok" in res && res.ok) { setMsg(`Launched. ${res.assignedControl} control / ${res.assignedChallenger} challenger. Initial sent this run: ${res.initial.sentThisRun}${res.initial.withinHours ? "" : " (outside business hours - sends are pending until the next window)"}.`); router.refresh(); }
      else if ("needsUnderSampleConfirm" in res) { setNeedConfirm(true); setMsg(`Only ${res.eligibleCount} eligible vs ${res.requestedSample} requested.`); }
      else setMsg(res.error);
    });
  }

  function resume() {
    setMsg(null);
    start(async () => { await resumeLaunchAction(experimentId); router.refresh(); });
  }

  if (status === "running" && launch) {
    return (
      <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/10 px-3 py-2.5 text-[12px] text-neutral-300">
        <p className="font-medium text-neutral-100">Launched · {launch.status.replace(/_/g, " ")}</p>
        <p className="mt-1 tabular-nums text-neutral-400">
          {launch.assignedControl} control / {launch.assignedChallenger} challenger · sent {launch.initialSent} · failed {launch.initialFailed} · uncertain {launch.initialUncertain} · suppressed {launch.initialSuppressed}
        </p>
        {(launch.initialFailed > 0 || launch.status !== "completed") && (
          <button onClick={resume} disabled={pending} className="mt-2 px-2.5 py-1 rounded-md text-[11px] border border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-600 disabled:opacity-50">
            {pending ? "Resuming…" : "Resume sending"}
          </button>
        )}
        {launch.initialUncertain > 0 && <p className="mt-1 text-[11px] text-amber-400">{launch.initialUncertain} uncertain send(s) - unknown outcome, not retried.</p>}
        {msg && <p className="mt-1 text-[11px] text-neutral-400">{msg}</p>}
      </div>
    );
  }

  if (status !== "approved") return null;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Launch</p>
        <button onClick={preflight} disabled={pending} className="px-2.5 py-1 rounded-md text-[11px] border border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-600 disabled:opacity-50">
          {pending ? "Checking…" : "Preflight"}
        </button>
      </div>

      {pf && (
        <div className="mt-2 space-y-1 text-[12px] text-neutral-300">
          <p className="tabular-nums">Requested {pf.requestedSample} · eligible now <span className="text-neutral-100">{pf.eligibleCount}</span> · actual {pf.actualSample} ({pf.controlCount} control / {pf.challengerCount} challenger)</p>
          <p className="text-[11px] text-neutral-500">Excluded: {Object.entries(pf.exclusionCounts).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}</p>
          <p className="text-[11px] text-neutral-500">Sender: {pf.senderConfigured ? "AI outreach identity configured" : "NOT configured"} · {pf.withinBusinessHours ? "within business hours" : `outside hours - sending begins ${pf.sendingBeginsAt ? new Date(pf.sendingBeginsAt).toLocaleString("en-GB") : "next window"}`}</p>
          {pf.reviewerOverridden && <p className="text-[11px] text-red-400">Reviewer originally rejected (human override).</p>}
          {pf.editedAfterReview && <p className="text-[11px] text-amber-400">Edited after AI review.</p>}
          {pf.blockers.length > 0 ? (
            <p className="text-[11px] text-red-400">Blocked: {pf.blockers.join(" ")}</p>
          ) : needConfirm ? (
            <button onClick={() => doLaunch(true)} disabled={pending} className="mt-1 px-3 py-1.5 rounded-md text-[12px] font-medium border border-amber-700/50 bg-amber-950/30 text-amber-300 hover:bg-amber-950/50 disabled:opacity-50">
              {pending ? "Launching…" : `Launch anyway (${pf.actualSample}, under requested)`}
            </button>
          ) : (
            <button onClick={() => doLaunch(false)} disabled={pending} className="mt-1 px-3 py-1.5 rounded-md text-[12px] font-medium border border-blue-600/40 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 disabled:opacity-50">
              {pending ? "Launching…" : `Launch (${pf.actualSample} prospects)`}
            </button>
          )}
        </div>
      )}
      {msg && <p className="mt-1.5 text-[11px] text-neutral-400">{msg}</p>}
    </div>
  );
}
