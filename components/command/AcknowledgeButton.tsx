"use client";

import { useTransition } from "react";
import { acknowledgeSignalAction } from "@/app/actions/command-centre";

export function AcknowledgeButton({ signalId }: { signalId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => acknowledgeSignalAction(signalId))}
      className="text-xs px-2.5 py-1 rounded-md bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors disabled:opacity-40"
    >
      {pending ? "…" : "Ack"}
    </button>
  );
}
