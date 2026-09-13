"use client";

// The ONE interactive control on the AI Outreach page (Build Order F): a manual,
// superadmin-only trigger that runs a single strategy cycle and persists a
// proposal. It generates only — it cannot approve, launch, assign, or send.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runStrategyCycleAction, type GenerateProposalResult } from "@/app/actions/outreach";

export function GenerateProposalButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<GenerateProposalResult | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      const res = await runStrategyCycleAction();
      setResult(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={run}
        disabled={pending}
        className="px-3 py-1.5 rounded-md text-[12px] font-medium border border-blue-600/40 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? "Generating a proposal…" : "Generate a proposal"}
      </button>
      <p className="text-[10px] text-neutral-600">Runs one strategy cycle. Does not send or launch anything.</p>
      {result && !pending && (
        <p className={`text-[11px] ${result.ok ? "text-emerald-400" : "text-amber-400"} max-w-xs text-right`}>
          {result.ok
            ? `Proposal created (${result.status.replace(/_/g, " ")}; reviewer: ${result.reviewOutcome.replace(/_/g, " ")}${result.revisionRan ? ", revised" : ""}).`
            : `Could not generate: ${result.error}`}
        </p>
      )}
    </div>
  );
}
