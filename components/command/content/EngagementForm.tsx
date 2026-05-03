"use client";

import { useState } from "react";
import { logEngagementAction } from "@/app/actions/content-engagement";

interface MetricField {
  label: string;
  name: string;
}

interface Props {
  draftPostId: string;
  metricFields: MetricField[];
  defaults: {
    likes?: number | null;
    comments?: number | null;
    shares?: number | null;
    impressions?: number | null;
    clicks?: number | null;
    notes?: string | null;
  };
  isUpdate: boolean;
}

// Patterns: keyword near a number (with optional K/M suffix and commas)
const PARSE_RULES: { pattern: RegExp; field: keyof Omit<Props["defaults"], "notes"> }[] = [
  { pattern: /([0-9][0-9,.]*[KkMm]?)\s*(?:impressions?|views?|reach)/i, field: "impressions" },
  { pattern: /(?:impressions?|views?|reach)\s*[:\-]?\s*([0-9][0-9,.]*[KkMm]?)/i, field: "impressions" },
  { pattern: /([0-9][0-9,.]*[KkMm]?)\s*(?:likes?|reactions?|hearts?)/i, field: "likes" },
  { pattern: /(?:likes?|reactions?|hearts?)\s*[:\-]?\s*([0-9][0-9,.]*[KkMm]?)/i, field: "likes" },
  { pattern: /([0-9][0-9,.]*[KkMm]?)\s*(?:comments?|replies)/i, field: "comments" },
  { pattern: /(?:comments?|replies)\s*[:\-]?\s*([0-9][0-9,.]*[KkMm]?)/i, field: "comments" },
  { pattern: /([0-9][0-9,.]*[KkMm]?)\s*(?:shares?|reposts?|retweets?|saves?)/i, field: "shares" },
  { pattern: /(?:shares?|reposts?|retweets?|saves?)\s*[:\-]?\s*([0-9][0-9,.]*[KkMm]?)/i, field: "shares" },
  { pattern: /([0-9][0-9,.]*[KkMm]?)\s*(?:clicks?|link clicks?)/i, field: "clicks" },
  { pattern: /(?:clicks?|link clicks?)\s*[:\-]?\s*([0-9][0-9,.]*[KkMm]?)/i, field: "clicks" },
];

function parseNumber(raw: string): number {
  const s = raw.replace(/,/g, "").toUpperCase();
  if (s.endsWith("M")) return Math.round(parseFloat(s) * 1_000_000);
  if (s.endsWith("K")) return Math.round(parseFloat(s) * 1_000);
  return parseInt(s, 10) || 0;
}

function parseRawAnalytics(raw: string): Partial<Record<string, number>> {
  const result: Partial<Record<string, number>> = {};
  for (const rule of PARSE_RULES) {
    const match = raw.match(rule.pattern);
    if (match?.[1] && !(rule.field in result)) {
      result[rule.field] = parseNumber(match[1]);
    }
  }
  return result;
}

export function EngagementForm({ draftPostId, metricFields, defaults, isUpdate }: Props) {
  const [values, setValues] = useState({
    likes: defaults.likes ?? 0,
    comments: defaults.comments ?? 0,
    shares: defaults.shares ?? 0,
    impressions: defaults.impressions ?? "",
    clicks: defaults.clicks ?? "",
  });
  const [notes, setNotes] = useState(defaults.notes ?? "");
  const [rawPaste, setRawPaste] = useState("");

  function handlePaste(text: string) {
    setRawPaste(text);
    if (!text.trim()) return;
    const parsed = parseRawAnalytics(text);
    setValues((prev) => ({
      likes: parsed.likes ?? prev.likes,
      comments: parsed.comments ?? prev.comments,
      shares: parsed.shares ?? prev.shares,
      impressions: parsed.impressions ?? prev.impressions,
      clicks: parsed.clicks ?? prev.clicks,
    }));
  }

  function fieldValue(name: string): number | string {
    if (name === "likes") return values.likes;
    if (name === "comments") return values.comments;
    if (name === "shares") return values.shares;
    if (name === "impressions") return values.impressions;
    if (name === "clicks") return values.clicks;
    return 0;
  }

  function handleFieldChange(name: string, val: string) {
    setValues((prev) => ({ ...prev, [name]: val === "" ? "" : parseInt(val, 10) || 0 }));
  }

  return (
    <form action={logEngagementAction} className="space-y-5">
      <input type="hidden" name="draftPostId" value={draftPostId} />

      {/* Quick-paste parser */}
      <div>
        <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-2">
          Quick paste
        </p>
        <textarea
          value={rawPaste}
          onChange={(e) => handlePaste(e.target.value)}
          rows={3}
          placeholder={`Paste raw analytics text from LinkedIn / Twitter / Instagram / TikTok — numbers auto-fill below.\n\ne.g. "1,234 impressions · 45 reactions · 12 comments"`}
          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
        />
        {rawPaste && (
          <p className="text-[11px] text-neutral-600 mt-1">
            Parsed — review fields below and adjust if needed.
          </p>
        )}
      </div>

      {/* Metric fields */}
      <div>
        <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-3">
          Metrics
        </p>
        <div className="grid grid-cols-2 gap-3">
          {metricFields.map((field) => (
            <div key={field.name}>
              <label className="block text-xs text-neutral-500 mb-1">{field.label}</label>
              <input
                type="number"
                name={field.name}
                min="0"
                value={fieldValue(field.name)}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                placeholder="0"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600 tabular-nums"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">Notes (optional)</label>
        <textarea
          name="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. boosted post, reshared by a partner, unusual topic…"
          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
        />
      </div>

      <button
        type="submit"
        className="text-sm px-5 py-2 bg-neutral-200 text-neutral-900 rounded-lg font-medium hover:bg-white transition-colors"
      >
        {isUpdate ? "Update engagement" : "Save engagement"}
      </button>
    </form>
  );
}
