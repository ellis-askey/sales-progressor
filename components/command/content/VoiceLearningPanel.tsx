"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkle, X } from "lucide-react";
import { refreshVoiceProfileAction, dismissVoiceCharacteristicAction } from "@/app/actions/voice-learning";

// Learned voice (docs/active/content-brand/SPEC.md, Phase 3.3). What we've picked
// up from how Ellis edits AI drafts. Inspectable and correctable: he can remove
// a wrong assumption and a refresh won't bring it back.

type Characteristic = { id: string; text: string };
type Profile = { characteristics: Characteristic[]; generatedAt: string | null; sampleCount: number; totalEdits: number };

function agoLabel(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "updated today";
  if (days === 1) return "updated yesterday";
  return `updated ${days} days ago`;
}

export function VoiceLearningPanel({ initial, minEdits }: { initial: Profile; minEdits: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const enough = initial.totalEdits >= minEdits;

  function refresh() {
    setNote(null);
    startTransition(async () => {
      const res = await refreshVoiceProfileAction();
      if (!res.ok) {
        setNote(res.reason === "need_more" ? `Need at least ${minEdits} edited posts first.` : "Couldn't update right now.");
      }
      router.refresh();
    });
  }

  function dismiss(text: string) {
    const fd = new FormData();
    fd.set("text", text);
    startTransition(async () => {
      await dismissVoiceCharacteristicAction(fd);
      router.refresh();
    });
  }

  if (!enough) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 px-4 py-8 text-center">
        <p className="text-sm text-neutral-300 font-medium">Learning your voice</p>
        <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-600">
          When you edit a generated draft and mark it posted, we note what you changed. After a few of those, a picture
          of how you actually write appears here. {initial.totalEdits} of {minEdits} so far.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-neutral-600">
          {initial.characteristics.length > 0
            ? `From ${initial.sampleCount} edits · ${agoLabel(initial.generatedAt)}`
            : `${initial.totalEdits} edits ready to learn from`}
        </span>
        <button
          onClick={refresh}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-50"
        >
          <Sparkle size={13} className={pending ? "animate-pulse" : ""} />
          {pending ? "Learning…" : initial.characteristics.length > 0 ? "Update" : "Learn now"}
        </button>
      </div>

      {note && <p className="text-[12px] text-amber-400/90">{note}</p>}

      {initial.characteristics.length === 0 ? (
        <p className="text-[12px] text-neutral-600">No profile yet. Run it to see what we&rsquo;ve learned.</p>
      ) : (
        <ul className="space-y-1.5">
          {initial.characteristics.map((c) => (
            <li key={c.id} className="group flex items-start gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-600" />
              <span className="flex-1 text-[12.5px] leading-relaxed text-neutral-300">{c.text}</span>
              <button
                onClick={() => dismiss(c.text)}
                disabled={pending}
                title="Not right, remove it"
                className="mt-0.5 shrink-0 rounded p-0.5 text-neutral-600 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100 disabled:opacity-40"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-neutral-600">Remove anything that isn&rsquo;t right. We won&rsquo;t bring it back.</p>
    </div>
  );
}
