"use client";

// The approval decision bar + pre-approval edit form for one proposal (Build Order
// G). Approve / Reject / Discard / Override, plus editing of the allowed fields.
// None of these send or launch anything; approval marks intent only. Edits re-run
// app guardrails + feasibility server-side and set "edited after AI review".

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveExperimentAction,
  rejectExperimentAction,
  discardExperimentAction,
  overrideReviewerRejectAction,
  editExperimentAction,
  type EditPatch,
} from "@/app/actions/outreach";

const METRICS = ["reply", "interested", "converted", "activated_agency"];
const DIMENSIONS = ["source", "branch_structure", "contact_history", "region"];

type Step = { stepIndex: number; gapDays: number; subject: string; body: string };

export function ExperimentReviewActions(props: {
  experimentId: string;
  status: string;
  reviewOutcome: string | null;
  feasible: boolean | null;
  sampleSize: number | null;
  allocationPct: number | null;
  primaryMetric: string | null;
  challengerSteps: Step[];
  targetKind: "all_eligible" | "segment";
  targetDimension?: string;
  targetValues?: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err" | "warn"; text: string } | null>(null);
  const [confirmInfeasible, setConfirmInfeasible] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit form state
  const [sample, setSample] = useState(props.sampleSize ?? 0);
  const [alloc, setAlloc] = useState(props.allocationPct ?? 50);
  const [metric, setMetric] = useState(props.primaryMetric ?? "activated_agency");
  const [kind, setKind] = useState(props.targetKind);
  const [dim, setDim] = useState(props.targetDimension ?? "source");
  const [values, setValues] = useState((props.targetValues ?? []).join(", "));
  const [steps, setSteps] = useState<Step[]>(props.challengerSteps ?? []);

  const editable = props.status === "awaiting_approval" || props.status === "draft";
  const canApprove = props.status === "awaiting_approval";
  const isRejectedDraft = props.status === "draft" && props.reviewOutcome === "reject";

  function done(res: { ok: boolean; error?: string } | { ok: false; requiresInfeasibleConfirm: true; error: string }) {
    if ((res as { requiresInfeasibleConfirm?: boolean }).requiresInfeasibleConfirm) {
      setConfirmInfeasible(true);
      setMsg({ tone: "warn", text: (res as { error: string }).error });
      return;
    }
    if (res.ok) {
      setMsg({ tone: "ok", text: "Done." });
      setEditing(false);
      setShowReject(false);
      setShowOverride(false);
      router.refresh();
    } else {
      setMsg({ tone: "err", text: (res as { error?: string }).error ?? "Failed." });
    }
  }

  const btn = "px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors disabled:opacity-50";

  return (
    <div className="mt-2 border-t border-neutral-800 pt-3 space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        {canApprove && (
          <button
            className={`${btn} border-emerald-700/50 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50`}
            disabled={pending}
            onClick={() => start(async () => done(await approveExperimentAction(props.experimentId, { confirmInfeasible })))}
          >
            {confirmInfeasible ? "Approve anyway (infeasible)" : "Approve & launch later"}
          </button>
        )}
        {isRejectedDraft && (
          <button className={`${btn} border-amber-700/50 bg-amber-900/30 text-amber-300 hover:bg-amber-900/50`} disabled={pending} onClick={() => setShowOverride((v) => !v)}>
            Override reviewer rejection
          </button>
        )}
        {props.status !== "rejected" && props.status !== "archived" && props.status !== "approved" && (
          <button className={`${btn} border-red-800/50 bg-red-950/40 text-red-300 hover:bg-red-950/60`} disabled={pending} onClick={() => setShowReject((v) => !v)}>
            Reject
          </button>
        )}
        <button className={`${btn} border-neutral-700 bg-neutral-800/60 text-neutral-400 hover:text-neutral-200`} disabled={pending} onClick={() => start(async () => done(await discardExperimentAction(props.experimentId)))}>
          Discard
        </button>
        {editable && (
          <button className={`${btn} border-blue-700/50 bg-blue-900/30 text-blue-300 hover:bg-blue-900/50`} disabled={pending} onClick={() => setEditing((v) => !v)}>
            {editing ? "Close edit" : "Edit"}
          </button>
        )}
      </div>

      {showReject && (
        <div className="space-y-1">
          <textarea className="w-full text-xs bg-[#0a0a0a] border border-[#262626] rounded p-2 text-neutral-200" rows={2} placeholder="Reason (optional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <button className={`${btn} border-red-800/50 bg-red-950/40 text-red-300`} disabled={pending} onClick={() => start(async () => done(await rejectExperimentAction(props.experimentId, rejectReason)))}>
            Confirm reject
          </button>
        </div>
      )}

      {showOverride && (
        <div className="space-y-1">
          <p className="text-[11px] text-amber-400">GPT rejected this. Overriding promotes it to awaiting approval but the rejection stays on record forever.</p>
          <textarea className="w-full text-xs bg-[#0a0a0a] border border-[#262626] rounded p-2 text-neutral-200" rows={2} placeholder="Why override the reviewer? (required)" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
          <button className={`${btn} border-amber-700/50 bg-amber-900/30 text-amber-300`} disabled={pending || overrideReason.trim().length < 3} onClick={() => start(async () => done(await overrideReviewerRejectAction(props.experimentId, overrideReason)))}>
            Confirm override
          </button>
        </div>
      )}

      {editing && (
        <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <label className="text-[11px] text-neutral-500">Sample<input type="number" className="mt-0.5 w-full text-xs bg-[#0a0a0a] border border-[#262626] rounded p-1 text-neutral-200" value={sample} onChange={(e) => setSample(Number(e.target.value))} /></label>
            <label className="text-[11px] text-neutral-500">Challenger %<input type="number" className="mt-0.5 w-full text-xs bg-[#0a0a0a] border border-[#262626] rounded p-1 text-neutral-200" value={alloc} onChange={(e) => setAlloc(Number(e.target.value))} /></label>
            <label className="text-[11px] text-neutral-500">Primary metric
              <select className="mt-0.5 w-full text-xs bg-[#0a0a0a] border border-[#262626] rounded p-1 text-neutral-200" value={metric} onChange={(e) => setMetric(e.target.value)}>
                {METRICS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-neutral-500">Target
              <select className="mt-0.5 w-full text-xs bg-[#0a0a0a] border border-[#262626] rounded p-1 text-neutral-200" value={kind} onChange={(e) => setKind(e.target.value as "all_eligible" | "segment")}>
                <option value="all_eligible">All eligible prospects</option>
                <option value="segment">Segment</option>
              </select>
            </label>
            {kind === "segment" && (
              <>
                <label className="text-[11px] text-neutral-500">Dimension
                  <select className="mt-0.5 w-full text-xs bg-[#0a0a0a] border border-[#262626] rounded p-1 text-neutral-200" value={dim} onChange={(e) => setDim(e.target.value)}>
                    {DIMENSIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
                <label className="text-[11px] text-neutral-500">Values (comma-sep)<input className="mt-0.5 w-full text-xs bg-[#0a0a0a] border border-[#262626] rounded p-1 text-neutral-200" value={values} onChange={(e) => setValues(e.target.value)} /></label>
              </>
            )}
          </div>
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={i} className="rounded border border-neutral-800 p-2 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-600">Step {s.stepIndex}</span>
                  <label className="text-[10px] text-neutral-600">gap<input type="number" className="ml-1 w-14 text-xs bg-[#0a0a0a] border border-[#262626] rounded p-0.5 text-neutral-200" value={s.gapDays} onChange={(e) => setSteps((prev) => prev.map((x, j) => j === i ? { ...x, gapDays: Number(e.target.value) } : x))} /></label>
                </div>
                <input className="w-full text-xs bg-[#0a0a0a] border border-[#262626] rounded p-1 text-neutral-200" value={s.subject} onChange={(e) => setSteps((prev) => prev.map((x, j) => j === i ? { ...x, subject: e.target.value } : x))} />
                <textarea rows={4} className="w-full text-xs bg-[#0a0a0a] border border-[#262626] rounded p-1 text-neutral-300" value={s.body} onChange={(e) => setSteps((prev) => prev.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} />
              </div>
            ))}
          </div>
          <button
            className={`${btn} border-blue-700/50 bg-blue-900/30 text-blue-300`}
            disabled={pending}
            onClick={() => start(async () => {
              const patch: EditPatch = {
                sampleSize: sample,
                allocationPct: alloc,
                primaryMetric: metric,
                challengerSteps: steps,
                targetSegment: kind === "all_eligible" ? { kind: "all_eligible" } : { kind: "segment", dimension: dim as "source" | "branch_structure" | "contact_history" | "region", values: values.split(",").map((v) => v.trim()).filter(Boolean) },
              };
              done(await editExperimentAction(props.experimentId, patch));
            })}
          >
            Save edits
          </button>
          <p className="text-[10px] text-neutral-600">Edits re-run guardrails and recompute feasibility. They do not trigger a new AI review; this proposal will be marked &ldquo;edited after AI review&rdquo;.</p>
        </div>
      )}

      {msg && <p className={`text-[11px] ${msg.tone === "ok" ? "text-emerald-400" : msg.tone === "warn" ? "text-amber-400" : "text-red-400"}`}>{msg.text}</p>}
    </div>
  );
}
