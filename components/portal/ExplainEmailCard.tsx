"use client";

import { useState } from "react";
import { P } from "@/components/portal/portal-ui";

type State = "idle" | "open" | "loading" | "result" | "error";

export function ExplainEmailCard({ token }: { token: string }) {
  const [state, setState] = useState<State>("idle");
  const [emailBody, setEmailBody] = useState("");
  const [explanation, setExplanation] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit() {
    if (emailBody.trim().length < 20) return;
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/portal/explain-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, emailBody }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        setState("error");
        return;
      }
      setExplanation(data.explanation);
      setState("result");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setState("error");
    }
  }

  function handleReset() {
    setState("open");
    setEmailBody("");
    setExplanation("");
    setErrorMsg("");
  }

  if (state === "idle") {
    return (
      <button
        onClick={() => setState("open")}
        style={{
          width: "100%",
          background: P.cardBg,
          border: `1px dashed ${P.border}`,
          borderRadius: P.radiusLg,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: P.radiusSm,
            background: P.primaryBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: 20,
          }}
        >
          💬
        </span>
        <span>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.textPrimary, lineHeight: 1.3 }}>
            Got a confusing email from your solicitor?
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: P.textMuted, lineHeight: 1.4 }}>
            Paste it in and we'll explain it in plain English.
          </p>
        </span>
      </button>
    );
  }

  if (state === "result") {
    return (
      <div style={{ background: P.cardBg, borderRadius: P.radiusLg, overflow: "hidden", boxShadow: P.shadowSm }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${P.border}` }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: P.textPrimary }}>Plain-English Summary</p>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.65,
              color: P.textSecondary,
              whiteSpace: "pre-wrap",
            }}
          >
            {explanation}
          </div>
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              background: P.accentBg,
              borderRadius: P.radiusSm,
              fontSize: 12,
              color: P.textMuted,
              lineHeight: 1.5,
            }}
          >
            This is a plain-English summary for your reference only. Always rely on your solicitor for actual legal advice.
          </div>
          <button
            onClick={handleReset}
            style={{
              marginTop: 14,
              padding: "8px 16px",
              borderRadius: P.radiusSm,
              background: "transparent",
              border: `1px solid ${P.border}`,
              fontSize: 13,
              color: P.textMuted,
              cursor: "pointer",
            }}
          >
            Explain another email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: P.cardBg, borderRadius: P.radiusLg, overflow: "hidden", boxShadow: P.shadowSm }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: `1px solid ${P.border}`,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: P.textPrimary }}>Explain a solicitor email</p>
        <button
          onClick={() => setState("idle")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: P.textMuted,
            fontSize: 18,
            lineHeight: 1,
            padding: 4,
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div style={{ padding: "16px 20px" }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: P.textSecondary, lineHeight: 1.5 }}>
          Paste the email from your solicitor below. We'll explain what they're saying in simple terms.
        </p>
        <textarea
          value={emailBody}
          onChange={(e) => setEmailBody(e.target.value)}
          placeholder="Paste solicitor email here…"
          rows={6}
          disabled={state === "loading"}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 14px",
            borderRadius: P.radiusSm,
            border: `1px solid ${P.border}`,
            background: "#F8F9FB",
            fontSize: 13,
            lineHeight: 1.55,
            color: P.textPrimary,
            resize: "vertical",
            outline: "none",
            fontFamily: "inherit",
            opacity: state === "loading" ? 0.6 : 1,
          }}
        />
        {state === "error" && (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#ef4444" }}>{errorMsg}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={state === "loading" || emailBody.trim().length < 20}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "11px 0",
            borderRadius: P.radiusSm,
            background:
              state === "loading" || emailBody.trim().length < 20
                ? "#E5E7EB"
                : P.primary,
            color:
              state === "loading" || emailBody.trim().length < 20
                ? P.textMuted
                : "#fff",
            border: "none",
            fontSize: 14,
            fontWeight: 600,
            cursor: state === "loading" || emailBody.trim().length < 20 ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {state === "loading" ? "Explaining…" : "Explain this email"}
        </button>
        <p style={{ margin: "10px 0 0", fontSize: 11, color: P.textMuted, textAlign: "center", lineHeight: 1.4 }}>
          Your email text is not stored. We only log that you used this feature.
        </p>
      </div>
    </div>
  );
}
