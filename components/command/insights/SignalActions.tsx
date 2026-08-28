"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  acknowledgeSignalAction,
  snoozeSignalAction,
  dismissSignalAction,
  promoteSignalToExperimentAction,
} from "@/app/actions/command-centre";

const BTN = "text-xs px-2 py-1 rounded-md border transition-colors disabled:opacity-40";

export function SignalActions({
  signalId,
  href,
  experimentable,
}: {
  signalId: string;
  href: string | null;
  experimentable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [promotedTo, setPromotedTo] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1.5 shrink-0 relative">
      {href && (
        <Link
          href={href}
          className={`${BTN} bg-blue-950/40 text-blue-400 border-blue-900 hover:bg-blue-950/70`}
        >
          Open
        </Link>
      )}

      {experimentable && (
        promotedTo ? (
          <Link href={`/command/experiments`} className="text-xs text-emerald-500 hover:text-emerald-400">
            Added → view
          </Link>
        ) : (
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const { experimentId } = await promoteSignalToExperimentAction(signalId);
                setPromotedTo(experimentId);
              })
            }
            className={`${BTN} bg-emerald-950 text-emerald-400 border-emerald-900 hover:bg-emerald-900`}
          >
            Make a test
          </button>
        )
      )}

      {/* Snooze */}
      <div className="relative">
        <button
          disabled={pending}
          onClick={() => setSnoozeOpen((v) => !v)}
          className={`${BTN} bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200`}
        >
          Snooze
        </button>
        {snoozeOpen && (
          <div className="absolute right-0 top-full mt-1 z-20 bg-neutral-950 border border-neutral-700 rounded-lg shadow-xl overflow-hidden">
            {[
              { label: "3 days", days: 3 },
              { label: "1 week", days: 7 },
              { label: "2 weeks", days: 14 },
            ].map((o) => (
              <button
                key={o.days}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setSnoozeOpen(false);
                    await snoozeSignalAction(signalId, o.days);
                  })
                }
                className="block w-full text-left text-xs px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 whitespace-nowrap"
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        disabled={pending}
        onClick={() => startTransition(() => acknowledgeSignalAction(signalId))}
        className={`${BTN} bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200`}
      >
        Done
      </button>

      <button
        disabled={pending}
        onClick={() => startTransition(() => dismissSignalAction(signalId))}
        title="Clear it and stop this one surfacing"
        className={`${BTN} bg-transparent text-neutral-600 border-transparent hover:text-neutral-400`}
      >
        Not useful
      </button>
    </div>
  );
}
