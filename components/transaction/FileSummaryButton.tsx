"use client";

// The property-hero File Summary trigger: a small speech-bubble icon that opens
// a compact glass popover with an AI-written "where this sale stands" summary.
//
// Reads the cached summary on first open (instant on reopen — state lives here,
// not in the panel, so it survives close/open). When no summary exists yet it
// generates one once; after that only the explicit Refresh regenerates, so we
// don't spend on the model for every glance. A failed refresh keeps the last
// good summary on screen. Facts-only generation + access gating live in
// app/actions/file-summary.ts and lib/services/file-summary.ts.

import { useRef, useState } from "react";
import { ChatText, ArrowClockwise, Copy, Check } from "@phosphor-icons/react";
import { Popover } from "@/components/ui/Popover";
import { getFileSummaryAction, refreshFileSummaryAction } from "@/app/actions/file-summary";
import "./file-summary.css";

type Status = "idle" | "loading" | "generating" | "ready" | "error";

function timeAgo(d: Date): string {
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

// Parse the summary body into its opening line and the labelled "Last two weeks"
// / "Next" sections. The model returns blank-line-separated blocks; the two named
// blocks lead with a label line we render as a small heading, their remaining
// lines as individual rows (so the dated log keeps one fact per line). Anything
// that isn't one of those labelled blocks renders as a plain lead line, so an
// older prose summary (pre-v2) still shows readably until it regenerates.
type SummaryBlock =
  | { kind: "lead"; text: string }
  | { kind: "section"; label: string; lines: string[] };

function parseBody(body: string): SummaryBlock[] {
  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out = blocks.map((block): SummaryBlock => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0 && /^(last two weeks|next)$/i.test(lines[0])) {
      return { kind: "section", label: lines[0], lines: lines.slice(1) };
    }
    return { kind: "lead", text: lines.join(" ") };
  });
  return out.length > 0 ? out : [{ kind: "lead", text: body.trim() }];
}

export function FileSummaryButton({ transactionId }: { transactionId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [body, setBody] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const loadedRef = useRef(false);

  function apply(s: { body: string; generatedAt: Date; stale: boolean }) {
    setBody(s.body);
    setGeneratedAt(new Date(s.generatedAt));
    setStale(s.stale);
  }

  // Runs once, on the first open. Reads the cache; if there's nothing cached
  // yet, generates the first summary.
  async function ensureLoaded() {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setStatus("loading");
    setError(null);
    const res = await getFileSummaryAction(transactionId);
    if (!res.ok) {
      loadedRef.current = false;
      setStatus("error");
      setError(res.error);
      return;
    }
    if (res.summary) {
      apply(res.summary);
      setStatus("ready");
      return;
    }
    // None cached — generate the first one.
    setStatus("generating");
    const gen = await refreshFileSummaryAction(transactionId);
    if (!gen.ok || !gen.summary) {
      loadedRef.current = false;
      setStatus("error");
      setError(gen.ok ? "There's not enough on this file to summarise yet." : gen.error);
      return;
    }
    apply(gen.summary);
    setStatus("ready");
  }

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    const gen = await refreshFileSummaryAction(transactionId);
    setRefreshing(false);
    if (!gen.ok || !gen.summary) {
      // Keep the last good summary on screen; surface the failure quietly.
      setError(gen.ok ? "There's not enough on this file to summarise yet." : gen.error);
      return;
    }
    apply(gen.summary);
  }

  function copy() {
    if (!body) return;
    navigator.clipboard?.writeText(body).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {},
    );
  }

  return (
    <Popover
      preset="popover"
      bare
      anim="scale"
      placement="bottom-end"
      width={360}
      trigger={
        <button
          type="button"
          className="fs-sum-btn"
          title="Where this sale stands"
          aria-label="Where this sale stands"
          onClick={ensureLoaded}
        >
          <ChatText size={17} weight="regular" />
        </button>
      }
    >
      <div className="fs-panel">
        {status === "ready" && body ? (
          <>
            <div className="fs-head">
              <p className="fs-title">Where this sale stands</p>
              {generatedAt && <span className="fs-stamp">Updated {timeAgo(generatedAt)}</span>}
            </div>
            <div className="fs-body">
              {parseBody(body).map((b, i) =>
                b.kind === "lead" ? (
                  <p key={i} className="fs-lead">{b.text}</p>
                ) : (
                  <div key={i} className="fs-block">
                    <p className="fs-label">{b.label}</p>
                    {b.lines.map((l, j) => (
                      <p key={j} className="fs-line">{l}</p>
                    ))}
                  </div>
                ),
              )}
            </div>
            {stale && (
              <div className="fs-stale">
                <ArrowClockwise size={12} weight="bold" />
                <span>This file has moved on since. Refresh to update.</span>
              </div>
            )}
            {error && (
              <div className="fs-stale" role="status">
                <span>{error}</span>
              </div>
            )}
            <div className="fs-foot">
              <button type="button" className="fs-act" onClick={refresh} disabled={refreshing}>
                {refreshing ? <span className="fs-spin" aria-hidden /> : <ArrowClockwise size={14} weight="bold" />}
                <span>{refreshing ? "Refreshing" : "Refresh"}</span>
              </button>
              <button type="button" className="fs-act" onClick={copy} data-done={copied ? "" : undefined}>
                {copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="regular" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </>
        ) : status === "error" ? (
          <div className="fs-note">
            <span>{error ?? "Couldn't load the summary."}</span>
          </div>
        ) : (
          <div className="fs-note">
            <span className="fs-spin" aria-hidden />
            <span>{status === "generating" ? "Reading the file…" : "Loading…"}</span>
          </div>
        )}
      </div>
    </Popover>
  );
}
