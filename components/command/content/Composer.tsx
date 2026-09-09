"use client";

import { useState, useTransition } from "react";
import { markAsPostedAction, discardDraftAction, approveForBatchAction, removeFromBatchAction } from "@/app/actions/draft-posts";
import { REFINE_ACTIONS, type PromoIntensity } from "@/lib/command/content/refine-actions";

// Premium composer (docs/active/content-brand/SPEC.md, Phase 3.1). The post
// dominates. A calm toolbar of substance-steering AI actions, a low-to-high
// promotional-intensity control, and an "explain what changed" read. Save,
// batch and mark-as-posted reuse the existing draft-post actions.

type Props = {
  draftId: string;
  variantNum: 1 | 2;
  initialText: string;
  charLimit: number;
  onDiscarded?: () => void;
};

const INTENSITIES: PromoIntensity[] = ["low", "medium", "high"];

export function Composer({ draftId, variantNum, initialText, charLimit, onDiscarded }: Props) {
  const [text, setText] = useState(initialText);
  const [baseline] = useState(initialText);
  const [intensity, setIntensity] = useState<PromoIntensity>("low");
  const [changed, setChanged] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Footer state
  const [copied, setCopied] = useState(false);
  const [inBatch, setInBatch] = useState(false);
  const [posted, setPosted] = useState(false);
  const [pending, startTransition] = useTransition();

  const over = text.length > charLimit;

  async function refine(action: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/command/content/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, action, promotionalIntensity: intensity, baseline }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refine failed");
      if (action !== "explain_changes") setText(data.revised);
      setChanged(data.changed || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refine failed");
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function markPosted(formData: FormData) {
    startTransition(async () => {
      await markAsPostedAction(formData);
      setPosted(true);
    });
  }

  function toggleBatch() {
    const fd = new FormData();
    fd.set("draftId", draftId);
    fd.set("variantNum", String(variantNum));
    fd.set("editedText", text);
    startTransition(async () => {
      if (inBatch) {
        const rm = new FormData();
        rm.set("draftId", draftId);
        await removeFromBatchAction(rm);
        setInBatch(false);
      } else {
        await approveForBatchAction(fd);
        setInBatch(true);
      }
    });
  }

  function discard() {
    if (!window.confirm("Discard this draft?")) return;
    const fd = new FormData();
    fd.set("draftId", draftId);
    startTransition(async () => {
      await discardDraftAction(fd);
      onDiscarded?.();
    });
  }

  if (posted) {
    return (
      <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 px-5 py-6 text-center">
        <p className="text-sm font-medium text-emerald-300">Marked as posted</p>
        <p className="mt-1 text-[12px] text-neutral-500">It&rsquo;s in your posted history and the outbound log.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Intensity + count */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Promotion</span>
        <div className="flex gap-0.5 rounded-md border border-neutral-800 bg-neutral-950 p-0.5">
          {INTENSITIES.map((lvl) => (
            <button
              key={lvl}
              onClick={() => setIntensity(lvl)}
              className={`rounded px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                intensity === lvl ? "bg-blue-600/30 text-blue-200" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
        <span className={`ml-auto text-[11px] tabular-nums ${over ? "text-red-400" : "text-neutral-600"}`}>
          {text.length} / {charLimit}
        </span>
      </div>

      {/* The post dominates */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        className="w-full resize-y rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3.5 text-[15px] leading-relaxed text-neutral-100 focus:border-blue-600/50 focus:outline-none"
      />

      {/* AI actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        {REFINE_ACTIONS.map((a) => (
          <button
            key={a.id}
            onClick={() => refine(a.id)}
            disabled={busy || pending}
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-[11.5px] font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40"
          >
            {a.label}
          </button>
        ))}
        <button
          onClick={() => refine("explain_changes")}
          disabled={busy || pending}
          className="rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium text-neutral-500 transition-colors hover:text-neutral-300 disabled:opacity-40"
        >
          Explain what changed
        </button>
        {busy && <span className="text-[11px] text-neutral-500">Working…</span>}
      </div>

      {changed && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-[12px] leading-relaxed text-neutral-400">
          <span className="text-neutral-600">What changed: </span>{changed}
        </div>
      )}
      {error && <p className="text-[12px] text-red-400">{error}</p>}

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-800 pt-3">
        <button onClick={copy} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-[12px] text-neutral-300 transition-colors hover:text-neutral-100">
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={toggleBatch}
          disabled={pending || over}
          className={`rounded-lg border px-3 py-1.5 text-[12px] transition-colors disabled:opacity-40 ${
            inBatch ? "border-orange-900 bg-orange-950 text-orange-300" : "border-neutral-700 text-neutral-300 hover:text-neutral-100"
          }`}
        >
          {inBatch ? "In batch. Remove" : "Add to batch"}
        </button>

        <form action={markPosted} className="flex items-center gap-2">
          <input type="hidden" name="draftId" value={draftId} />
          <input type="hidden" name="editedText" value={text} />
          <input type="hidden" name="chosenVariant" value={variantNum} />
          <input
            type="url"
            name="postedUrl"
            placeholder="Post URL (optional)"
            className="w-44 rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-[12px] text-neutral-300 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending || over}
            className="rounded-lg border border-emerald-900 bg-emerald-950 px-3 py-1.5 text-[12px] text-emerald-300 transition-colors hover:bg-emerald-900 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Mark as posted"}
          </button>
        </form>

        <button onClick={discard} disabled={pending} className="ml-auto text-[12px] text-neutral-600 transition-colors hover:text-red-400 disabled:opacity-40">
          Discard
        </button>
      </div>
    </div>
  );
}
