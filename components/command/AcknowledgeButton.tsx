"use client";

import { useTransition } from "react";
import { acknowledgeSignalAction } from "@/app/actions/command-centre";

export function AcknowledgeButton({ signalId, compact = false }: { signalId: string; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  const ack = () => startTransition(() => acknowledgeSignalAction(signalId));

  // Compact (x) for inline use next to a signal row (e.g. the overview feed),
  // where the full "Mark done" pill is too heavy.
  if (compact) {
    return (
      <button
        disabled={pending}
        onClick={ack}
        aria-label="Mark done"
        title="Mark done"
        className="w-6 h-6 inline-flex items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-800 hover:text-neutral-200 transition-colors disabled:opacity-40 shrink-0 leading-none"
      >
        {pending ? "…" : "✕"}
      </button>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={ack}
      className="text-xs px-2.5 py-1 rounded-md bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors disabled:opacity-40"
    >
      {pending ? "…" : "Mark done"}
    </button>
  );
}
