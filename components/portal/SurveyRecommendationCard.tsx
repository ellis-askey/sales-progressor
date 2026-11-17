"use client";

// Non-TSP survey path (temporary). On files TSP doesn't progress there's no
// vetted-surveyor network to offer, so instead of a quote flow the buyer can ask
// their agent for a recommendation. Tapping emails the agent (reply-to the buyer)
// and flips the card to a confirmation that the agent has been asked. Mirrors the
// visual language of the portal's survey cards, in the coral accent (an "ask your
// agent" action) rather than the blue provider-marketplace look.

import { useState } from "react";
import { P } from "./portal-ui";
import { requestSurveyRecommendationAction } from "@/app/actions/request-survey-recommendation";

export function SurveyRecommendationCard({
  token,
  agencyName,
  asked: askedInitial = false,
}: {
  token: string;
  agencyName: string;
  asked?: boolean;
}) {
  const [asked, setAsked] = useState(askedInitial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agency = agencyName || "your agent";

  async function ask() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await requestSurveyRecommendationAction(token);
      if (res.ok) setAsked(true);
      else setError(res.error);
    } catch {
      setError("We couldn't send that just now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (asked) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowSm }}>
        <div className="flex items-center gap-3 p-5">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: P.accentBg, color: P.accent }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold" style={{ color: P.textPrimary, marginBottom: 2 }}>
              {`We've asked ${agency}`}
            </p>
            <p className="text-[12px]" style={{ color: P.textSecondary, lineHeight: 1.4 }}>
              If they have a surveyor they&apos;d recommend, they&apos;ll be in touch.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl"
      style={{
        padding: 20,
        background: P.accentBg,
        border: `0.5px solid ${P.border}`,
        boxShadow: P.shadowSm,
      }}
    >
      <div className="flex items-center gap-3.5">
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 52, height: 52, borderRadius: 14, background: "#fff", color: P.accent, boxShadow: P.shadowSm }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold" style={{ color: P.textPrimary, marginBottom: 2 }}>
            Need a surveyor?
          </p>
          <p className="text-[12px]" style={{ color: P.textSecondary, lineHeight: 1.4 }}>
            {`We can ask ${agency} whether they have someone they'd recommend.`}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-[12px] mt-3" style={{ color: P.warning }}>
          {error}
        </p>
      )}

      <button
        onClick={ask}
        disabled={loading}
        className="pbtn pbtn-press w-full mt-4 flex items-center justify-center py-3 rounded-xl text-[14px] font-bold text-white disabled:opacity-60 transition-opacity"
        style={{ background: P.accent }}
      >
        {loading ? "Sending…" : "Ask for a recommendation"}
      </button>
    </div>
  );
}
