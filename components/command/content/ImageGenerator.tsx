"use client";

import { useState } from "react";

type Tab = "text-card" | "chart" | "ai";
type Variant = "dark" | "light";
type LogoStyle = "icon-text" | "text-only" | "icon-only";
type Metric = "milestones" | "pipeline";

function buildTextCardUrl(text: string, variant: Variant, logo: LogoStyle): string {
  const params = new URLSearchParams({ text, variant, logo });
  return `/api/command/content/images/text-card?${params}`;
}

function buildChartUrl(metric: Metric, variant: Variant): string {
  const params = new URLSearchParams({ metric, variant });
  return `/api/command/content/images/chart?${params}`;
}

async function downloadImage(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ImageGenerator() {
  const [tab, setTab] = useState<Tab>("text-card");

  // Text card state
  const [cardText, setCardText] = useState("The silence ends at offer accepted.");
  const [cardVariant, setCardVariant] = useState<Variant>("dark");
  const [cardLogo, setCardLogo] = useState<LogoStyle>("icon-text");

  // Chart state
  const [chartMetric, setChartMetric] = useState<Metric>("milestones");
  const [chartVariant, setChartVariant] = useState<Variant>("dark");

  // AI state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiVariant, setAiVariant] = useState<Variant>("dark");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiUrl, setAiUrl] = useState<string | null>(null);

  const textCardUrl = buildTextCardUrl(cardText, cardVariant, cardLogo);
  const chartUrl = buildChartUrl(chartMetric, chartVariant);

  async function generateAiImage() {
    if (!aiPrompt.trim()) {
      setAiError("Enter a prompt first.");
      return;
    }
    setAiError(null);
    setAiLoading(true);
    setAiUrl(null);
    try {
      const res = await fetch("/api/command/content/images/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim(), variant: aiVariant }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setAiUrl(data.url ?? null);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setAiLoading(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "text-card", label: "Text card" },
    { id: "chart", label: "Chart" },
    { id: "ai", label: "AI image" },
  ];

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-neutral-800 pb-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`text-xs px-4 py-2 font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-neutral-200 text-neutral-200"
                : "border-transparent text-neutral-600 hover:text-neutral-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Text card tab */}
      {tab === "text-card" && (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-2">
              Quote / headline
            </p>
            <textarea
              value={cardText}
              onChange={(e) => setCardText(e.target.value)}
              rows={3}
              placeholder="The silence ends at offer accepted."
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
            />
            <p className="text-[11px] text-neutral-700 mt-1">{cardText.length} / 180 chars</p>
          </div>

          <div className="flex gap-6">
            <div>
              <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-2">
                Style
              </p>
              <div className="flex gap-2">
                {(["dark", "light"] as Variant[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCardVariant(v)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                      cardVariant === v
                        ? "bg-neutral-200 text-neutral-900 border-neutral-200"
                        : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-600"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-2">
                Logo
              </p>
              <div className="flex gap-2">
                {(
                  [
                    { id: "icon-text", label: "Icon + text" },
                    { id: "text-only", label: "Text only" },
                    { id: "icon-only", label: "Icon only" },
                  ] as { id: LogoStyle; label: string }[]
                ).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setCardLogo(l.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      cardLogo === l.id
                        ? "bg-neutral-200 text-neutral-900 border-neutral-200"
                        : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-600"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <PreviewCard
            src={textCardUrl}
            filename="sales-progressor-card.png"
            copyUrl={textCardUrl}
            fullUrl={textCardUrl}
          />
        </div>
      )}

      {/* Chart tab */}
      {tab === "chart" && (
        <div className="space-y-4">
          <div className="flex gap-6">
            <div>
              <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-2">
                Data
              </p>
              <div className="flex gap-2">
                {(
                  [
                    { id: "milestones", label: "Milestones / 4 wks" },
                    { id: "pipeline", label: "Pipeline" },
                  ] as { id: Metric; label: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setChartMetric(m.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      chartMetric === m.id
                        ? "bg-neutral-200 text-neutral-900 border-neutral-200"
                        : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-600"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-2">
                Style
              </p>
              <div className="flex gap-2">
                {(["dark", "light"] as Variant[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setChartVariant(v)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                      chartVariant === v
                        ? "bg-neutral-200 text-neutral-900 border-neutral-200"
                        : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-600"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <PreviewCard
            src={chartUrl}
            filename="sales-progressor-chart.png"
            copyUrl={chartUrl}
            fullUrl={chartUrl}
          />
        </div>
      )}

      {/* AI image tab */}
      {tab === "ai" && (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-2">
              Describe the image
            </p>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. modern kitchen in a recently sold property, estate agent signboard outside a Victorian terraced house"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
            />
            <p className="text-[11px] text-neutral-700 mt-1">
              No people, faces, or real landmarks — these are automatically blocked.
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-2">
              Style
            </p>
            <div className="flex gap-2">
              {(["dark", "light"] as Variant[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAiVariant(v)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                    aiVariant === v
                      ? "bg-neutral-200 text-neutral-900 border-neutral-200"
                      : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-600"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {aiError && <p className="text-xs text-red-400">{aiError}</p>}

          <button
            type="button"
            onClick={generateAiImage}
            disabled={aiLoading}
            className="text-sm px-5 py-2 bg-neutral-200 text-neutral-900 rounded-lg font-medium hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {aiLoading ? "Generating… (~15s)" : "Generate image"}
          </button>

          {aiUrl && (
            <PreviewCard
              src={aiUrl}
              filename="sales-progressor-ai.webp"
              copyUrl={aiUrl}
              fullUrl={aiUrl}
              external
            />
          )}
        </div>
      )}
    </div>
  );
}

function PreviewCard({
  src,
  filename,
  copyUrl,
  fullUrl,
  external,
}: {
  src: string;
  filename: string;
  copyUrl: string;
  fullUrl: string;
  external?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = external ? copyUrl : window.location.origin + copyUrl;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function download() {
    await downloadImage(src, filename);
  }

  return (
    <div className="space-y-3">
      {/* Preview */}
      <div className="rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Generated image preview"
          className="w-full"
          style={{ aspectRatio: "1200/628" }}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copy}
          className="text-xs px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
        >
          {copied ? "Copied!" : "Copy URL"}
        </button>
        <button
          type="button"
          onClick={download}
          className="text-xs px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
        >
          Download
        </button>
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
        >
          Open full size →
        </a>
      </div>
    </div>
  );
}
