"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkle } from "lucide-react";
import { refreshBrandReviewAction } from "@/app/actions/brand-strategy";

// Brand review (docs/active/content-brand/SPEC.md, Phase 2.3). The latest AI read
// of where Ellis's brand stands: lean into / getting overused / breakout /
// underused expertise, plus a short honest summary of what he's becoming known
// for. Refresh generates a new one.

type Review = {
  id: string;
  createdAt: string;
  summary: string;
  leanInto: string[];
  overused: string[];
  breakout: string[];
  underusedExpertise: string[];
};

function agoLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "generated today";
  if (days === 1) return "generated yesterday";
  if (days < 14) return `generated ${days} days ago`;
  const weeks = Math.round(days / 7);
  return `generated ${weeks} weeks ago`;
}

export function BrandReviewPanel({ initial }: { initial: Review | null }) {
  const router = useRouter();
  const [review, setReview] = useState<Review | null>(initial);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  function refresh() {
    setNote(null);
    startTransition(async () => {
      const res = await refreshBrandReviewAction();
      if (res.ok && res.review) {
        setReview({ ...res.review, createdAt: new Date(res.review.createdAt).toISOString() });
      } else {
        setNote("Couldn't generate a review right now. Fill in more of your brand and try again.");
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-neutral-600">{review ? agoLabel(review.createdAt) : "No review yet"}</span>
        <button
          onClick={refresh}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-50"
        >
          <Sparkle size={13} className={pending ? "animate-pulse" : ""} />
          {pending ? "Reviewing…" : review ? "Refresh review" : "Generate review"}
        </button>
      </div>

      {note && <p className="text-[12px] text-amber-400/90">{note}</p>}

      {!review ? (
        <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 px-4 py-8 text-center">
          <p className="text-sm text-neutral-300 font-medium">No brand review yet</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-600">
            Generate one to see what you&rsquo;re becoming known for and where to lean next. It gets sharper as your
            brand and posting history fill in.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {review.summary && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Becoming known for</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-200">{review.summary}</p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <ReviewList title="Lean into" tone="good" items={review.leanInto} />
            <ReviewList title="Getting overused" tone="watch" items={review.overused} />
            <ReviewList title="Breakout potential" tone="info" items={review.breakout} />
            <ReviewList title="Underused expertise" tone="neutral" items={review.underusedExpertise} />
          </div>
        </div>
      )}
    </div>
  );
}

const TITLE_TONE: Record<string, string> = {
  good: "text-emerald-300",
  watch: "text-amber-300",
  info: "text-blue-300",
  neutral: "text-neutral-300",
};

function ReviewList({ title, tone, items }: { title: string; tone: "good" | "watch" | "info" | "neutral"; items: string[] }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className={`text-[11px] font-semibold uppercase tracking-wider ${TITLE_TONE[tone]}`}>{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-[12px] text-neutral-600">Nothing here.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-neutral-300">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-600" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
