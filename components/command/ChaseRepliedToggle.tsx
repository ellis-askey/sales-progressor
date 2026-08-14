"use client";

import { useTransition, useState } from "react";
import { setChaseRepliedByEmailAction } from "@/app/actions/command-centre";

// Founder toggle on a chase-send row: "the solicitor replied to this by email".
export function ChaseRepliedToggle({ id, initial }: { id: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = !on;
          setOn(next);
          try {
            await setChaseRepliedByEmailAction(id, next);
          } catch {
            setOn(!next); // revert on failure
          }
        })
      }
      title="Tick if the solicitor replied to this chase by email"
      className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors disabled:opacity-40 ${
        on
          ? "bg-emerald-950 text-emerald-400 border-emerald-900"
          : "bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-300"
      }`}
    >
      {on ? "✓ email reply" : "email reply"}
    </button>
  );
}
