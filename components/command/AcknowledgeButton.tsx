"use client";

import { useTransition } from "react";
import { acknowledgeSignalAction } from "@/app/actions/command-centre";

export function AcknowledgeButton({ signalId }: { signalId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => acknowledgeSignalAction(signalId))}
      className="text-xs px-2.5 py-1 rounded-md bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors disabled:opacity-40"
    >
      {pending ? "…" : "Ack"}
    </button>
  );
}
