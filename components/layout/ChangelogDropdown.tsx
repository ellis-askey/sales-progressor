"use client";

import { useState, useEffect, useRef } from "react";
import changelog from "@/lib/changelog.json";

const SEEN_KEY = "sp_changelog_seen";
const latestDate = changelog[0]?.date ?? "";

export function ChangelogDropdown() {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const seen = localStorage.getItem(SEEN_KEY);
    setHasUnread(!seen || seen < latestDate);
  }, []);

  useEffect(() => {
    if (open && hasUnread) {
      localStorage.setItem(SEEN_KEY, latestDate);
      setHasUnread(false);
    }
  }, [open, hasUnread]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.addEventListener("mousedown", onOutside);
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-7 h-7 flex items-center justify-center rounded-lg text-slate-900/40 hover:text-slate-900/70 hover:bg-white/40 transition-all"
        title="What's new"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {hasUnread && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 ring-1 ring-white/60" />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-9 w-72 rounded-2xl z-50 overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.94)",
            backdropFilter: "blur(24px) saturate(1.6)",
            WebkitBackdropFilter: "blur(24px) saturate(1.6)",
            border: "1px solid rgba(255,255,255,0.6)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)",
          }}
        >
          <div className="px-4 py-3 border-b border-slate-100/80">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-900/40">What's new</p>
          </div>

          <div className="px-4 py-3 space-y-4 max-h-80 overflow-y-auto">
            {changelog.map((entry) => (
              <div key={entry.version}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                    v{entry.version}
                  </span>
                  <span className="text-[11px] text-slate-900/40">
                    {new Date(entry.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {entry.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-slate-900/70">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
