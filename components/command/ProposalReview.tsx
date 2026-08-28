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
};

export type ResolvedRow = {
  id: string;
  propertyAddress: string;
  stepLabel: string | null;
  decidedAt: string | null;
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

export function ProposalReview({ proposals, resolved }: { proposals: ProposalRow[]; resolved: ResolvedRow[] }) {
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

      {rows.length === 0 && resolved.length === 0 && (
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
