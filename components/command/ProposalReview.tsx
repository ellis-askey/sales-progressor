"use client";

// Command Centre → Proposed updates. Two flavours of AI proposal from inbound
// emails:
//   - confirm: approving completes the milestone step AND emails the client,
//     exactly like confirming on the property file (same queued-send + review).
//   - note: approving saves a private internal file note. No client email.
// Approving a confirm mounts the same queued-send tray the file uses, so you
// see what's sending + a countdown + review/undo.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { approveProposalAction, dismissProposalAction } from "@/app/actions/proposals";
import { ConfirmReviewTray } from "@/components/confirm-review/ConfirmReviewTray";

// One shadow action the agent WOULD have taken (nothing was executed).
export type AgentActionView = {
  actionType: string;
  outcome: string; // shadow_proposed | blocked | flagged | no_action
  targetRef: string | null;
  blockedReason: string | null;
  confidence: string | null;
};

// The agent's concise assessment behind a proposal / shadow run.
export type AgentAssessmentView = {
  understood: string | null;
  changed: string | null;
  waitingOn: string | null;
  nextExpected: string | null;
  confidence: string | null;
  humanAttention: boolean;
  actions: AgentActionView[];
};

export type ProposalRow = {
  id: string;
  transactionId: string;
  propertyAddress: string;
  actionType: "confirm" | "note";
  stepLabel: string | null;
  milestoneCode: string | null;
  summary: string;
  confidence: string;
  emailFrom: string | null;
  emailSubject: string | null;
  emailSnippet: string | null;
  createdAt: string;
  recipients: string[];
  agent: AgentAssessmentView | null;
};

export type ResolvedRow = {
  id: string;
  propertyAddress: string;
  stepLabel: string | null;
  decidedAt: string | null;
};

// A shadow run that proposed NO change (decided no action, or errored).
export type ShadowRunRow = {
  id: string;
  transactionId: string;
  propertyAddress: string;
  understood: string | null;
  changed: string | null;
  waitingOn: string | null;
  nextExpected: string | null;
  confidence: string | null;
  humanAttention: boolean;
  outcome: string | null; // no_action | error
  when: string;
  actions: AgentActionView[];
};

const CONF_STYLE: Record<string, string> = {
  high: "text-emerald-400 bg-emerald-950/50 border-emerald-900",
  medium: "text-amber-400 bg-amber-950/50 border-amber-900",
  low: "text-neutral-400 bg-neutral-800/60 border-neutral-700",
};

function fmtWhen(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

const ACTION_LABEL: Record<string, string> = {
  confirmMilestone: "Confirm milestone",
  addInternalNote: "Add internal note",
  setWaitingOn: "Update waiting-on",
  createTask: "Create task",
  resolveTask: "Resolve task",
  escalateToHuman: "Escalate to a human",
  doNothing: "No action",
};

const OUTCOME_STYLE: Record<string, { label: string; cls: string }> = {
  shadow_proposed: { label: "would do", cls: "text-blue-300 bg-blue-950/50 border-blue-900" },
  blocked: { label: "would be blocked", cls: "text-red-300 bg-red-950/50 border-red-900" },
  flagged: { label: "flagged", cls: "text-amber-300 bg-amber-950/50 border-amber-900" },
  no_action: { label: "no action", cls: "text-neutral-400 bg-neutral-800/60 border-neutral-700" },
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[12px] text-neutral-300">
      <span className="text-neutral-500">{label}: </span>
      {value}
    </p>
  );
}

function ActionRow({ a }: { a: AgentActionView }) {
  const o = OUTCOME_STYLE[a.outcome] ?? OUTCOME_STYLE.no_action;
  return (
    <li className="flex items-start gap-2 text-[12px] text-neutral-300">
      <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${o.cls}`}>{o.label}</span>
      <span className="min-w-0">
        {ACTION_LABEL[a.actionType] ?? a.actionType}
        {a.targetRef ? <span className="text-neutral-500"> · {a.targetRef}</span> : null}
        {a.blockedReason ? <span className="text-red-400/80"> — {a.blockedReason}</span> : null}
      </span>
    </li>
  );
}

// The agent's shadow assessment — collapsed by default, clearly framed as
// something the system WOULD have done, not something that happened.
function AgentAssessmentPanel({ agent }: { agent: AgentAssessmentView | null }) {
  if (!agent) return null;
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-[11px] font-semibold text-neutral-400 hover:text-neutral-200 select-none">
        ▸ Agent assessment (shadow — not performed)
      </summary>
      <div className="mt-2 pl-3 border-l-2 border-neutral-800 space-y-1.5">
        {agent.understood && <Field label="Understood" value={agent.understood} />}
        {agent.changed && <Field label="Believes changed" value={agent.changed} />}
        {agent.waitingOn && <Field label="Now waiting on" value={agent.waitingOn} />}
        {agent.nextExpected && <Field label="Next expected" value={agent.nextExpected} />}
        {agent.humanAttention && <p className="text-[11px] text-amber-400">Flagged for human attention</p>}
        {agent.actions.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1 mb-1">Would have done</p>
            <ul className="space-y-1">
              {agent.actions.map((a, i) => (
                <ActionRow key={i} a={a} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function ShadowRunsSection({ runs }: { runs: ShadowRunRow[] }) {
  if (runs.length === 0) return null;
  return (
    <section>
      <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
        Shadow assessments · no change proposed · {runs.length}
      </h2>
      <p className="text-[12px] text-neutral-500 mb-3">
        Inbound emails the agent read where it decided nothing should change (or couldn&rsquo;t reach a confident view). Nothing
        was proposed and nothing happened — shown so its judgement is fully observable.
      </p>
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl divide-y divide-neutral-800">
        {runs.map((r) => (
          <div key={r.id} className="px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/transactions/${r.transactionId}`} className="text-[13px] font-semibold text-neutral-200 hover:text-blue-300">
                {r.propertyAddress}
              </Link>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${r.outcome === "error" ? OUTCOME_STYLE.flagged.cls : OUTCOME_STYLE.no_action.cls}`}>
                {r.outcome === "error" ? "no confident view" : "no change"}
              </span>
              {r.confidence && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${CONF_STYLE[r.confidence] ?? CONF_STYLE.low}`}>{r.confidence}</span>}
              {r.humanAttention && <span className="text-[10px] text-amber-400">needs a look</span>}
              <span className="text-neutral-600 text-[11px] ml-auto">{fmtWhen(r.when)}</span>
            </div>
            {r.understood && <p className="text-[12px] text-neutral-400 mt-1">{r.understood}</p>}
            <AgentAssessmentPanel
              agent={{ understood: null, changed: r.changed, waitingOn: r.waitingOn, nextExpected: r.nextExpected, confidence: r.confidence, humanAttention: r.humanAttention, actions: r.actions }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProposalReview({ proposals, resolved, shadowRuns = [] }: { proposals: ProposalRow[]; resolved: ResolvedRow[]; shadowRuns?: ShadowRunRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<ProposalRow[]>(proposals);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [trayTxId, setTrayTxId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function act(row: ProposalRow, kind: "approve" | "dismiss") {
    setBusy(row.id);
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = kind === "approve" ? await approveProposalAction(row.id) : await dismissProposalAction(row.id);
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== row.id));
        // A confirm approve queues client emails just like the file — surface the
        // same countdown + review tray for that file.
        if (kind === "approve" && row.actionType === "confirm") setTrayTxId(row.transactionId);
        router.refresh();
      } else if (!res.ok && "cleared" in res && res.cleared) {
        setRows((prev) => prev.filter((r) => r.id !== row.id));
        setInfo(res.error);
        router.refresh();
      } else {
        setError(res.error);
      }
      setBusy((c) => (c === row.id ? null : c));
    });
  }

  const confirms = rows.filter((r) => r.actionType === "confirm");
  const notes = rows.filter((r) => r.actionType === "note");

  return (
    <div className="space-y-8">
      {error && <p className="text-xs text-red-400">{error}</p>}
      {info && <p className="text-xs text-emerald-400">{info}</p>}

      {rows.length === 0 && resolved.length === 0 && shadowRuns.length === 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-6 py-10 text-center">
          <p className="text-sm text-neutral-400">Nothing to review. New proposals appear here as emails come in.</p>
        </div>
      )}

      {/* Step confirmations — approving emails the client */}
      {confirms.length > 0 && (
        <section>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
            Step confirmations · {confirms.length}
          </h2>
          <p className="text-[12px] text-neutral-500 mb-3">
            The email looks like it completed a step. Approving marks the step done and emails the client, exactly like
            confirming on the file (with a countdown and a chance to review before it sends).
          </p>
          <div className="space-y-3">
            {confirms.map((p) => (
              <ProposalCard key={p.id} p={p} busy={busy === p.id} onAct={act} />
            ))}
          </div>
        </section>
      )}

      {/* File notes — internal only, no email */}
      {notes.length > 0 && (
        <section>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
            File notes · {notes.length}
          </h2>
          <p className="text-[12px] text-neutral-500 mb-3">
            The email is relevant but did not complete a step. Approving saves it as a private file note. No one is emailed.
          </p>
          <div className="space-y-3">
            {notes.map((p) => (
              <ProposalCard key={p.id} p={p} busy={busy === p.id} onAct={act} />
            ))}
          </div>
        </section>
      )}

      {/* Recently auto-resolved — the step was completed on the file elsewhere */}
      {resolved.length > 0 && (
        <section>
          <h2 className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-3">
            Auto-resolved · already done on the file
          </h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl divide-y divide-neutral-800 opacity-70">
            {resolved.map((r) => (
              <div key={r.id} className="px-4 py-2.5 flex items-center gap-3 text-xs">
                <span className="flex-1 min-w-0 truncate text-neutral-300">{r.propertyAddress}</span>
                {r.stepLabel && <span className="text-neutral-500 truncate">{r.stepLabel}</span>}
                <span className="text-neutral-600 shrink-0">{fmtWhen(r.decidedAt)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <ShadowRunsSection runs={shadowRuns} />

      {trayTxId && <ConfirmReviewTray transactionId={trayTxId} />}
    </div>
  );
}

function ProposalCard({ p, busy, onAct }: { p: ProposalRow; busy: boolean; onAct: (p: ProposalRow, k: "approve" | "dismiss") => void }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/transactions/${p.transactionId}`} className="text-[14px] font-semibold text-neutral-100 hover:text-blue-300">
              {p.propertyAddress}
            </Link>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${CONF_STYLE[p.confidence] ?? CONF_STYLE.low}`}>
              {p.confidence} confidence
            </span>
          </div>

          <p className="text-[13px] text-neutral-200 mt-1.5">
            {p.actionType === "confirm"
              ? <>Completes <span className="font-semibold text-blue-300">{p.stepLabel}</span>{p.milestoneCode ? ` (${p.milestoneCode})` : ""} and emails the client.</>
              : <>Saves a private <span className="font-semibold">file note</span>. No email.</>}
          </p>
          <p className="text-[12px] text-neutral-500 mt-1 italic">{p.summary}</p>

          {p.actionType === "confirm" && (
            <p className="text-[11px] text-neutral-500 mt-2">
              {p.recipients.length > 0
                ? <>Will email: <span className="text-neutral-300">{p.recipients.join(", ")}</span> via the client portal.</>
                : <>No portal clients on this file to email; it will still mark the step done.</>}
            </p>
          )}

          <div className="mt-3 border-l-2 border-neutral-800 pl-3">
            <p className="text-[11px] text-neutral-500">
              From <span className="text-neutral-300">{p.emailFrom ?? "unknown"}</span>
              {p.emailSubject ? <> · {p.emailSubject}</> : null}
            </p>
            {p.emailSnippet && <p className="text-[12px] text-neutral-400 mt-1 line-clamp-3">{p.emailSnippet}</p>}
          </div>

          <AgentAssessmentPanel agent={p.agent} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onAct(p, "dismiss")}
            disabled={busy}
            className="text-[12.5px] font-semibold px-3 py-1.5 rounded-lg text-neutral-300 border border-neutral-700 hover:bg-neutral-800 disabled:opacity-40"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => onAct(p, "approve")}
            disabled={busy}
            className="text-[12.5px] font-semibold px-3.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
          >
            {busy ? "…" : p.actionType === "confirm" ? "Approve + confirm" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}
