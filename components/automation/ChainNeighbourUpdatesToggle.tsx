"use client";

// Director control on Settings → Automation: when a seller confirms a step on
// their onward purchase, let the agent handling that onward purchase know. Only
// agents you've already invited to the chain are ever emailed, and they can
// unsubscribe. Off by default. See docs/active/three-notes-distilled-2026-08-27.md.

import { useState, useTransition } from "react";
import { setChainNeighbourUpdatesEnabled } from "@/app/actions/automation";
import { LiquidToggle } from "@/components/ui/LiquidToggle";

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
          <h2 className="text-[15px] font-semibold text-slate-900">Chain updates</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500 max-w-xl">
            When your buyer or seller confirms a step on their related sale or onward purchase, we&rsquo;ll
            let the agent handling that sale know. Only agents you&rsquo;ve already
            invited to the chain are contacted, and they can unsubscribe at any time.
          </p>
        </div>
        <LiquidToggle
          checked={enabled}
          onChange={() => toggle()}
          width={44}
          height={24}
          color={"var(--agent-coral, #FF8A65)"}
          disabled={pending}
          aria-label="Chain updates"
        />
      </div>
      <p className="mt-3 text-[12.5px] font-medium text-slate-600">
        {enabled ? "On. Invited agents are updated when your buyer or seller confirms a step." : "Off. No updates are sent to neighbouring agents."}
      </p>
      {error && <p className="mt-2 text-[12.5px] text-red-500">{error}</p>}
    </section>
  );
}
