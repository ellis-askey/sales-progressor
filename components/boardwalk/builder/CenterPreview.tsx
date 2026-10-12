"use client";

// Centre pane of the builder — a realistic respondent viewport, not a bare
// canvas. The selected screen renders inside a framed "browser" with the
// form's real theme, progress bar and runner-style bottom bar, switchable
// between desktop and mobile widths. Inputs are the SAME components as the
// public runner (sandboxed answers, never stored), so what you see here is
// exactly what respondents get.

import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import type { AnswerValue, FormDefinition } from "@/lib/forms/types";
import { QuestionInput } from "../runner/QuestionInput";
import type { Selection } from "./BuilderApp";

const FONT_STACKS: Record<string, string> = {
  sans: "brandon-grotesque, var(--font-bw-sans), 'Helvetica Neue', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  display: "blacker-pro-display, var(--font-bw-display), Georgia, serif",
  mono: "ui-monospace, Menlo, monospace",
};

export function CenterPreview({
  def,
  selection,
  onSelect,
}: {
  def: FormDefinition;
  selection: Selection;
  onSelect: (sel: Selection) => void;
}) {
  const [sandboxAnswers, setSandboxAnswers] = useState<Record<string, AnswerValue | undefined>>({});
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const t = def.theme;

  const vars = {
    "--fr-primary": t.primaryColor,
    "--fr-primary-tint": `color-mix(in srgb, ${t.primaryColor} 12%, transparent)`,
    "--fr-bg": t.backgroundColor,
    "--fr-text": t.textColor,
    "--fr-button-text": t.buttonTextColor,
    "--fr-line": `color-mix(in srgb, ${t.textColor} 22%, transparent)`,
    "--fr-surface": `color-mix(in srgb, ${t.backgroundColor} 88%, ${t.textColor} 2%)`,
  } as React.CSSProperties;

  const background =
    t.backgroundStyle === "gradient"
      ? `radial-gradient(900px 500px at 80% -10%, color-mix(in srgb, ${t.primaryColor} 12%, transparent), transparent 55%), ${t.backgroundColor}`
      : t.backgroundStyle === "image" && t.backgroundImageUrl
        ? `linear-gradient(color-mix(in srgb, ${t.backgroundColor} 82%, transparent), color-mix(in srgb, ${t.backgroundColor} 82%, transparent)), center/cover no-repeat url(${JSON.stringify(t.backgroundImageUrl)})`
        : t.backgroundColor;

  const question = selection.kind === "question" ? def.questions.find((q) => q.id === selection.id) : null;
  const ending = selection.kind === "ending" ? def.endings.find((e) => e.id === selection.id) : null;
  const questionIndex = question ? def.questions.findIndex((q) => q.id === question.id) : -1;

  // Rough but real progress for the progress bar: position in the question list.
  const progress =
    selection.kind === "welcome"
      ? 0
      : selection.kind === "ending"
        ? 1
        : def.questions.length
          ? Math.min((questionIndex + 0.5) / def.questions.length, 0.96)
          : 0;

  const primaryButton: React.CSSProperties = {
    background: "var(--fr-primary)",
    color: "var(--fr-button-text)",
    border: "none",
    borderRadius: t.buttonRadius,
    padding: device === "mobile" ? "11px 22px" : "12px 26px",
    fontSize: 15,
    fontWeight: 650,
    fontFamily: FONT_STACKS.sans,
    letterSpacing: "0.03em",
    cursor: "default",
  };

  const isMobile = device === "mobile";

  return (
    <section
      className="bw-scroll"
      style={{
        flex: 1,
        minWidth: 0,
        overflowY: "auto",
        background: "var(--bw-paper-sunken)",
        padding: "18px 18px 26px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Device toggle */}
      <div className="bw-seg" style={{ marginBottom: 14, background: "rgba(64,70,72,0.08)" }}>
        <button data-active={device === "desktop"} onClick={() => setDevice("desktop")} aria-label="Desktop preview" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Monitor size={13} /> Desktop
        </button>
        <button data-active={device === "mobile"} onClick={() => setDevice("mobile")} aria-label="Mobile preview" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Smartphone size={13} /> Mobile
        </button>
      </div>

      {/* Viewport frame */}
      <div
        key={device}
        className="bw-fade-up"
        style={{
          width: isMobile ? 390 : "100%",
          maxWidth: isMobile ? "92%" : 980,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "var(--bw-shadow-lg)",
          border: "1px solid var(--bw-line)",
          background: "var(--bw-paper-raised)",
          display: "flex",
          flexDirection: "column",
          flex: isMobile ? "0 0 auto" : 1,
          minHeight: isMobile ? 640 : 520,
        }}
      >
        {/* Browser chrome */}
        <div
          style={{
            height: 34,
            background: "var(--bw-paper)",
            borderBottom: "1px solid var(--bw-line)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 12px",
            flexShrink: 0,
          }}
        >
          <span style={{ display: "flex", gap: 4 }}>
            {["#dcd7d0", "#dcd7d0", "#dcd7d0"].map((c, i) => (
              <span key={i} style={{ width: 8, height: 8, borderRadius: 99, background: c }} />
            ))}
          </span>
          <span
            style={{
              margin: "0 auto",
              fontSize: 10.5,
              color: "var(--bw-ink-faint)",
              background: "var(--bw-paper-sunken)",
              borderRadius: 999,
              padding: "3px 14px",
              letterSpacing: "0.03em",
              maxWidth: "60%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {def.welcome.title ? def.welcome.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 34) || "your-form" : "your-form"}
          </span>
        </div>

        {/* The form itself */}
        <div
          key={selection.kind + (selection.kind !== "welcome" ? selection.id : "")}
          style={{
            ...vars,
            flex: 1,
            background,
            color: "var(--fr-text)",
            fontFamily: FONT_STACKS[t.font],
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Progress */}
          {t.progressStyle === "bar" && (
            <div style={{ height: 4, background: "color-mix(in srgb, var(--fr-text) 10%, transparent)", flexShrink: 0 }}>
              <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, background: "var(--fr-primary)", transition: "width 360ms cubic-bezier(0.2,0.9,0.3,1)" }} />
            </div>
          )}
          {t.progressStyle === "fraction" && (
            <div style={{ textAlign: "right", padding: "8px 14px 0", fontSize: 12, opacity: 0.6, flexShrink: 0 }}>
              {Math.round(progress * 100)}% complete
            </div>
          )}

          {t.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.logoUrl} alt="" style={{ position: "absolute", top: 16, left: 18, height: 28, maxWidth: 130, objectFit: "contain" }} />
          )}

          <div
            className="bw-fade-up"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: isMobile ? "48px 26px 70px" : "56px clamp(32px, 7%, 90px) 80px",
              maxWidth: isMobile ? undefined : 720,
              width: "100%",
              margin: "0 auto",
            }}
          >
            {/* Welcome preview */}
            {selection.kind === "welcome" && (
              <div style={{ textAlign: "center", opacity: def.welcome.enabled ? 1 : 0.45 }}>
                {def.welcome.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={def.welcome.imageUrl} alt="" style={{ maxWidth: 200, maxHeight: 120, objectFit: "contain", margin: "0 auto 22px", display: "block", borderRadius: 10 }} />
                )}
                <h1 style={{ fontSize: isMobile ? 26 : "clamp(26px, 3.4vw, 36px)", lineHeight: 1.15, margin: "0 0 12px", fontWeight: t.font === "sans" ? 650 : 480 }}>
                  {def.welcome.title || "Untitled form"}
                </h1>
                {def.welcome.description && (
                  <p style={{ fontSize: 16, opacity: 0.72, lineHeight: 1.55, margin: "0 auto 26px", maxWidth: 440 }}>{def.welcome.description}</p>
                )}
                <button style={primaryButton}>{def.welcome.buttonText || "Start"}</button>
                {!def.welcome.enabled && (
                  <p style={{ fontSize: 13, marginTop: 20, opacity: 0.7 }}>Welcome screen is turned off. Respondents go straight to question 1.</p>
                )}
              </div>
            )}

            {/* Question preview */}
            {question && (
              <div>
                {question.section && (
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fr-primary)", margin: "0 0 12px", fontFamily: FONT_STACKS.sans }}>
                    {question.section}
                  </p>
                )}
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: question.description ? 6 : 20 }}>
                  <span style={{ fontSize: 13.5, color: "var(--fr-primary)", fontWeight: 650, fontFamily: FONT_STACKS.sans, flexShrink: 0 }}>{questionIndex + 1} →</span>
                  <h2
                    style={{
                      fontSize: isMobile ? 21 : "clamp(20px, 2.4vw, 27px)",
                      lineHeight: 1.3,
                      margin: 0,
                      fontWeight: t.font === "sans" ? 600 : 450,
                      color: question.title ? undefined : "color-mix(in srgb, var(--fr-text) 40%, transparent)",
                    }}
                  >
                    {question.title || "Type your question in the panel →"}
                    {question.required && <span style={{ color: "var(--fr-primary)", marginLeft: 4 }}>*</span>}
                  </h2>
                </div>
                {question.description && (
                  <p style={{ fontSize: 15, opacity: 0.68, lineHeight: 1.55, margin: "0 0 20px", paddingLeft: isMobile ? 0 : 32 }}>{question.description}</p>
                )}
                {question.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={question.imageUrl} alt="" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 12, marginBottom: 18, display: "block" }} />
                )}
                <QuestionInput
                  question={question}
                  value={sandboxAnswers[question.id]}
                  onChange={(v) => setSandboxAnswers((a) => ({ ...a, [question.id]: v }))}
                  onUploadFile={async (file) => ({ id: "preview", fileName: file.name })}
                />
                {question.type === "statement" ? (
                  <button style={{ ...primaryButton, marginTop: 24 }}>{question.buttonText || "Continue"}</button>
                ) : !["single_choice", "dropdown", "yes_no", "picture_choice", "opinion_scale", "star_rating"].includes(question.type) ? (
                  <button style={{ ...primaryButton, marginTop: 24 }}>OK ✓</button>
                ) : null}
              </div>
            )}

            {/* Ending preview */}
            {ending && (
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 58, height: 58, borderRadius: 999, background: "var(--fr-primary)", color: "var(--fr-button-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 22px" }}>
                  ✓
                </div>
                <h1 style={{ fontSize: isMobile ? 24 : "clamp(22px, 3vw, 30px)", margin: "0 0 10px", fontWeight: t.font === "sans" ? 650 : 480 }}>{ending.title || "Thanks"}</h1>
                {ending.description && <p style={{ fontSize: 15, opacity: 0.72, lineHeight: 1.55, maxWidth: 420, margin: "0 auto" }}>{ending.description}</p>}
                {ending.buttonText && <button style={{ ...primaryButton, marginTop: 24 }}>{ending.buttonText}</button>}
              </div>
            )}

            {selection.kind === "question" && !question && (
              <p style={{ textAlign: "center", opacity: 0.6, fontSize: 15 }}>This question was removed. Pick another from the list.</p>
            )}
          </div>

          {/* Runner-style bottom bar */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: `linear-gradient(transparent, ${t.backgroundColor} 60%)`,
              pointerEvents: "none",
            }}
          >
            <span style={{ fontSize: 11.5, opacity: 0.5, fontFamily: FONT_STACKS.sans, letterSpacing: "0.04em" }}>Boardwalk</span>
            <span style={{ display: "flex", gap: 7 }}>
              {["↑", "↓"].map((s, i) => (
                <span
                  key={i}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: i === 0 ? "1.5px solid var(--fr-line)" : "none",
                    background: i === 0 ? "transparent" : "var(--fr-primary)",
                    color: i === 0 ? "var(--fr-text)" : "var(--fr-button-text)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    opacity: i === 0 ? 0.6 : 1,
                  }}
                >
                  {s}
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>

      {/* Flow strip */}
      {def.questions.length > 0 && (
        <div style={{ display: "flex", gap: 5, marginTop: 14, flexWrap: "wrap", justifyContent: "center" }}>
          {def.questions.map((q, i) => {
            const active = selection.kind === "question" && selection.id === q.id;
            return (
              <button
                key={q.id}
                title={q.title || `Question ${i + 1}`}
                onClick={() => onSelect({ kind: "question", id: q.id })}
                style={{
                  width: active ? 22 : 8,
                  height: 8,
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  background: active ? "var(--bw-brand)" : "var(--bw-line-strong)",
                  transition: "all 180ms ease",
                  padding: 0,
                }}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
