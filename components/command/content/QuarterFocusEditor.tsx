"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveQuarterFocusAction } from "@/app/actions/brand-strategy";

// Rolling quarter focus (docs/active/content-brand/SPEC.md, Phase 2.3). One line
// on what Ellis wants to be known for right now. Steers the brand review and
// opportunities without a rigid plan.

export function QuarterFocusEditor({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = value.trim() !== initial.trim();

  function save() {
    const fd = new FormData();
    fd.set("quarterFocus", value.trim());
    startTransition(async () => {
      const res = await saveQuarterFocusAction(fd);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="e.g. The person estate agents trust on why chains fall through and how to stop it."
        className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-[13px] text-neutral-100 placeholder:text-neutral-600 focus:border-blue-600/50 focus:outline-none"
      />
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-[11px] text-emerald-400">Saved</span>}
        <button
          onClick={save}
          disabled={pending || !dirty}
          className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save focus"}
        </button>
      </div>
    </div>
  );
}
