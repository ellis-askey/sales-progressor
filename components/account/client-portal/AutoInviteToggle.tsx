"use client";

// Account → Client portal: the "invite clients on sale-add" toggle. Controls
// whether adding an outsourced sale emails the buyer + seller their portal link
// straight away (the "Getting your sale moving" intro). Agency-wide, director-
// only. Optimistic flip with revert on error, mirroring ClientPortalSettings'
// toggle rows (same switch + meta styling) so it sits in the same visual family.

import { useState, useTransition } from "react";
import { setAgencyAutoInvite } from "@/app/actions/portal-display";

export function AutoInviteToggle({ initial }: { initial: boolean }) {
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !value;
    setError(null);
    setValue(next);
    start(async () => {
      const res = await setAgencyAutoInvite(next);
      if (!res.ok) {
        setValue(!next);
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[14px] font-bold text-slate-900">Invite clients when you add a sale</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500 max-w-xl">
          We&apos;ll email the buyer and seller their portal link as soon as the sale is added. Turn this off to add
          sales quietly and send the invite yourself when you&apos;re ready.
        </p>
        {error && <p className="mt-1 text-[12px] text-red-500">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label="Invite clients when you add a sale"
        disabled={pending}
        onClick={toggle}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${value ? "bg-[#FF6B4A]" : "bg-slate-300"}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
      </button>
    </div>
  );
}
