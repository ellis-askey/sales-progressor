"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import type { Channel } from "@/lib/command/content/channels";
import type { Tone } from "@/lib/command/content/tones";
import { DraftVariantPanel } from "@/components/command/content/DraftVariantPanel";

interface GeneratedDraft {
  draftId: string;
  variant1: string;
  variant2: string;
}

interface PendingTopic {
  id: string;
  text: string;
  source: string;
  priority: number;
}

interface Props {
  channels: Channel[];
  tones: Tone[];
  pendingTopics: PendingTopic[];
}

type TopicMode = "manual" | "queue";

export function DraftComposer({ channels, tones, pendingTopics }: Props) {
  const [channelId, setChannelId] = useState(channels[0].id);
  const [toneId, setToneId] = useState(tones[0].id);
  const [topic, setTopic] = useState("");
  const [topicMode, setTopicMode] = useState<TopicMode>("manual");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<GeneratedDraft | null>(null);
  const draftRef = useRef<HTMLDivElement>(null);

  const selectedChannel = channels.find((c) => c.id === channelId) ?? channels[0];

  const effectiveTopic =
    topicMode === "queue"
      ? (pendingTopics.find((t) => t.id === selectedTopicId)?.text ?? "")
      : topic;

  async function generate(regenerate = false) {
    if (!effectiveTopic.trim()) {
      setError(
        topicMode === "queue"
          ? "Select a topic from the queue first."
          : "Enter a topic before generating."
      );
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
          topic: effectiveTopic.trim(),
          topicId: topicMode === "queue" && selectedTopicId && !regenerate ? selectedTopicId : undefined,
          regenerateDraftId: regenerate && draft ? draft.draftId : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Generation failed");
      }

      const data = (await res.json()) as GeneratedDraft;
      setDraft(data);

      setTimeout(
        () => draftRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        100
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  function onPostedOrDiscarded() {
    setDraft(null);
    setTopic("");
    setSelectedTopicId(null);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Channel picker */}
      <div>
        <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-2">
          Channel
        </p>
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
        <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-2">
          Tone
        </p>
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

      {/* Topic — manual or queue */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">
            Topic
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setTopicMode("manual")}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                topicMode === "manual"
                  ? "bg-neutral-700 text-neutral-200"
                  : "text-neutral-600 hover:text-neutral-400"
              }`}
            >
              Type
            </button>
            <button
              type="button"
              onClick={() => setTopicMode("queue")}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                topicMode === "queue"
                  ? "bg-neutral-700 text-neutral-200"
                  : "text-neutral-600 hover:text-neutral-400"
              }`}
            >
              From queue {pendingTopics.length > 0 && `(${pendingTopics.length})`}
            </button>
          </div>
        </div>

        {topicMode === "manual" ? (
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            placeholder="What's this post about? Be specific — the more concrete the seed, the sharper the draft."
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 resize-none leading-relaxed"
          />
        ) : pendingTopics.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-4">
            <p className="text-xs text-neutral-500">
              No topics in queue yet.{" "}
              <Link
                href="/command/content/topics"
                className="text-neutral-400 underline underline-offset-2 hover:text-neutral-200"
              >
                Add one manually
              </Link>{" "}
              or wait for the overnight activity scan.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingTopics.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTopicId(t.id === selectedTopicId ? null : t.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                  selectedTopicId === t.id
                    ? "bg-neutral-700 border-neutral-600 text-neutral-100"
                    : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                }`}
              >
                <span className="leading-snug">{t.text}</span>
                {t.source === "activity_derived" && (
                  <span className="ml-2 text-[10px] text-neutral-600">from activity</span>
                )}
              </button>
            ))}
            <Link
              href="/command/content/topics"
              className="block text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors pt-1"
            >
              Manage queue →
            </Link>
          </div>
        )}
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
