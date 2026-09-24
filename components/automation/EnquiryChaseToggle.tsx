"use client";

// Director control on Account → Emails: turn the enquiries auto-chase on or
// off for the whole agency. Flips both the "get enquiries raised" nudges and the
// reply-loop chase. Solicitors only — clients are never chased by this. Any single
// file can be opted out in that file's Email settings.

import { useState, useTransition } from "react";
import { setAgencyEnquiryChaseEnabled } from "@/app/actions/automation";

export function EnquiryChaseToggle({ initialEnabled, bare = false }: { initialEnabled: boolean; bare?: boolean }) {
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

  const Wrapper = bare ? "div" : "section";

  return (
    <Wrapper className={bare ? "" : "mt-6 rounded-xl border border-slate-200 bg-white p-5"}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {!bare && <h2 className="text-[15px] font-semibold text-slate-900">Chase enquiries automatically</h2>}
          <p className={`${bare ? "" : "mt-1 "}text-[13px] leading-relaxed text-slate-500 max-w-xl`}>
            {bare
              ? "When on, we chase the solicitor who owes replies until the loop moves, automatically."
              : "Keep the enquiry stage moving without chasing by hand. Solicitors only, your clients are never chased by this."}
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

      {/* What happens, when — a designed cadence: bell nudge → two diary-dated
          chases → broadcast handover, with the gap between each in the eyebrow. */}
      <div className="mt-4 rounded-xl bg-slate-50/70 border border-slate-200 p-4">
        <p className="text-[12.5px] font-semibold text-slate-700">What happens when it&rsquo;s on</p>

        <div className="mt-3 flex flex-col">
          {/* Before raised — bell */}
          <div className="grid grid-cols-[44px_1fr] gap-3.5 items-center rounded-xl border border-slate-200 border-l-[3px] border-l-slate-300 bg-white p-3 shadow-sm">
            <div className="flex justify-center text-slate-400">
              <svg className="w-[26px] h-[26px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
            </div>
            <div>
              <p className="text-[13.5px] font-semibold text-slate-800 leading-snug">Before enquiries are raised</p>
              <p className="mt-0.5 text-[12.5px] text-slate-500 leading-snug">Gentle reminders to get things moving.</p>
            </div>
          </div>

          <div className="ml-[34px] h-3.5 border-l border-dashed border-slate-300" aria-hidden />

          {/* Day 6 — diary tile */}
          <div className="grid grid-cols-[44px_1fr] gap-3.5 items-center rounded-xl border border-slate-200 border-l-[3px] border-l-[#FF6B4A] bg-white p-3 shadow-sm">
            <div className="flex justify-center">
              <div className="relative w-11 h-12 rounded-lg bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="h-[13px] bg-[#FF6B4A]" />
                <div className="flex-1 flex items-center justify-center font-mono font-extrabold text-[17px] text-slate-800 tabular-nums">6</div>
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[#e8471f]">Working day 6</p>
              <p className="text-[13.5px] font-semibold text-slate-800 leading-snug">First chase</p>
              <p className="mt-0.5 text-[12.5px] text-slate-500 leading-snug">We email the solicitor who owes the replies.</p>
            </div>
          </div>

          <div className="ml-[34px] h-3.5 border-l border-dashed border-slate-300" aria-hidden />

          {/* Day 11 — diary tile */}
          <div className="grid grid-cols-[44px_1fr] gap-3.5 items-center rounded-xl border border-slate-200 border-l-[3px] border-l-[#FF6B4A] bg-white p-3 shadow-sm">
            <div className="flex justify-center">
              <div className="relative w-11 h-12 rounded-lg bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="h-[13px] bg-[#FF6B4A]" />
                <div className="flex-1 flex items-center justify-center font-mono font-extrabold text-[17px] text-slate-800 tabular-nums">11</div>
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[#e8471f]">5 working days later</p>
              <p className="text-[13.5px] font-semibold text-slate-800 leading-snug">Second chase</p>
              <p className="mt-0.5 text-[12.5px] text-slate-500 leading-snug">If replies are still outstanding, we follow up again.</p>
            </div>
          </div>

          <div className="ml-[34px] h-3.5 border-l border-dashed border-slate-300" aria-hidden />

          {/* Handover — broadcast / raise-signal */}
          <div className="grid grid-cols-[44px_1fr] gap-3.5 items-center rounded-xl border border-slate-200 border-l-[3px] border-l-amber-400 bg-white p-3 shadow-sm">
            <div className="flex justify-center text-amber-500">
              <svg className="w-[26px] h-[26px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="13.5" r="2" fill="currentColor" stroke="none" /><path d="M8.6 10.1a5 5 0 0 0 0 6.8" /><path d="M15.4 10.1a5 5 0 0 1 0 6.8" /><path d="M6.2 7.6a8.5 8.5 0 0 0 0 11.8" /><path d="M17.8 7.6a8.5 8.5 0 0 1 0 11.8" /></svg>
            </div>
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-600">2 working days later</p>
              <p className="text-[13.5px] font-semibold text-slate-800 leading-snug">Handed back to you</p>
              <p className="mt-0.5 text-[12.5px] text-slate-500 leading-snug">If there&rsquo;s still no reply, we stop emailing and flag it on your Hub.</p>
            </div>
          </div>
        </div>

        {/* Behaviours — clean strip, no washed card */}
        <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap gap-x-6 gap-y-2">
          <span className="inline-flex items-center gap-2 text-[12.5px] text-slate-500">
            <svg className="w-4 h-4 text-[#FF6B4A] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
            A <b className="font-semibold text-slate-700">reply resets the clock</b>
          </span>
          <span className="inline-flex items-center gap-2 text-[12.5px] text-slate-500">
            <svg className="w-4 h-4 text-[#FF6B4A] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="12" rx="6" /><circle cx="8" cy="12" r="3" fill="currentColor" stroke="none" /></svg>
            Switch off <b className="font-semibold text-slate-700">anytime, per file</b>
          </span>
        </div>
      </div>

      <p className="mt-3 text-[12.5px] font-medium text-slate-600">
        {enabled ? "On. We chase solicitors on your enquiry files." : "Off. No automatic enquiry chasing."}
      </p>
      {error && <p className="mt-2 text-[12.5px] text-red-500">{error}</p>}
    </Wrapper>
  );
}
