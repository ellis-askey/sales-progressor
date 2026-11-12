"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { setAiEnabledAction } from "@/app/actions/ai-switch";

// Command Centre → Settings → the global AI master switch (#291). When off,
// every AI feature stops running (server short-circuits) and its UI trigger is
// hidden, so the product runs on deterministic code alone. An env break-glass
// (AI_GLOBAL_DISABLE=true) locks this off and disables the control.
export function AiMasterSwitch({ enabled, envForcedOff }: { enabled: boolean; envForcedOff: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  const effectiveOn = envForcedOff ? false : on;

  function toggle() {
    if (envForcedOff || pending) return;
    const next = !on;
    setOn(next);
    start(async () => {
      try {
        await setAiEnabledAction(next);
        router.refresh();
      } catch {
        setOn(!next); // revert on failure
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
            <Sparkles size={15} className={effectiveOn ? "text-blue-400" : "text-neutral-600"} />
            AI features
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-500">
            Master switch for every AI-powered feature — chase &amp; email drafting, update drafting, voice notes,
            email explainers, file summaries, insights &amp; briefs, problem detection, prospect research, outreach and
            the content studio. Turn this off to run the platform on deterministic code alone: the features stop
            running and their buttons are hidden. Everything non-AI is unaffected.
          </p>
          {envForcedOff ? (
            <p className="mt-2 text-[12px] font-medium text-amber-400">
              Locked off by the AI_GLOBAL_DISABLE environment override. Clear that env var to control it here.
            </p>
          ) : (
            <p className="mt-2 text-[12px] text-neutral-500">
              Currently <span className={effectiveOn ? "font-semibold text-emerald-400" : "font-semibold text-neutral-300"}>{effectiveOn ? "on — AI is running" : "off — running on code alone"}</span>.
            </p>
          )}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={effectiveOn}
          aria-label="Toggle AI features"
          onClick={toggle}
          disabled={envForcedOff || pending}
          className={`relative mt-1 inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            effectiveOn ? "bg-blue-600" : "bg-neutral-700"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              effectiveOn ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
