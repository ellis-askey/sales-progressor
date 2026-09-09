"use client";

import { useState, useTransition } from "react";
import {
  startProspectFlowAction, approveFlowStepAction, updateFlowStepDraftAction,
  skipFlowStepAction, cancelProspectFlowAction, previewFlowStepAction,
} from "@/app/actions/prospect-flow";
import { FLOW_STEP_STATUS_LABEL, FLOW_HALT_REASON_LABEL, sequenceStepLabel } from "@/lib/prospects/flow";
import type { ProspectDetail } from "@/lib/command/prospects";

type Flow = NonNullable<ProspectDetail["flow"]>;
type Step = Flow["steps"][number];

function fmtDate(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const STEP_TONE: Record<string, string> = {
  scheduled: "bg-neutral-800 text-neutral-400 border-neutral-700",
  queued: "bg-amber-950 text-amber-300 border-amber-900",
  sent: "bg-emerald-950 text-emerald-300 border-emerald-900",
  skipped: "bg-neutral-900 text-neutral-600 border-neutral-800",
};

// The outreach flow for a prospect: start it, then approve / edit / skip each
// email as it comes due. Auto-queue, human-approve — nothing here sends without
// an explicit Approve.
export function FlowPanel({ flow, prospectId, canEmail, disabledReason, onChanged }: {
  flow: Flow | null;
  prospectId: string;
  canEmail: boolean;
  disabledReason: string;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const active = flow?.status === "active";

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.ok) onChanged();
      else setError(r.error);
    });
  }

  // No flow yet, or the last one finished/stopped: offer to start a fresh flow.
  if (!flow || !active) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 space-y-2.5">
        {flow && (
          <p className="text-[11px] text-neutral-500">
            Last flow {flow.status === "completed" ? "finished" : "stopped"}
            {flow.haltedReason ? ` because ${FLOW_HALT_REASON_LABEL[flow.haltedReason] ?? flow.haltedReason}` : ""}.
          </p>
        )}
        <p className="text-[11px] text-neutral-500">
          Start a sequence: an intro now, a nudge in two weeks, then a re-engage two weeks after that. Each email waits for your approval before it sends, and the flow stops itself if they reply.
        </p>
        {!canEmail ? (
          <p className="text-xs text-amber-400">Can&rsquo;t start &mdash; {disabledReason}.</p>
        ) : (
          <button
            onClick={() => run(() => startProspectFlowAction(prospectId))}
            disabled={pending}
            className="text-xs px-2.5 py-1 rounded-md bg-[#FF6B4A]/15 text-[#FF6B4A] border border-[#FF6B4A]/40 hover:bg-[#FF6B4A]/25 disabled:opacity-40"
          >
            {pending ? "Starting…" : flow ? "Start a new flow" : "Start flow"}
          </button>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-neutral-400">Outreach flow running &middot; {flow.steps.filter((s) => s.status === "sent").length}/{flow.steps.length} sent</p>
        <button onClick={() => run(() => cancelProspectFlowAction(prospectId))} disabled={pending} className="text-[10px] text-neutral-500 hover:text-red-300">Stop flow</button>
      </div>

      <div className="space-y-2">
        {flow.steps.map((s) => (
          <StepRow key={s.id} step={s} canEmail={canEmail} pending={pending} onRun={run} />
        ))}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function StepRow({ step, canEmail, pending, onRun }: {
  step: Step;
  canEmail: boolean;
  pending: boolean;
  onRun: (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;
}) {
  const [preview, setPreview] = useState<{ subject: string; html: string; toEmail: string | null } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(step.subject ?? "");
  const [body, setBody] = useState(step.body ?? "");

  async function togglePreview() {
    if (preview) { setPreview(null); return; }
    setPreviewing(true);
    const r = await previewFlowStepAction(step.id);
    setPreviewing(false);
    if (r.ok) setPreview({ subject: r.subject, html: r.html, toEmail: r.toEmail });
  }

  const isQueued = step.status === "queued";
  const isScheduled = step.status === "scheduled";
  const when = step.status === "sent" ? fmtDate(step.sentAt)
    : isScheduled && step.scheduledFor ? `due ${fmtDate(step.scheduledFor)}`
    : "";

  return (
    <div className="border border-neutral-800/70 rounded-lg p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-neutral-200">{step.stepIndex + 1}. {sequenceStepLabel(step.stepIndex)}</span>
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${STEP_TONE[step.status] ?? STEP_TONE.scheduled}`}>{FLOW_STEP_STATUS_LABEL[step.status] ?? step.status}</span>
        </div>
        {when && <span className="text-[10px] text-neutral-600 shrink-0">{when}</span>}
      </div>

      {isQueued && step.toEmail && <p className="text-[11px] text-neutral-500">To: <span className="text-neutral-300">{step.toEmail}</span></p>}
      {isQueued && !step.toEmail && <p className="text-[11px] text-amber-400">No email address on file. Add a contact email first.</p>}

      {(isQueued || isScheduled) && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={togglePreview} disabled={previewing} className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 hover:text-neutral-100 disabled:opacity-40">
            {previewing ? "…" : preview ? "Hide email" : "View the email"}
          </button>
          {isQueued && (
            <>
              <button
                onClick={() => onRun(() => approveFlowStepAction(step.id))}
                disabled={pending || !canEmail || !step.toEmail}
                className="text-[11px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-900 hover:bg-emerald-900 disabled:opacity-40"
              >
                {pending ? "…" : "Approve & send"}
              </button>
              <button onClick={() => { setSubject(step.subject ?? ""); setBody(step.body ?? ""); setEditing((v) => !v); }} className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 hover:text-neutral-100">Edit</button>
            </>
          )}
          <button onClick={() => onRun(() => skipFlowStepAction(step.id))} disabled={pending} className="text-[11px] text-neutral-500 hover:text-neutral-300">Skip</button>
        </div>
      )}

      {editing && isQueued && (
        <div className="space-y-2 bg-neutral-950 border border-neutral-800 rounded p-2">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full text-xs bg-[#0a0a0a] border border-[#262626] rounded px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-[#2563eb]" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} placeholder="Body" className="w-full text-xs bg-[#0a0a0a] border border-[#262626] rounded px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-[#2563eb]" />
          <button
            onClick={() => onRun(async () => { const r = await updateFlowStepDraftAction(step.id, { subject, body }); if (r.ok) setEditing(false); return r; })}
            disabled={pending || !subject.trim() || !body.trim()}
            className="text-[11px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-900 hover:bg-blue-900 disabled:opacity-40"
          >
            {pending ? "…" : "Save draft"}
          </button>
        </div>
      )}

      {preview && (
        <div className="space-y-1">
          <p className="text-[11px] text-neutral-500">Subject: <span className="text-neutral-300">{preview.subject}</span></p>
          <iframe title="email preview" sandbox="" srcDoc={preview.html} className="w-full rounded border border-neutral-800 bg-white" style={{ height: 420 }} />
        </div>
      )}
    </div>
  );
}
