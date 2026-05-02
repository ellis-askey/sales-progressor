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
        className="text-xs px-2.5 py-1 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-900 hover:bg-emerald-900 transition-colors disabled:opacity-40"
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
            className="text-xs bg-neutral-800 text-neutral-200 border border-neutral-700 rounded px-2 py-1 focus:outline-none focus:border-neutral-500"
          >
            {OUTCOMES.map((o) => (
              <option key={o} value={o} className="bg-neutral-900">{o}</option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Conclusion note…"
            className="text-xs bg-neutral-800 text-neutral-200 border border-neutral-700 rounded px-2 py-1 w-48 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
          />
          <button
            disabled={pending || !note.trim()}
            onClick={() => startTransition(() => concludeExperimentAction(experimentId, outcome, note.trim()))}
            className="text-xs px-2.5 py-1 rounded-md bg-blue-950 text-blue-400 border border-blue-900 hover:bg-blue-900 transition-colors disabled:opacity-40"
          >
            {pending ? "…" : "Confirm"}
          </button>
          <button
            onClick={() => setConcluding(false)}
            className="text-xs px-2 py-1 text-neutral-500 hover:text-neutral-300 transition-colors"
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
          className="text-xs px-2.5 py-1 rounded-md bg-blue-950 text-blue-400 border border-blue-900 hover:bg-blue-900 transition-colors"
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
          className="text-xs px-2.5 py-1 rounded-md bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition-colors disabled:opacity-40"
        >
          Abandon
        </button>
      </div>
    );
  }

  return null;
}
