"use client";

// Command Centre: file the months of already-captured bridge messages into
// conversation threads (pivot 2026-10-18). Batched + idempotent — click until
// remaining reaches zero. Lives on the WhatsApp command page only.

import { useState } from "react";
import { convertBridgeHistoryAction } from "@/app/actions/command-whatsapp";

export function WhatsAppConvertHistory() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await convertBridgeHistoryAction();
      setResult(
        res.ok
          ? `Filed ${res.converted} messages into conversations. ${res.remaining} still to convert${res.remaining ? " — run again" : ""}.`
          : res.error ?? "Failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-[13px] font-semibold text-neutral-300">File captured history into conversations</h3>
          <p className="mt-1 text-[12px] text-neutral-500 max-w-xl">
            Converts everything the bridge has already captured into proper conversation threads, so the new per-file tab and
            inbox open with full history. Safe to run repeatedly; batched.
          </p>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[13px] font-semibold rounded-lg px-4 py-2 transition-colors"
        >
          {busy ? "Converting…" : "Convert a batch"}
        </button>
      </div>
      {result && <p className="mt-2 text-[12px] text-emerald-400">{result}</p>}
    </div>
  );
}
