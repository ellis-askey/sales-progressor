"use client";

// Command Centre → Proposed updates. Each card is an AI proposal from an
// inbound email: the file, what it suggests, the AI's one-line reason, the
// source email, and Approve / Dismiss. Approve runs the real confirm cascade
// (server action); dismiss just closes it. Optimistic: the card leaves on
// action. Nothing acted on its own to get here.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { approveProposalAction, dismissProposalAction } from "@/app/actions/proposals";

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
};

const CONF_STYLE: Record<string, string> = {
  high: "text-emerald-400 bg-emerald-950/50 border-emerald-900",
  medium: "text-amber-400 bg-amber-950/50 border-amber-900",
  low: "text-neutral-400 bg-neutral-800/60 border-neutral-700",
};

export function ProposalReview({ proposals }: { proposals: ProposalRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<ProposalRow[]>(proposals);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function act(id: string, kind: "approve" | "dismiss") {
    setBusy(id);
    setError(null);
    startTransition(async () => {
      const res = kind === "approve" ? await approveProposalAction(id) : await dismissProposalAction(id);
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        router.refresh();
      } else {
        setError(res.error);
      }
      setBusy((c) => (c === id ? null : c));
    });
  }

  if (rows.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-6 py-10 text-center">
        <p className="text-sm text-neutral-400">Nothing to review. New proposals appear here as emails come in.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}
      {rows.map((p) => (
        <div key={p.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              {/* File + proposed action */}
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
                  ? <>Suggests marking <span className="font-semibold text-blue-300">{p.stepLabel}</span> as done{p.milestoneCode ? ` (${p.milestoneCode})` : ""}.</>
                  : <>Suggests logging this as a <span className="font-semibold">file note</span>.</>}
              </p>
              <p className="text-[12px] text-neutral-500 mt-1 italic">{p.summary}</p>

              {/* Source email */}
              <div className="mt-3 border-l-2 border-neutral-800 pl-3">
                <p className="text-[11px] text-neutral-500">
                  From <span className="text-neutral-300">{p.emailFrom ?? "unknown"}</span>
                  {p.emailSubject ? <> · {p.emailSubject}</> : null}
                </p>
                {p.emailSnippet && <p className="text-[12px] text-neutral-400 mt-1 line-clamp-3">{p.emailSnippet}</p>}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => act(p.id, "dismiss")}
                disabled={busy === p.id}
                className="text-[12.5px] font-semibold px-3 py-1.5 rounded-lg text-neutral-300 border border-neutral-700 hover:bg-neutral-800 disabled:opacity-40"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => act(p.id, "approve")}
                disabled={busy === p.id}
                className="text-[12.5px] font-semibold px-3.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
              >
                {busy === p.id ? "…" : p.actionType === "confirm" ? "Approve + confirm" : "Approve"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
