"use client";

// Account → Client portal: a "try it yourself" box under the Explain-email
// toggle, so staff can paste a solicitor email and see exactly what their
// clients get back, before deciding whether to leave the helper on. Posts to the
// session-authed /api/agent/explain-email; nothing is stored.

import { useState } from "react";

export function AiExplainerTryIt() {
  const [body, setBody] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/agent/explain-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailBody: body }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Something went wrong. Please try again.");
      else setResult(data.explanation);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <p className="text-[12.5px] text-slate-500" style={{ marginBottom: 8 }}>
        Try it yourself: paste a solicitor email to see exactly what your clients get back.
      </p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Paste a solicitor email here…"
        rows={5}
        className="w-full rounded-lg border border-slate-300 p-3 text-[13px]"
        style={{ resize: "vertical" }}
      />
      <button
        type="button"
        onClick={run}
        disabled={loading || body.trim().length < 20}
        className="mt-2 inline-flex items-center rounded-lg bg-[#FF6B4A] px-4 py-2 text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
      >
        {loading ? "Reading…" : "Explain it"}
      </button>
      {error && <p className="mt-2 text-[12px] text-red-500">{error}</p>}
      {result && (
        <div className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-700">
          {result}
        </div>
      )}
    </div>
  );
}
