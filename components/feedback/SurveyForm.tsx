"use client";

import { useState } from "react";

const STAR_LABELS = ["", "Poor", "Below average", "Average", "Good", "Excellent"];

export function SurveyForm({ token }: { token: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!rating) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, rating, comment }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: "16px 0" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.30)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.90)" }}>Thank you!</p>
        <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>Your feedback has been recorded. We really appreciate you taking the time.</p>
      </div>
    );
  }

  const active = hovered ?? rating;

  return (
    <div>
      {/* Star rating */}
      <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.50)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Overall rating
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: 48, height: 48, borderRadius: 12,
              background: active !== null && n <= active ? "rgba(255,107,74,0.18)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${active !== null && n <= active ? "rgba(255,107,74,0.40)" : "rgba(255,255,255,0.10)"}`,
              cursor: "pointer", transition: "all 0.12s",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
            }}
          >
            {active !== null && n <= active ? "★" : "☆"}
          </button>
        ))}
      </div>
      {active !== null && (
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
          {STAR_LABELS[active]}
        </p>
      )}
      {active === null && <div style={{ marginBottom: 24 }} />}

      {/* Comment */}
      <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.50)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Any comments? <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
      </p>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="What went well? What could be improved?"
        rows={3}
        style={{
          width: "100%", boxSizing: "border-box",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10, padding: "10px 14px", color: "rgba(255,255,255,0.80)",
          fontSize: 14, lineHeight: 1.5, resize: "vertical",
          outline: "none", marginBottom: 20,
        }}
      />

      {error && <p style={{ margin: "0 0 12px", fontSize: 13, color: "#f87171" }}>{error}</p>}

      <button
        onClick={submit}
        disabled={!rating || submitting}
        style={{
          width: "100%", padding: "12px 0", borderRadius: 10,
          background: rating ? "linear-gradient(135deg, #FF8A65, #FF6B4A)" : "rgba(255,255,255,0.08)",
          color: rating ? "#fff" : "rgba(255,255,255,0.30)",
          border: "none", fontSize: 15, fontWeight: 700, cursor: rating ? "pointer" : "not-allowed",
          transition: "all 0.15s",
        }}
      >
        {submitting ? "Submitting…" : "Submit feedback"}
      </button>
    </div>
  );
}
