"use client";

// Centre pane of the builder — a live, themed render of whatever is selected.
// Uses the same QuestionInput components as the public runner, so what you see
// here is exactly what respondents get. Inputs are interactive (sandboxed
// answers, never stored); edits in the inspector appear instantly.

import { useState } from "react";
import type { AnswerValue, FormDefinition } from "@/lib/forms/types";
import { QuestionInput } from "../runner/QuestionInput";
import type { Selection } from "./BuilderApp";

const FONT_STACKS: Record<string, string> = {
  sans: "var(--font-bw-sans), system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  display: "var(--font-bw-display), Georgia, serif",
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

  const primaryButton: React.CSSProperties = {
    background: "var(--fr-primary)",
    color: "var(--fr-button-text)",
    border: "none",
    borderRadius: t.buttonRadius,
    padding: "12px 26px",
    fontSize: 15,
    fontWeight: 650,
    fontFamily: "inherit",
    cursor: "default",
  };

  return (
    <section
      className="bw-scroll"
      style={{ flex: 1, minWidth: 0, overflowY: "auto", background: "var(--bw-paper-sunken)", padding: 18 }}
    >
      <div
        key={selection.kind + (selection.kind !== "welcome" ? selection.id : "")}
        className="bw-fade-up"
        style={{
          ...vars,
          minHeight: "calc(100% - 4px)",
          borderRadius: 16,
          background,
          color: "var(--fr-text)",
          fontFamily: FONT_STACKS[t.font],
          boxShadow: "var(--bw-shadow)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "clamp(24px, 6vw, 64px)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {t.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.logoUrl} alt="" style={{ position: "absolute", top: 18, left: 20, height: 30, maxWidth: 140, objectFit: "contain" }} />
        )}

        {/* Welcome preview */}
        {selection.kind === "welcome" && (
          <div style={{ textAlign: "center", opacity: def.welcome.enabled ? 1 : 0.45 }}>
            {def.welcome.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={def.welcome.imageUrl} alt="" style={{ maxWidth: 200, maxHeight: 120, objectFit: "contain", margin: "0 auto 22px", display: "block", borderRadius: 10 }} />
            )}
            <h1 style={{ fontSize: "clamp(24px, 3.4vw, 34px)", lineHeight: 1.15, margin: "0 0 12px", fontWeight: 650 }}>
              {def.welcome.title || "Untitled form"}
            </h1>
            {def.welcome.description && (
              <p style={{ fontSize: 16, opacity: 0.72, lineHeight: 1.55, margin: "0 auto 24px", maxWidth: 460 }}>{def.welcome.description}</p>
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
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fr-primary)", margin: "0 0 10px" }}>
                {question.section}
              </p>
            )}
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: question.description ? 6 : 18 }}>
              <span style={{ fontSize: 14, color: "var(--fr-primary)", fontWeight: 650 }}>{questionIndex + 1} →</span>
              <h2 style={{ fontSize: "clamp(19px, 2.4vw, 26px)", lineHeight: 1.3, margin: 0, fontWeight: 600, color: question.title ? undefined : "color-mix(in srgb, var(--fr-text) 40%, transparent)" }}>
                {question.title || "Type your question in the panel →"}
                {question.required && <span style={{ color: "var(--fr-primary)", marginLeft: 4 }}>*</span>}
              </h2>
            </div>
            {question.description && (
              <p style={{ fontSize: 15, opacity: 0.68, lineHeight: 1.55, margin: "0 0 18px", paddingLeft: 32 }}>{question.description}</p>
            )}
            {question.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={question.imageUrl} alt="" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 12, marginBottom: 18, display: "block" }} />
            )}
            <QuestionInput
              question={question}
              value={sandboxAnswers[question.id]}
              onChange={(v) => setSandboxAnswers((a) => ({ ...a, [question.id]: v }))}
              onUploadFile={async (file) => ({ id: "preview", fileName: file.name })}
            />
            {question.type === "statement" ? (
              <button style={{ ...primaryButton, marginTop: 22 }}>{question.buttonText || "Continue"}</button>
            ) : !["single_choice", "dropdown", "yes_no", "picture_choice", "opinion_scale", "star_rating"].includes(question.type) ? (
              <button style={{ ...primaryButton, marginTop: 22 }}>OK ✓</button>
            ) : null}
          </div>
        )}

        {/* Ending preview */}
        {ending && (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 58, height: 58, borderRadius: 999, background: "var(--fr-primary)", color: "var(--fr-button-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 20px" }}>
              ✓
            </div>
            <h1 style={{ fontSize: "clamp(22px, 3vw, 30px)", margin: "0 0 10px", fontWeight: 650 }}>{ending.title || "Thanks"}</h1>
            {ending.description && <p style={{ fontSize: 15, opacity: 0.72, lineHeight: 1.55, maxWidth: 440, margin: "0 auto" }}>{ending.description}</p>}
            {ending.buttonText && (
              <button style={{ ...primaryButton, marginTop: 22 }}>{ending.buttonText}</button>
            )}
          </div>
        )}

        {/* Empty form hint */}
        {selection.kind === "question" && !question && (
          <p style={{ textAlign: "center", opacity: 0.6, fontSize: 15 }}>This question was removed. Pick another from the list.</p>
        )}
      </div>

      {/* Flow strip under the canvas */}
      {def.questions.length > 0 && (
        <div style={{ display: "flex", gap: 5, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
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
                  background: active ? "var(--bw-green)" : "var(--bw-line-strong)",
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
