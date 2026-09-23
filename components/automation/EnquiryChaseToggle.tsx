"use client";

// Director control on Settings → Automation: turn the enquiries auto-chase on or
// off for the whole agency. Flips both the "get enquiries raised" nudges and the
// reply-loop chase. Solicitors only — clients are never chased by this. Any single
// file can be opted out in that file's Email settings.

import { useState, useTransition } from "react";
import { setAgencyEnquiryChaseEnabled } from "@/app/actions/automation";

export function EnquiryChaseToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setError(null);
    start(async () => {
      const res = await setAgencyEnquiryChaseEnabled(next);
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
          <h2 className="text-[15px] font-semibold text-slate-900">Chase enquiries automatically</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500 max-w-xl">
            Keep the enquiry stage moving without chasing by hand. Solicitors only —
            your clients are never chased by this.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Chase enquiries automatically"
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

      {/* What actually sends, when — the plain-English explainer. */}
      <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3.5">
        <p className="text-[12.5px] font-semibold text-slate-700">What we send when it&rsquo;s on</p>
        <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-slate-600">
          <li>· Before enquiries are raised, we send gentle nudges to get them raised.</li>
          <li>· Once they&rsquo;re open, we email the solicitor who owes replies on working day 6, again on day 11.</li>
          <li>· If it&rsquo;s still silent on day 13, we stop emailing and flag it to you in the hub instead.</li>
          <li>· A reply resets the clock. You can switch any single file off in its Email settings.</li>
        </ul>
      </div>

      <p className="mt-3 text-[12.5px] font-medium text-slate-600">
        {enabled ? "On. We chase solicitors on your enquiry files." : "Off. No automatic enquiry chasing."}
      </p>
      {error && <p className="mt-2 text-[12.5px] text-red-500">{error}</p>}
    </section>
  );
}
