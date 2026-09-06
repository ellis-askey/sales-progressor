"use client";

// Director control on Settings → Automation: when a seller confirms a step on
// their onward purchase, let the agent handling that onward purchase know. Only
// agents you've already invited to the chain are ever emailed, and they can
// unsubscribe. Off by default. See docs/active/three-notes-distilled-2026-08-27.md.

import { useState, useTransition } from "react";
import { setChainNeighbourUpdatesEnabled } from "@/app/actions/automation";

export function ChainNeighbourUpdatesToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setError(null);
    start(async () => {
      const res = await setChainNeighbourUpdatesEnabled(next);
      if (!res.ok) {
        setEnabled(!next);
        setError(res.error);
      }
    });
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">Chain neighbour updates</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500 max-w-xl">
            When your buyer or seller confirms a step on their related sale or onward purchase, we
            let the neighbouring agent handling that sale know. Only agents you&rsquo;ve already
            invited to the chain are ever emailed, and they can unsubscribe anytime.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Chain neighbour updates"
          disabled={pending}
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            enabled ? "bg-[#FF6B4A]" : "bg-slate-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-[22px]" : "translate-x-[2px]"
            }`}
          />
        </button>
      </div>
      <p className="mt-3 text-[12.5px] font-medium text-slate-600">
        {enabled ? "On. Invited neighbouring agents get a heads-up when your buyer or seller confirms a step." : "Off. No neighbour updates are sent."}
      </p>
      {error && <p className="mt-2 text-[12.5px] text-red-500">{error}</p>}
    </section>
  );
}
