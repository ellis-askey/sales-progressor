"use client";

import { useTransition } from "react";
import { acknowledgeDetectorSignalsAction } from "@/app/actions/command-centre";

export function BulkAckButton({ detectorName, count }: { detectorName: string; count: number }) {
  const [pending, startTransition] = useTransition();
  if (count < 2) return null;
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => acknowledgeDetectorSignalsAction(detectorName))}
      className="text-[11px] px-2 py-1 rounded-md bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-neutral-200 transition-colors disabled:opacity-40"
    >
      {pending ? "…" : `Mark all ${count} done`}
    </button>
  );
}
