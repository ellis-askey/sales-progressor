"use client";

import { useState, useTransition } from "react";
import { markAsPostedAction, discardDraftAction } from "@/app/actions/draft-posts";

interface Props {
  draftId: string;
  variantNum: 1 | 2;
  text: string;
  charLimit: number;
  onAction: () => void;
}

export function DraftVariantPanel({ draftId, variantNum, text, charLimit, onAction }: Props) {
  const [editedText, setEditedText] = useState(text);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const charCount = editedText.length;
  const overLimit = charCount > charLimit;

  function copy() {
    navigator.clipboard.writeText(editedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleMarkPosted(formData: FormData) {
    startTransition(async () => {
      await markAsPostedAction(formData);
      onAction();
    });
  }

  function handleDiscard(formData: FormData) {
    startTransition(async () => {
      await discardDraftAction(formData);
      onAction();
    });
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
          Variant {variantNum}
        </span>
        <span className={`text-[11px] tabular-nums ${overLimit ? "text-red-400" : "text-neutral-600"}`}>
          {charCount} / {charLimit}
        </span>
      </div>

      <textarea
        value={editedText}
        onChange={(e) => setEditedText(e.target.value)}
        rows={8}
        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-neutral-500 resize-y leading-relaxed"
      />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {/* Copy */}
        <button
          type="button"
          onClick={copy}
          className="text-xs px-3 py-1.5 bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-700 hover:border-neutral-600 rounded-lg transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>

        {/* Mark as posted */}
        <form action={handleMarkPosted}>
          <input type="hidden" name="draftId" value={draftId} />
          <input type="hidden" name="editedText" value={editedText} />
          <input type="hidden" name="chosenVariant" value={variantNum} />
          <button
            type="submit"
            disabled={isPending || overLimit}
            className="text-xs px-3 py-1.5 bg-emerald-950 text-emerald-400 border border-emerald-900 hover:bg-emerald-900 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? "Saving…" : "Mark as posted"}
          </button>
        </form>

        {/* Discard (only on variant 1 — discards the whole draft) */}
        {variantNum === 1 && (
          <form action={handleDiscard}>
            <input type="hidden" name="draftId" value={draftId} />
            <button
              type="submit"
              disabled={isPending}
              className="text-xs px-3 py-1.5 text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-40"
            >
              Discard
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
