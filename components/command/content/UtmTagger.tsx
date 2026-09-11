"use client";

import { useState } from "react";
import { withUtm } from "@/lib/command/content/utm";

// Link tagger (docs/active/content-brand/SPEC.md, Phase 6.2). Turns a link into
// an attributable one so future analytics can tie visitors back to a post.

export function UtmTagger() {
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("linkedin");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);

  const tagged = url.trim() ? withUtm(url.trim(), { source, medium: "social", campaign: campaign.trim() || undefined }) : "";

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_140px_160px]">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://thesalesprogressor.co.uk/…"
          className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-100 placeholder:text-neutral-600 focus:border-blue-600/50 focus:outline-none"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          title="Source"
          className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-2 text-[12px] text-neutral-200 focus:border-blue-600/50 focus:outline-none"
        >
          <option value="linkedin">LinkedIn</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
        </select>
        <input
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
          placeholder="Campaign (optional)"
          className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[12px] text-neutral-200 placeholder:text-neutral-600 focus:border-blue-600/50 focus:outline-none"
        />
      </div>

      {tagged && (
        <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-300">{tagged}</span>
          <button
            onClick={() => navigator.clipboard.writeText(tagged).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
            className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
