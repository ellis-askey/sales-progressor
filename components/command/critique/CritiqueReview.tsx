"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, ExternalLink } from "lucide-react";
import { setCritiqueResolvedAction } from "@/app/actions/critique";

type Note = {
  id: string;
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
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const openCount = notes.filter((n) => !n.resolvedAt).length;
  const doneCount = notes.length - openCount;
  const shown = notes.filter((n) => (filter === "open" ? !n.resolvedAt : !!n.resolvedAt));

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
      {/* Open / Done filter */}
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

      {shown.length === 0 ? (
        <p className="rounded-lg border border-[#262626] bg-[#141414] px-4 py-8 text-center text-[13px] text-[#525252]">
          {filter === "open" ? "No open critique notes." : "Nothing marked done yet."}
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
