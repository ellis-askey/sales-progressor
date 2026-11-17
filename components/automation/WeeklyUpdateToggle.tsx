"use client";

// Director control on Settings → Automation: turn the weekly "all on track"
// client update on or off for the whole agency. Unsubscribed clients are never
// emailed regardless (enforced at send time).

import { useState, useTransition } from "react";
import { setWeeklyClientUpdatesEnabled } from "@/app/actions/automation";
import { LiquidToggle } from "@/components/ui/LiquidToggle";

export function WeeklyUpdateToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setError(null);
    start(async () => {
      const res = await setWeeklyClientUpdatesEnabled(next);
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
          <h2 className="text-[15px] font-semibold text-slate-900">Weekly client updates</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500 max-w-xl">
            A short check-in for clients on active sales who haven&rsquo;t
            heard from you in the last week. Anyone who has unsubscribed is never included.
          </p>
        </div>
        <LiquidToggle
          checked={enabled}
          onChange={() => toggle()}
          width={44}
          height={24}
          color={"var(--agent-coral, #FF8A65)"}
          disabled={pending}
          aria-label="Weekly client updates"
        />
      </div>
      <p className="mt-3 text-[12.5px] font-medium text-slate-600">
        {enabled ? "On. Clients receive a weekly check-in." : "Off. No weekly client update is sent."}
      </p>
      {error && <p className="mt-2 text-[12.5px] text-red-500">{error}</p>}
    </section>
  );
}
