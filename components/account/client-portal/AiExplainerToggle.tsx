"use client";

// Account → Client portal: on/off for the client "explain this email" AI helper.
// When off, buyers and sellers won't see the paste-an-email explainer in their
// portal. Agency-wide, director-only. Optimistic flip with revert on error,
// mirroring the other portal toggles' switch styling.

import { useState, useTransition } from "react";
import { setAgencyAiExplainEmail } from "@/app/actions/portal-display";
import { LiquidToggle } from "@/components/ui/LiquidToggle";

export function AiExplainerToggle({ initial }: { initial: boolean }) {
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !value;
    setError(null);
    setValue(next);
    start(async () => {
      const res = await setAgencyAiExplainEmail(next);
      if (!res.ok) {
        setValue(!next);
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[14px] font-bold text-slate-900">Explain-email helper</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500 max-w-xl">
          Let clients paste a solicitor email and get a plain-English summary in their portal. Turn this
          off to hide the helper from your buyers and sellers.
        </p>
        {error && <p className="mt-1 text-[12px] text-red-500">{error}</p>}
      </div>
      <div className="mt-0.5">
        <LiquidToggle
          checked={value}
          onChange={() => toggle()}
          width={44}
          height={24}
          color="var(--agent-coral, #FF8A65)"
          disabled={pending}
          aria-label="Explain-email helper"
        />
      </div>
    </div>
  );
}
