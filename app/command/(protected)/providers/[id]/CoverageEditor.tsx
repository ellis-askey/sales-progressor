"use client";

import { useState, useTransition } from "react";
import { addProviderCoverage, removeProviderCoverage } from "@/app/actions/provider-firms";
import { X } from "lucide-react";

type Row = { id: string; outwardCode: string };

export function CoverageEditor({ providerId, rows }: { providerId: string; rows: Row[] }) {
  const [pending, startTransition] = useTransition();
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function add() {
    if (!input.trim() || pending) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const r = await addProviderCoverage(providerId, input);
      if (r.ok) {
        const parts: string[] = [];
        if (r.data.added > 0) parts.push(`Added ${r.data.added}`);
        if (r.data.skipped.length > 0) parts.push(`Skipped ${r.data.skipped.length} unrecognised`);
        setMessage(parts.join(" · ") || "No new codes");
        setInput("");
        setTimeout(() => setMessage(null), 3000);
      } else {
        setError(r.error);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeProviderCoverage(id);
    });
  }

  return (
    <div>
      <div className="mb-2.5">
        <label className="block text-[10px] font-semibold text-[#525252] uppercase tracking-widest mb-1">
          Add outward codes
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="EN8, EN10, SW1, M14…"
            className="flex-1 bg-[#0a0a0a] border border-[#262626] rounded px-2.5 py-1.5 text-[13px] text-[#fafafa] focus:outline-none focus:border-[#2563eb] placeholder:text-[#404040]"
          />
          <button
            onClick={add}
            disabled={!input.trim() || pending}
            className="px-3 py-1 rounded text-[12px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: input.trim() && !pending ? "#2563eb" : "#404040" }}
          >
            Add
          </button>
        </div>
        <p className="text-[10px] text-[#525252] mt-1">
          Paste any postcode-shaped tokens (space, comma, newline separated). We'll extract the outward code and dedupe.
        </p>
        {message && <p className="text-[11px] text-[#86efac] mt-1">{message}</p>}
        {error && <p className="text-[11px] text-[#fca5a5] mt-1">{error}</p>}
      </div>

      {rows.length === 0 ? (
        <p className="text-[12px] text-[#737373] italic">No coverage yet. This firm won't appear on the client picker until you add at least one outward code.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {rows.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#262626] text-[11px] font-mono text-[#d4d4d4]"
            >
              {r.outwardCode}
              <button
                onClick={() => remove(r.id)}
                disabled={pending}
                className="text-[#525252] hover:text-[#fca5a5] transition-colors disabled:opacity-40"
                aria-label={`Remove ${r.outwardCode}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
