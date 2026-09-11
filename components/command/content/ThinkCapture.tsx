"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { captureThoughtAction } from "@/app/actions/ellis-thoughts";

// Standalone capture for the bookmarkable /think page (docs/active/content-brand/
// SPEC.md). Minimal chrome so it works as a phone home-screen shortcut: type,
// save, keep going. Feeds "Things you think". Auth is enforced by the page.

export function ThinkCapture() {
  const [body, setBody] = useState("");
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [pending, startTransition] = useTransition();
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    areaRef.current?.focus();
  }, []);

  function save() {
    const t = body.trim();
    if (!t) return;
    const fd = new FormData();
    fd.set("body", t);
    fd.set("source", "global_capture");
    startTransition(async () => {
      const r = await captureThoughtAction(fd);
      if (r.ok) {
        setBody("");
        setCount((c) => c + 1);
        setFlash(true);
        setTimeout(() => setFlash(false), 1500);
        areaRef.current?.focus();
      }
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-5 py-10 text-neutral-100">
      <div className="w-full max-w-lg space-y-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold text-neutral-100">A quick thought</h1>
          <span className="text-[12px] text-neutral-600">{flash ? "Saved" : count > 0 ? `${count} saved` : ""}</span>
        </div>

        <textarea
          ref={areaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
          }}
          rows={7}
          placeholder="An opinion, a frustration, something you noticed. Doesn't need to be polished."
          className="w-full resize-y rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3.5 text-[16px] leading-relaxed text-neutral-100 placeholder:text-neutral-600 focus:border-blue-600/50 focus:outline-none"
        />

        <div className="flex items-center justify-between">
          <span className="text-[12px] text-neutral-600">⌘↵ to save</span>
          <button
            onClick={save}
            disabled={pending || !body.trim()}
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="pt-2 text-center">
          <Link href="/command/content/thoughts" className="text-[12px] text-neutral-600 transition-colors hover:text-neutral-400">
            See all your thoughts →
          </Link>
        </div>
      </div>
    </main>
  );
}
