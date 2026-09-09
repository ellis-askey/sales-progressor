"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Lightbulb, Check } from "lucide-react";
import { captureThoughtAction } from "@/app/actions/ellis-thoughts";

// Global thought capture (docs/active/content-brand/SPEC.md, Phase 1.1). Lives
// in the Command Centre sidebar so a thought can be saved from anywhere without
// leaving the current page. Source is tagged "global_capture" so we can tell
// spur-of-the-moment captures from ones written on the Thoughts page.

export function ThoughtQuickCapture() {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) areaRef.current?.focus();
  }, [open]);

  function save() {
    const trimmed = body.trim();
    if (!trimmed) return;
    const fd = new FormData();
    fd.set("body", trimmed);
    fd.set("source", "global_capture");
    startTransition(async () => {
      const res = await captureThoughtAction(fd);
      if (res.ok) {
        setBody("");
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
        setOpen(false);
      }
    });
  }

  return (
    <div className="px-2">
      {open ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-2 space-y-2">
          <textarea
            ref={areaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
              if (e.key === "Escape") setOpen(false);
            }}
            rows={3}
            placeholder="A quick thought…"
            className="w-full resize-none rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-[12px] text-neutral-100 placeholder:text-neutral-600 focus:border-blue-600/50 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setOpen(false)}
              className="text-[11px] text-neutral-500 transition-colors hover:text-neutral-300"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={pending || !body.trim()}
              className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-2 text-[12px] font-medium text-neutral-400 transition-colors hover:border-neutral-700 hover:text-neutral-200"
        >
          {saved ? <Check size={14} className="text-emerald-400" /> : <Lightbulb size={14} />}
          {saved ? "Saved" : "Capture a thought"}
        </button>
      )}
    </div>
  );
}
