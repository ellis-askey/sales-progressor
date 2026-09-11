"use client";

import { useState } from "react";
import Link from "next/link";
import { Image as ImageIcon } from "lucide-react";
import { treatmentLabel } from "@/lib/command/content/platforms";

// Media treatment suggestion (docs/active/content-brand/SPEC.md, Phase 4.2).
// Recommends a visual treatment + a branded-card headline, previews it with the
// existing text-card route, and hands off to the image studio to finish it.

type Suggestion = { treatment: string; headline: string; brief: string };

export function SuggestVisualPanel({ text }: { text: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [s, setS] = useState<Suggestion | null>(null);
  const [copied, setCopied] = useState(false);

  async function suggest() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/command/content/suggest-visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not suggest a visual");
      setS(data as Suggestion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not suggest a visual");
    } finally {
      setBusy(false);
    }
  }

  const previewUrl = s?.headline
    ? `/api/command/content/images/text-card?text=${encodeURIComponent(s.headline)}&variant=dark`
    : null;

  return (
    <div className="border-t border-neutral-800 pt-3">
      <button
        onClick={suggest}
        disabled={busy || !text.trim()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40"
      >
        <ImageIcon size={13} className={busy ? "animate-pulse" : ""} />
        {busy ? "Thinking…" : s ? "Suggest another visual" : "Suggest a visual"}
      </button>

      {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}

      {s && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr]">
          <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Branded card preview" className="block w-full" />
            ) : (
              <div className="flex h-32 items-center justify-center text-[11px] text-neutral-600">No preview</div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded border border-blue-900/60 bg-blue-950/30 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
                {treatmentLabel(s.treatment)}
              </span>
              {s.headline && (
                <button
                  onClick={() => navigator.clipboard.writeText(s.headline).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
                >
                  {copied ? "Copied" : "Copy headline"}
                </button>
              )}
            </div>
            {s.headline && <p className="text-[13px] font-medium leading-snug text-neutral-100">{s.headline}</p>}
            {s.brief && <p className="text-[12px] leading-relaxed text-neutral-500">{s.brief}</p>}
            <Link href="/command/content/drafts" className="inline-block text-[12px] font-medium text-blue-400 transition-colors hover:text-blue-300">
              Open the image studio to finish it →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
