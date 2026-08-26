"use client";

// Director control on Settings → Automation: turn the weekly "all on track"
// client update on or off for the whole agency. Unsubscribed clients are never
// emailed regardless (enforced at send time).

import { useState, useTransition } from "react";
import { setWeeklyClientUpdatesEnabled } from "@/app/actions/automation";

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
          <h2 className="text-[15px] font-semibold text-slate-900">Weekly client update</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500 max-w-xl">
            A short &ldquo;everything&rsquo;s on track&rdquo; email to clients on active files that haven&rsquo;t
            heard from you in the last week. Anyone who has unsubscribed is never included.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Weekly client update"
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
        {enabled ? "On — clients get a weekly check-in." : "Off — no weekly update is sent."}
      </p>
      {error && <p className="mt-2 text-[12.5px] text-red-500">{error}</p>}
    </section>
  );
}
