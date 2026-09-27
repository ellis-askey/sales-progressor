"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const CHANNELS = ["email", "sms", "linkedin", "twitter", "in_app", "other"] as const;
const STATUSES = [
  "draft", "scheduled", "queued", "sent", "delivered",
  "opened", "clicked", "bounced", "failed", "cancelled",
] as const;

export function OutboundFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const channels = searchParams.get("ch")?.split(",").filter(Boolean) ?? [];
  const statuses = searchParams.get("st")?.split(",").filter(Boolean) ?? [];
  const ai = searchParams.get("ai") ?? "all";
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";

  const [recVal, setRecVal] = useState(searchParams.get("rec") ?? "");
  const [qVal, setQVal] = useState(searchParams.get("q") ?? "");
  // Filters are collapsed behind a single button so the page isn't a wall of
  // pills; the active-count badge shows how many are on without opening it.
  const [open, setOpen] = useState(false);

  function resetFilters() {
    const p = new URLSearchParams(searchParams.toString());
    ["ch", "st", "ai", "from", "to", "rec", "q", "cursor", "pending"].forEach((k) => p.delete(k));
    router.push(`${pathname}?${p.toString()}`);
  }

  useEffect(() => {
    setRecVal(searchParams.get("rec") ?? "");
    setQVal(searchParams.get("q") ?? "");
  }, [searchParams]);

  function push(updates: Record<string, string>) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) p.set(k, v); else p.delete(k);
    }
    p.delete("cursor");
    p.delete("pending");
    router.push(`${pathname}?${p.toString()}`);
  }

  function toggleList(key: string, current: string[], value: string) {
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    push({ [key]: next.join(",") });
  }

  function commitText(key: string, value: string) {
    push({ [key]: value });
  }

  const activeCount = [
    channels.length > 0,
    statuses.length > 0,
    ai !== "all",
    !!dateFrom,
    !!dateTo,
    !!(searchParams.get("rec")),
    !!(searchParams.get("q")),
    searchParams.get("pending") === "1",
  ].filter(Boolean).length;

  return (
    <div className="px-1 pb-2">
      {/* Toggle bar — one button instead of a wall of pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M3 5h18l-7 8v6l-4-2v-4z" strokeLinejoin="round" /></svg>
          Filters
          {activeCount > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-600 text-white tabular-nums">{activeCount}</span>
          )}
          <span className={`text-[9px] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>▾</span>
        </button>
        {activeCount > 0 && (
          <button
            onClick={resetFilters}
            className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors underline underline-offset-2"
          >
            Reset
          </button>
        )}
      </div>

      {open && (
      <div className="mt-3 space-y-3 bg-neutral-900/40 border border-neutral-800 rounded-xl p-3">
      <div className="flex items-start gap-6 flex-wrap">
        {/* Channel */}
        <div>
          <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">Channel</p>
          <div className="flex items-center gap-1 flex-wrap">
            {CHANNELS.map((ch) => (
              <button
                key={ch}
                onClick={() => toggleList("ch", channels, ch)}
                className={`text-[11px] px-2 py-0.5 rounded font-mono transition-colors ${
                  channels.includes(ch)
                    ? "bg-neutral-600 text-white"
                    : "bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-300"
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">Status</p>
          <div className="flex items-center gap-1 flex-wrap">
            {STATUSES.map((st) => (
              <button
                key={st}
                onClick={() => toggleList("st", statuses, st)}
                className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                  statuses.includes(st)
                    ? "bg-neutral-600 text-white"
                    : "bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-300"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* AI tri-state */}
        <div>
          <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">AI</p>
          <div className="flex items-center gap-1">
            {(["all", "yes", "no"] as const).map((val) => (
              <button
                key={val}
                onClick={() => push({ ai: val === "all" ? "" : val })}
                className={`text-[11px] px-2.5 py-0.5 rounded transition-colors ${
                  ai === val
                    ? "bg-purple-900 text-purple-300 border border-purple-800"
                    : "bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-300"
                }`}
              >
                {val === "all" ? "All" : val === "yes" ? "AI only" : "No AI"}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div>
          <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">Date</p>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => push({ from: e.target.value })}
              className="text-[11px] bg-neutral-800 border border-neutral-700 rounded px-2 py-0.5 text-neutral-300 focus:outline-none focus:border-neutral-500"
            />
            <span className="text-neutral-600 text-xs">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => push({ to: e.target.value })}
              className="text-[11px] bg-neutral-800 border border-neutral-700 rounded px-2 py-0.5 text-neutral-300 focus:outline-none focus:border-neutral-500"
            />
          </div>
        </div>

        {/* Recipient */}
        <div>
          <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">Recipient</p>
          <input
            type="text"
            value={recVal}
            onChange={(e) => setRecVal(e.target.value)}
            onBlur={() => commitText("rec", recVal)}
            onKeyDown={(e) => e.key === "Enter" && commitText("rec", recVal)}
            placeholder="Name or email…"
            className="text-[11px] bg-neutral-800 border border-neutral-700 rounded px-2 py-0.5 text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 w-36"
          />
        </div>

        {/* Body full-text search */}
        <div>
          <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">Body search</p>
          <input
            type="text"
            value={qVal}
            onChange={(e) => setQVal(e.target.value)}
            onBlur={() => commitText("q", qVal)}
            onKeyDown={(e) => e.key === "Enter" && commitText("q", qVal)}
            placeholder="Full-text… (Enter)"
            className="text-[11px] bg-neutral-800 border border-neutral-700 rounded px-2 py-0.5 text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 w-44"
          />
        </div>
      </div>
      </div>
      )}
    </div>
  );
}
