"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { platformLabel, treatmentLabel } from "@/lib/command/content/platforms";

// Platform adaptation panel (docs/active/content-brand/SPEC.md, Phase 4.1). One
// core post, adapted for LinkedIn / Instagram / Facebook on demand. Each version
// is its own text with its own treatment, never a copy-paste.

type Adaptation = { platform: string; treatment: string | null; text: string; mediaHint: string | null };

export function AdaptPanel({ draftId, text }: { draftId: string; text: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adaptations, setAdaptations] = useState<Adaptation[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  async function adapt() {
    setBusy(true);
    setError(null);
    setOpen(true);
    try {
      const res = await fetch("/api/command/content/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Adaptation failed");
      setAdaptations(data.adaptations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Adaptation failed");
    } finally {
      setBusy(false);
    }
  }

  function copy(platform: string, value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(platform);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="border-t border-neutral-800 pt-3">
      <button
        onClick={adapt}
        disabled={busy || !text.trim()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40"
      >
        <Share2 size={13} className={busy ? "animate-pulse" : ""} />
        {busy ? "Adapting…" : adaptations.length ? "Re-adapt for platforms" : "Adapt for platforms"}
      </button>

      {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}

      {open && adaptations.length > 0 && (
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {adaptations.map((a) => (
            <div key={a.platform} className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-neutral-200">{platformLabel(a.platform)}</span>
                {treatmentLabel(a.treatment) && (
                  <span className="rounded border border-neutral-700 bg-neutral-800/60 px-1.5 py-0.5 text-[10px] text-neutral-300">{treatmentLabel(a.treatment)}</span>
                )}
                <button
                  onClick={() => copy(a.platform, a.text)}
                  className="ml-auto rounded-md px-2 py-0.5 text-[11px] font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
                >
                  {copied === a.platform ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-neutral-300">{a.text}</p>
              {a.mediaHint && (
                <p className="mt-2 border-t border-neutral-800 pt-2 text-[11px] text-neutral-500">
                  <span className="text-neutral-600">Visual: </span>{a.mediaHint}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
