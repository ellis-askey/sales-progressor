"use client";

import { useState } from "react";
import { PURPOSES, ANGLE_TYPES, FORMATS } from "@/lib/command/content/create-taxonomy";
import { DraftVariantPanel } from "@/components/command/content/DraftVariantPanel";
import { ClaimBadge } from "@/components/command/content/ClaimBadge";

// Guided creation flow (docs/active/content-brand/SPEC.md, Phase 1.4). Source ->
// Purpose -> Angle -> Format, then generate. The post is only written once the
// point is clear. Generation reuses the composer endpoint + DraftVariantPanel.

type PresetAngle = { angle: string; point: string };

type Props = {
  initialSource: string;
  presetAngles?: PresetAngle[];
  inboxItemId?: string;
  claimClass?: string;
  evidenceSummary?: string | null;
};

type Result = { draftId: string; variant1: string; variant2: string; charLimit: number };

export function CreateFlow({ initialSource, presetAngles = [], inboxItemId, claimClass, evidenceSummary }: Props) {
  const [source, setSource] = useState(initialSource);
  const [purposeId, setPurposeId] = useState<string>("");
  const [angleLabel, setAngleLabel] = useState<string>("");
  const [point, setPoint] = useState<string>("");
  const [formatId, setFormatId] = useState<string>("linkedin_text");
  const [angleMode, setAngleMode] = useState<"preset" | "custom">(presetAngles.length ? "preset" : "custom");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const ready = source.trim() && purposeId && point.trim() && formatId;

  async function generate() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/command/content/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: source.trim(), purposeId, angleLabel, point: point.trim(), formatId, inboxItemId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setResult(data as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setResult(null);
    setError(null);
  }

  if (result) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-neutral-400">Two drafts to the point you chose. Edit, copy, or mark as posted.</p>
          <div className="flex items-center gap-3">
            <button onClick={generate} disabled={busy} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-[12px] text-neutral-300 transition-colors hover:text-neutral-100 disabled:opacity-40">
              {busy ? "Regenerating…" : "Regenerate"}
            </button>
            <button onClick={startOver} className="text-[12px] text-neutral-500 transition-colors hover:text-neutral-300">Start over</button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
          <div className="space-y-4">
            <DraftVariantPanel draftId={result.draftId} variantNum={1} text={result.variant1} charLimit={result.charLimit} onAction={() => {}} />
            <DraftVariantPanel draftId={result.draftId} variantNum={2} text={result.variant2} charLimit={result.charLimit} onAction={() => {}} />
          </div>
          <ClaimInspector claimClass={claimClass} evidenceSummary={evidenceSummary} point={point} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Stepper source={!!source.trim()} purpose={!!purposeId} point={!!point.trim()} format={!!formatId} />

      <Step n={1} title="What's this about?" done={!!source.trim()}>
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          rows={3}
          placeholder="The real thing you're talking about. From the inbox, a saved thought, or type it here."
          className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-[13px] text-neutral-100 placeholder:text-neutral-600 focus:border-blue-600/50 focus:outline-none"
        />
      </Step>

      <Step n={2} title="Why are we posting this?" done={!!purposeId}>
        <div className="flex flex-wrap gap-1.5">
          {PURPOSES.map((p) => (
            <Chip key={p.id} on={purposeId === p.id} onClick={() => setPurposeId(p.id)} title={p.hint}>{p.label}</Chip>
          ))}
        </div>
      </Step>

      <Step n={3} title="What's the point you're making?" done={!!point.trim()}>
        {presetAngles.length > 0 && (
          <div className="mb-3 flex items-center gap-3 text-[11px]">
            <button onClick={() => setAngleMode("preset")} className={angleMode === "preset" ? "font-medium text-blue-300" : "text-neutral-500 hover:text-neutral-300"}>Suggested angles</button>
            <span className="text-neutral-700">·</span>
            <button onClick={() => setAngleMode("custom")} className={angleMode === "custom" ? "font-medium text-blue-300" : "text-neutral-500 hover:text-neutral-300"}>Write my own</button>
          </div>
        )}

        {angleMode === "preset" && presetAngles.length > 0 ? (
          <div className="space-y-2">
            {presetAngles.map((a, i) => {
              const on = angleLabel === a.angle && point === a.point;
              return (
                <button
                  key={i}
                  onClick={() => { setAngleLabel(a.angle); setPoint(a.point); }}
                  className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${on ? "border-blue-600/50 bg-blue-950/20" : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"}`}
                >
                  <span className="mt-0.5 rounded border border-neutral-700 bg-neutral-800/60 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">{a.angle}</span>
                  <span className="flex-1 text-[12.5px] leading-relaxed text-neutral-200">{a.point}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {ANGLE_TYPES.map((a) => (
                <Chip key={a.id} on={angleLabel === a.label} onClick={() => setAngleLabel(a.label)} title={a.hint}>{a.label}</Chip>
              ))}
            </div>
            <textarea
              value={point}
              onChange={(e) => setPoint(e.target.value)}
              rows={3}
              placeholder="In a sentence or two: the actual argument. This is what the post has to land."
              className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-[13px] text-neutral-100 placeholder:text-neutral-600 focus:border-blue-600/50 focus:outline-none"
            />
          </div>
        )}
      </Step>

      <Step n={4} title="Best format" done={!!formatId}>
        <div className="grid gap-2 sm:grid-cols-2">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormatId(f.id)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${formatId === f.id ? "border-blue-600/50 bg-blue-950/20" : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"}`}
            >
              <span className="text-[13px] font-medium text-neutral-100">{f.label}</span>
              <span className="mt-0.5 block text-[11px] text-neutral-500">{f.note}</span>
            </button>
          ))}
        </div>
      </Step>

      {error && <p className="text-[12px] text-red-400">{error}</p>}

      <div className="flex items-center gap-3 border-t border-neutral-800 pt-4">
        <button
          onClick={generate}
          disabled={!ready || busy}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Writing…" : "Generate the post"}
        </button>
        {!ready && <span className="text-[11px] text-neutral-600">Set the source, purpose, point and format first.</span>}
      </div>
    </div>
  );
}

function ClaimInspector({ claimClass, evidenceSummary, point }: { claimClass?: string; evidenceSummary?: string | null; point: string }) {
  const cls = claimClass ?? "ellis_opinion";
  return (
    <aside className="h-fit rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Claim check</p>
      <div className="mt-2 flex items-center gap-2">
        <ClaimBadge id={cls} />
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-neutral-400">{point}</p>
      {evidenceSummary && (
        <div className="mt-3 border-t border-neutral-800 pt-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600">Evidence</p>
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{evidenceSummary}</p>
        </div>
      )}
      {(cls === "unverified" || cls === "inference") && (
        <p className="mt-3 text-[11px] leading-relaxed text-amber-400/90">
          Not established as fact. Posts with unresolved unverified claims won&rsquo;t be eligible for automatic publishing.
        </p>
      )}
    </aside>
  );
}

function Stepper({ source, purpose, point, format }: { source: boolean; purpose: boolean; point: boolean; format: boolean }) {
  const steps = [
    { label: "Source", done: source },
    { label: "Purpose", done: purpose },
    { label: "Angle", done: point },
    { label: "Format", done: format },
    { label: "Post", done: false },
  ];
  return (
    <div className="flex items-center gap-2 text-[11px]">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${s.done ? "bg-blue-600 text-white" : "border border-neutral-700 text-neutral-500"}`}>
            {s.done ? "✓" : i + 1}
          </span>
          <span className={s.done ? "text-neutral-300" : "text-neutral-600"}>{s.label}</span>
          {i < steps.length - 1 && <span className="text-neutral-800">→</span>}
        </div>
      ))}
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${done ? "bg-blue-600 text-white" : "border border-neutral-700 text-neutral-500"}`}>{done ? "✓" : n}</span>
        <h3 className="text-[13px] font-semibold text-neutral-200">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Chip({ on, onClick, title, children }: { on: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors ${on ? "border-blue-600/50 bg-blue-600/20 text-blue-300" : "border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"}`}
    >
      {children}
    </button>
  );
}
