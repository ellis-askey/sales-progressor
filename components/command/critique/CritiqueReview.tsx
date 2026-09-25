"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, ExternalLink, Search, X } from "lucide-react";
import { setCritiqueResolvedAction } from "@/app/actions/critique";

type Note = {
  id: string;
  seq: number;
  createdAt: string;
  body: string;
  pageUrl: string | null;
  viewportSize: string | null;
  userEmail: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  screenshotUrl: string | null;
};

// Command Centre review of founder Critique notes. Open / Done filter, resolve
// toggle per note, screenshot opens full-size in a new tab. Command visual
// system: solid dark surfaces, hairline borders, blue accent, no glass.
export function CritiqueReview({ notes }: { notes: Note[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"open" | "done">("open");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const openCount = notes.filter((n) => !n.resolvedAt).length;
  const doneCount = notes.length - openCount;

  // Search matches the note text, the page/route it came from, or the note's
  // reference number (so "14", "#14", "chains" or "portal access" all work).
  const q = query.trim().toLowerCase();
  const route = (n: Note) => (n.pageUrl ? n.pageUrl.replace(/^https?:\/\/[^/]+/, "").toLowerCase() : "");
  const matchesQuery = (n: Note) =>
    !q ||
    n.body.toLowerCase().includes(q) ||
    route(n).includes(q) ||
    String(n.seq) === q.replace(/^#/, "") ||
    `#${n.seq}`.includes(q);

  const shown = notes
    .filter((n) => (filter === "open" ? !n.resolvedAt : !!n.resolvedAt))
    .filter(matchesQuery);

  function toggle(note: Note) {
    setBusyId(note.id);
    const fd = new FormData();
    fd.set("id", note.id);
    fd.set("resolved", note.resolvedAt ? "false" : "true");
    startTransition(async () => {
      await setCritiqueResolvedAction(fd);
      setBusyId(null);
      router.refresh();
    });
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4">
      {/* Open / Done filter + search by number, phrase, or page */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-0.5 rounded-md bg-[#1a1a1a] p-0.5">
          {(["open", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 text-[12px] font-semibold transition-colors ${
                filter === f ? "bg-[#2563eb] text-white" : "text-[#737373] hover:text-[#d4d4d4]"
              }`}
            >
              {f === "open" ? `Open · ${openCount}` : `Done · ${doneCount}`}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#525252]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes — number, phrase or page"
            aria-label="Search critique notes"
            className="w-full rounded-md border border-[#262626] bg-[#141414] py-1.5 pl-8 pr-8 text-[12px] text-[#e5e5e5] placeholder:text-[#525252] focus:border-[#2563eb] focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#525252] hover:text-[#d4d4d4]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {q && (
          <span className="text-[11px] text-[#525252]">
            {shown.length} {shown.length === 1 ? "match" : "matches"}
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-[#262626] bg-[#141414] px-4 py-8 text-center text-[13px] text-[#525252]">
          {q
            ? "No notes match your search."
            : filter === "open"
              ? "No open critique notes."
              : "Nothing marked done yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((n) => (
            <li key={n.id} className="rounded-xl border border-[#262626] bg-[#141414] p-4">
              <div className="flex gap-4">
                {/* Screenshot thumbnail */}
                {n.screenshotUrl ? (
                  <a
                    href={n.screenshotUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block h-24 w-40 flex-shrink-0 overflow-hidden rounded-lg border border-[#2e2e2e] bg-[#0d0d0d]"
                    title="Open full size"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={n.screenshotUrl} alt="Screenshot" className="h-full w-full object-cover object-top" />
                    <span className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <ExternalLink size={12} />
                    </span>
                  </a>
                ) : (
                  <div className="flex h-24 w-40 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-[#2e2e2e] text-[11px] text-[#404040]">
                    No screenshot
                  </div>
                )}

                {/* Note + meta */}
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#e5e5e5]">{n.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#525252]">
                    <span className="rounded bg-[#1f2937] px-1.5 py-0.5 font-semibold text-[#93c5fd]">#{n.seq}</span>
                    <span>{fmt(n.createdAt)}</span>
                    {n.pageUrl && (
                      <>
                        <span>·</span>
                        <a href={n.pageUrl} target="_blank" rel="noreferrer" className="max-w-[280px] truncate text-[#6b7fb0] hover:text-[#93c5fd]" title={n.pageUrl}>
                          {n.pageUrl.replace(/^https?:\/\/[^/]+/, "")}
                        </a>
                      </>
                    )}
                    {n.viewportSize && (<><span>·</span><span>{n.viewportSize}</span></>)}
                    {n.resolvedAt && (<><span>·</span><span className="text-[#3f6f4f]">done {fmt(n.resolvedAt)}</span></>)}
                  </div>
                </div>

                {/* Resolve toggle */}
                <div className="flex-shrink-0">
                  <button
                    onClick={() => toggle(n)}
                    disabled={pending && busyId === n.id}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-50 ${
                      n.resolvedAt
                        ? "border-[#2e2e2e] text-[#737373] hover:text-[#d4d4d4]"
                        : "border-[#16532c] bg-[#12291a] text-[#4ade80] hover:bg-[#173521]"
                    }`}
                  >
                    {n.resolvedAt ? (<><RotateCcw size={13} /> Reopen</>) : (<><Check size={13} /> Mark done</>)}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
