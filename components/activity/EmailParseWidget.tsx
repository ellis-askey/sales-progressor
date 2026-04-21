"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailParseResult } from "@/lib/services/email-parse";

const CONFIDENCE_STYLE = {
  high:   { label: "High confidence", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  medium: { label: "Medium confidence", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  low:    { label: "Low confidence",   color: "text-gray-600",   bg: "bg-gray-50 border-gray-200" },
};

export function EmailParseWidget({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [emailText, setEmailText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmailParseResult | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function parseEmail() {
    if (!emailText.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setConfirmed(new Set());
    try {
      const res = await fetch("/api/ai/parse-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, emailText }),
      });
      if (!res.ok) throw new Error("Parse failed");
      setResult(await res.json());
    } catch {
      setError("Could not parse email. Check your API key and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmMilestone(milestoneId: string, milestoneName: string) {
    setConfirming(milestoneId);
    try {
      const res = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          transactionId,
          milestoneDefinitionId: milestoneId,
          summaryText: `Confirmed via email: ${result?.extractedSummary ?? milestoneName}`,
        }),
      });
      if (res.ok) {
        setConfirmed((prev) => new Set([...prev, milestoneId]));
        router.refresh();
      }
    } finally {
      setConfirming(null);
    }
  }

  function reset() {
    setEmailText("");
    setResult(null);
    setError(null);
    setConfirmed(new Set());
    setOpen(false);
  }

  return (
    <div className="bg-white rounded-xl border border-[#e4e9f0] overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-800">Parse email from solicitor</p>
            <p className="text-xs text-gray-400">Paste an email — AI will suggest which milestones to mark complete</p>
          </div>
        </div>
        <svg className={`w-4 h-4 text-gray-300 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-[#f0f4f8] px-5 py-4 space-y-4">
          {!result && (
            <>
              <textarea
                rows={6}
                placeholder="Paste the email content here…"
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                className="w-full text-sm border border-[#e4e9f0] rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 placeholder:text-gray-300"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={parseEmail}
                  disabled={loading || !emailText.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Analysing…" : "Analyse email"}
                </button>
                <button type="button" onClick={reset} className="text-sm text-gray-400 hover:text-gray-600">
                  Cancel
                </button>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </>
          )}

          {result && (
            <div className="space-y-4">
              {/* Summary */}
              {result.extractedSummary && (
                <div className="bg-gray-50 border border-[#e4e9f0] rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Email summary</p>
                  <p className="text-sm text-gray-700 leading-snug">{result.extractedSummary}</p>
                  {result.senderClue && (
                    <p className="text-xs text-gray-400 mt-1">Sender appears to be: {result.senderClue}</p>
                  )}
                </div>
              )}

              {/* Suggestions */}
              {result.noMatch || result.suggestions.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-400">No milestone matches found in this email.</p>
                  <p className="text-xs text-gray-300 mt-1">The email may be informational or relate to something not tracked.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Suggested milestones to mark complete
                  </p>
                  {result.suggestions.map((s) => {
                    const cfg = CONFIDENCE_STYLE[s.confidence];
                    const done = confirmed.has(s.milestoneId);
                    return (
                      <div key={s.milestoneId} className={`border rounded-xl px-4 py-3 ${cfg.bg}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 leading-snug">{s.milestoneName}</p>
                            <p className="text-xs text-gray-500 mt-0.5 leading-snug">{s.reason}</p>
                            <p className={`text-xs mt-1 font-medium ${cfg.color}`}>{cfg.label}</p>
                          </div>
                          {done ? (
                            <span className="text-xs font-medium text-emerald-600 flex items-center gap-1 flex-shrink-0">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                              Confirmed
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => confirmMilestone(s.milestoneId, s.milestoneName)}
                              disabled={confirming === s.milestoneId}
                              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
                            >
                              {confirming === s.milestoneId ? "Confirming…" : "Mark complete"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">
                ← Parse another email
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
