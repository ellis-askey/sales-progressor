"use client";

import { useState } from "react";
import { StarRating } from "@/components/ui/StarRating";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Button } from "@/components/arc/button/button";

const CORAL = "#FF6B4A";
const coralVars = { "--foreground": CORAL, "--background": "#ffffff" } as React.CSSProperties;

const labelStyle: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(45,24,16,0.55)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export function SurveyForm({ token }: { token: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteFocus, setNoteFocus] = useState(false);

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
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(47,158,107,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#2F9E6B" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#2D1810", margin: "0 0 6px" }}>Thank you.</p>
        <p style={{ fontSize: 13, color: "rgba(45,24,16,0.55)", margin: 0, lineHeight: 1.6 }}>
          Your feedback has been recorded. We really appreciate you taking the time.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Star rating (canonical) */}
      <p style={labelStyle}>Overall rating</p>
      <div style={{ marginBottom: 24 }}>
        <StarRating value={rating} onChange={setRating} accent={CORAL} size={48} ariaLabel="Overall rating" />
      </div>

      {/* Comment */}
      <p style={labelStyle}>
        Any comments? <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
      </p>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onFocus={() => setNoteFocus(true)}
        onBlur={() => setNoteFocus(false)}
        placeholder="What went well? What could be improved?"
        rows={3}
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "#fff",
          border: `1px solid ${noteFocus ? CORAL : "rgba(23,23,30,0.14)"}`,
          borderRadius: 12,
          padding: "12px 14px",
          color: "#2D1810",
          fontSize: 14,
          lineHeight: 1.5,
          resize: "vertical",
          minHeight: 88,
          outline: "none",
          fontFamily: "inherit",
          transition: "border-color 0.12s ease",
          marginBottom: 20,
        }}
      />

      {error && (
        <div style={{ marginBottom: 16 }}>
          <InlineAlert kind="danger">{error}</InlineAlert>
        </div>
      )}

      <Button
        type="button"
        onClick={submit}
        variant="primary"
        size="lg"
        loading={submitting}
        disabled={!rating}
        style={{ ...coralVars, width: "100%" }}
      >
        Submit feedback
      </Button>
    </div>
  );
}
