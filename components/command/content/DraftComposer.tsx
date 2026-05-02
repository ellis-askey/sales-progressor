"use client";

import { useState, useRef } from "react";
import type { Channel } from "@/lib/command/content/channels";
import type { Tone } from "@/lib/command/content/tones";
import { DraftVariantPanel } from "@/components/command/content/DraftVariantPanel";

interface GeneratedDraft {
  draftId: string;
  variant1: string;
  variant2: string;
}

interface Props {
  channels: Channel[];
  tones: Tone[];
}

export function DraftComposer({ channels, tones }: Props) {
  const [channelId, setChannelId] = useState(channels[0].id);
  const [toneId, setToneId] = useState(tones[0].id);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<GeneratedDraft | null>(null);
  const draftRef = useRef<HTMLDivElement>(null);

  const selectedChannel = channels.find((c) => c.id === channelId) ?? channels[0];

  async function generate(regenerate = false) {
    if (!topic.trim()) {
      setError("Enter a topic before generating.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/command/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: channelId,
          toneId,
          topic: topic.trim(),
          regenerateDraftId: regenerate && draft ? draft.draftId : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Generation failed");
      }

      const data = (await res.json()) as GeneratedDraft;
      setDraft(data);

      // Scroll to draft
      setTimeout(() => draftRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  function onPostedOrDiscarded() {
    setDraft(null);
    setTopic("");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Channel picker */}
      <div>
        <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-2">Channel</p>
        <div className="flex flex-wrap gap-2">
          {channels.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChannelId(c.id)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                channelId === c.id
                  ? "bg-neutral-200 text-neutral-900 border-neutral-200"
                  : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-600 hover:text-neutral-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tone picker */}
      <div>
        <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-2">Tone</p>
        <div className="flex flex-wrap gap-2">
          {tones.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setToneId(t.id)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                toneId === t.id
                  ? "bg-neutral-200 text-neutral-900 border-neutral-200"
                  : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-600 hover:text-neutral-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-neutral-600 mt-1.5">
          {tones.find((t) => t.id === toneId)?.description}
        </p>
      </div>

      {/* Topic input */}
      <div>
        <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-2">Topic</p>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={3}
          placeholder="What's this post about? Be specific — the more concrete the seed, the sharper the draft."
          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 resize-none leading-relaxed"
        />
        <p className="text-[11px] text-neutral-600 mt-1">
          Auto-suggested topics from your activity data ship in the next release.
        </p>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="button"
        onClick={() => generate(false)}
        disabled={loading}
        className="text-sm px-5 py-2 bg-neutral-200 text-neutral-900 rounded-lg font-medium hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "Generating…" : "Generate 2 variants"}
      </button>

      {loading && (
        <p className="text-[11px] text-neutral-600 -mt-4">
          This takes 8–15 seconds — Claude is writing two distinct drafts.
        </p>
      )}

      {/* Variants */}
      {draft && !loading && (
        <div ref={draftRef} className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
              2 variants — pick one to edit
            </p>
            <button
              type="button"
              onClick={() => generate(true)}
              className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Regenerate both →
            </button>
          </div>

          <DraftVariantPanel
            draftId={draft.draftId}
            variantNum={1}
            text={draft.variant1}
            charLimit={selectedChannel.charLimit}
            onAction={onPostedOrDiscarded}
          />
          <DraftVariantPanel
            draftId={draft.draftId}
            variantNum={2}
            text={draft.variant2}
            charLimit={selectedChannel.charLimit}
            onAction={onPostedOrDiscarded}
          />
        </div>
      )}
    </div>
  );
}
