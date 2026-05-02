"use client";

import { useTransition, useState } from "react";
import { startExperimentAction, abandonExperimentAction, concludeExperimentAction } from "@/app/actions/command-centre";
import type { ExperimentStatus } from "@prisma/client";

const OUTCOMES = ["win", "loss", "inconclusive", "mixed"] as const;
type Outcome = typeof OUTCOMES[number];

export function ExperimentActions({
  experimentId,
  status,
}: {
  experimentId: string;
  status: ExperimentStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [concluding, setConcluding] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("win");
  const [note, setNote] = useState("");

  if (status === "proposed") {
    return (
      <button
        disabled={pending}
        onClick={() => startTransition(() => startExperimentAction(experimentId))}
        className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
      >
        {pending ? "…" : "Start"}
      </button>
    );
  }

  if (status === "active") {
    if (concluding) {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as Outcome)}
            className="text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1"
          >
            {OUTCOMES.map((o) => (
              <option key={o} value={o} className="bg-slate-800">
                {o}
              </option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Conclusion note…"
            className="text-xs bg-white/10 text-white border border-white/20 rounded px-2 py-1 w-48 placeholder:text-white/30"
          />
          <button
            disabled={pending || !note.trim()}
            onClick={() =>
              startTransition(() =>
                concludeExperimentAction(experimentId, outcome, note.trim())
              )
            }
            className="text-xs px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors disabled:opacity-40"
          >
            {pending ? "…" : "Confirm"}
          </button>
          <button
            onClick={() => setConcluding(false)}
            className="text-xs px-2 py-1 text-white/40 hover:text-white/70 transition-colors"
          >
            Cancel
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setConcluding(true)}
          className="text-xs px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors"
        >
          Conclude
        </button>
        <button
          disabled={pending}
          onClick={() => {
            const reason = window.prompt("Reason for abandoning?");
            if (reason?.trim()) {
              startTransition(() => abandonExperimentAction(experimentId, reason.trim()));
            }
          }}
          className="text-xs px-2.5 py-1 rounded-md bg-white/10 text-white/50 hover:bg-white/20 transition-colors disabled:opacity-40"
        >
          Abandon
        </button>
      </div>
    );
  }

  return null;
}
