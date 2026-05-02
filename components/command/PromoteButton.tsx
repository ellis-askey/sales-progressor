"use client";

import { useTransition, useState } from "react";
import { promoteSignalToExperimentAction } from "@/app/actions/command-centre";

export function PromoteButton({ signalId }: { signalId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (done) {
    return <span className="text-xs text-emerald-400/70">Promoted</span>;
  }

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await promoteSignalToExperimentAction(signalId);
          setDone(true);
        })
      }
      className="text-xs px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300/80 hover:bg-emerald-500/25 transition-colors disabled:opacity-40"
    >
      {pending ? "…" : "→ Experiment"}
    </button>
  );
}
