"use client";

// The Boardwalk form-filling experience: welcome screen, one question at a
// time with smooth directional transitions, keyboard navigation, progress,
// conditional routing via lib/forms/logic, then submission. Also supports the
// "classic" all-questions-on-one-page layout. Used by the public page at
// /f/[publicId] (live + preview modes).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AnswerValue,
  EndingScreen,
  FormTheme,
  Question,
  ResponseAnswers,
  WelcomeScreen,
} from "@/lib/forms/types";
import { firstStep, isQuestionVisible, stepAfter, walkPath, type FlowStep } from "@/lib/forms/logic";
import { validateAnswer } from "@/lib/forms/validate";
import { FormsApiError, formsApi } from "@/lib/forms/client";
import { QuestionInput } from "./QuestionInput";

export interface RunnerForm {
  publicId: string;
  title: string;
  welcome: WelcomeScreen;
  questions: Question[];
  endings: EndingScreen[];
  theme: FormTheme;
  hiddenFields: string[];
  tenantName: string;
}

const FONT_STACKS: Record<FormTheme["font"], string> = {
  sans: "var(--font-bw-sans), system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  display: "var(--font-bw-display), Georgia, serif",
  mono: "ui-monospace, 'Cascadia Code', Menlo, monospace",
};

function mixTint(hex: string): string {
  // Cheap tint: primary at 10% over white-ish. Works for dark + light themes.
  return `color-mix(in srgb, ${hex} 12%, transparent)`;
}

function isAnswered(q: Question, value: AnswerValue | undefined): boolean {
  if (q.type === "statement") return true;
  return value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
}

export function FormRunner({ form, mode }: { form: RunnerForm; mode: "live" | "preview" }) {
  const t = form.theme;
  const oneAtATime = t.layout !== "classic";

  const [screen, setScreen] = useState<"welcome" | "flow" | "done">(
    form.welcome.enabled ? "welcome" : "flow"
  );
  const [step, setStep] = useState<FlowStep>(() => firstStep({ version: 1, ...form, settings: { notifyEmails: [], respondentConfirmation: { enabled: false }, hiddenFields: [] } } as never, {}));
  const [answers, setAnswers] = useState<ResponseAnswers>({});
  const [direction, setDirection] = useState<1 | -1>(1);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [ending, setEnding] = useState<EndingScreen | null>(null);
  const [transitionKey, setTransitionKey] = useState(0);
  const historyRef = useRef<number[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const startedBeaconSent = useRef(false);

  const def = useMemo(
    () => ({
      version: 1 as const,
      welcome: form.welcome,
      questions: form.questions,
      endings: form.endings,
      theme: form.theme,
      settings: {
        notifyEmails: [],
        respondentConfirmation: { enabled: false as const },
        hiddenFields: form.hiddenFields,
      },
    }),
    [form]
  );

  // View beacon on mount (live only)
  useEffect(() => {
    if (mode !== "live") return;
    void fetch(`/api/forms/public/${form.publicId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "view" }),
    }).catch(() => {});
  }, [form.publicId, mode]);

  const markStarted = useCallback(() => {
    if (startedAtRef.current === null) startedAtRef.current = Date.now();
    if (mode === "live" && !startedBeaconSent.current) {
      startedBeaconSent.current = true;
      void fetch(`/api/forms/public/${form.publicId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "start" }),
      }).catch(() => {});
    }
  }, [form.publicId, mode]);

  // Hidden fields from the URL
  const hiddenValues = useMemo(() => {
    if (typeof window === "undefined") return {};
    const params = new URLSearchParams(window.location.search);
    const out: Record<string, string> = {};
    for (const key of form.hiddenFields) {
      const v = params.get(key);
      if (v) out[key] = v;
    }
    return out;
  }, [form.hiddenFields]);

  const uploadFile = useCallback(
    (questionId: string) => async (file: File) => {
      if (mode === "preview") {
        // Previews never store files — return a fake id so the flow works.
        return { id: `preview_${Math.random().toString(36).slice(2)}`, fileName: file.name };
      }
      const data = new FormData();
      data.append("file", file);
      data.append("questionId", questionId);
      const res = await fetch(`/api/forms/public/${form.publicId}/upload`, { method: "POST", body: data });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Upload failed. Try again.");
      return body as { id: string; fileName: string };
    },
    [form.publicId, mode]
  );

  // ─── Submission ────────────────────────────────────────────────────────────

  const submit = useCallback(
    async (finalAnswers: ResponseAnswers) => {
      setSubmitting(true);
      setError(null);
      const { ending: localEnding } = walkPath(def as never, finalAnswers);
      if (mode === "preview") {
        setEnding(localEnding);
        setScreen("done");
        setSubmitting(false);
        return;
      }
      try {
        const uploadIds: string[] = [];
        for (const q of form.questions) {
          const v = finalAnswers[q.id];
          if (q.type === "file_upload" && Array.isArray(v)) uploadIds.push(...(v as string[]));
          if (q.type === "signature" && typeof v === "string") uploadIds.push(v);
        }
        const res = await formsApi<{ ok: boolean; endingId: string }>(
          `/api/forms/public/${form.publicId}/submit`,
          {
            method: "POST",
            body: JSON.stringify({
              answers: finalAnswers,
              hidden: hiddenValues,
              durationSeconds: startedAtRef.current
                ? Math.round((Date.now() - startedAtRef.current) / 1000)
                : undefined,
              uploadIds,
              website: "", // honeypot stays empty for humans
            }),
          }
        );
        const serverEnding = form.endings.find((e) => e.id === res.endingId) ?? localEnding;
        setEnding(serverEnding);
        setScreen("done");
        if (serverEnding.redirectUrl) {
          setTimeout(() => {
            window.location.href = serverEnding.redirectUrl!;
          }, 1800);
        }
      } catch (err) {
        if (err instanceof FormsApiError && err.failures?.length) {
          const map: Record<string, string> = {};
          for (const f of err.failures) map[f.questionId] = f.message;
          setFieldErrors(map);
          // Jump back to the first failing question in one-at-a-time mode
          const firstFail = form.questions.findIndex((q) => map[q.id]);
          if (oneAtATime && firstFail !== -1) {
            setStep({ kind: "question", question: form.questions[firstFail], index: firstFail });
            setError(map[form.questions[firstFail].id]);
            setTransitionKey((k) => k + 1);
          } else {
            setError("Some answers need another look.");
          }
        } else {
          setError((err as Error).message);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [def, form, hiddenValues, mode, oneAtATime]
  );

  // ─── One-at-a-time navigation ──────────────────────────────────────────────

  const advance = useCallback(() => {
    if (step.kind !== "question") return;
    const q = step.question;
    const value = answers[q.id];
    setError(null);

    if (q.type !== "statement") {
      if (q.required && !isAnswered(q, value)) {
        setError("This question needs an answer.");
        return;
      }
      if (isAnswered(q, value)) {
        const problem = validateAnswer(q, value as AnswerValue);
        if (problem) {
          setError(problem);
          return;
        }
      }
    }

    markStarted();
    const next = stepAfter(def as never, step.index, answers);
    if (next.kind === "ending") {
      void submit(answers);
      return;
    }
    historyRef.current.push(step.index);
    setDirection(1);
    setStep(next);
    setTransitionKey((k) => k + 1);
  }, [answers, def, markStarted, step, submit]);

  const goBack = useCallback(() => {
    const prev = historyRef.current.pop();
    if (prev === undefined) {
      if (form.welcome.enabled) setScreen("welcome");
      return;
    }
    setError(null);
    setDirection(-1);
    setStep({ kind: "question", question: form.questions[prev], index: prev });
    setTransitionKey((k) => k + 1);
  }, [form]);

  // Global Enter for statements / welcome
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return;
      if (screen === "welcome") {
        e.preventDefault();
        setScreen("flow");
        markStarted();
      } else if (screen === "flow" && step.kind === "question" && oneAtATime) {
        e.preventDefault();
        advance();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [screen, step, advance, oneAtATime, markStarted]);

  // Progress over the predicted remaining path
  const progress = useMemo(() => {
    if (step.kind !== "question") return 1;
    const { path } = walkPath(def as never, answers);
    const total = Math.max(path.length, 1);
    const position = path.findIndex((q) => q.id === step.question.id);
    return Math.min((position === -1 ? historyRef.current.length : position) / total, 0.96);
  }, [answers, def, step]);

  // ─── Theme container ───────────────────────────────────────────────────────

  const vars = {
    "--fr-primary": t.primaryColor,
    "--fr-primary-tint": mixTint(t.primaryColor),
    "--fr-bg": t.backgroundColor,
    "--fr-text": t.textColor,
    "--fr-button-text": t.buttonTextColor,
    "--fr-line": `color-mix(in srgb, ${t.textColor} 22%, transparent)`,
    "--fr-surface": `color-mix(in srgb, ${t.backgroundColor} 88%, ${t.textColor} 2%)`,
  } as React.CSSProperties;

  const background =
    t.backgroundStyle === "gradient"
      ? `radial-gradient(1200px 700px at 80% -10%, ${mixTint(t.primaryColor)}, transparent 55%), ${t.backgroundColor}`
      : t.backgroundStyle === "image" && t.backgroundImageUrl
        ? `linear-gradient(color-mix(in srgb, ${t.backgroundColor} 82%, transparent), color-mix(in srgb, ${t.backgroundColor} 82%, transparent)), center/cover no-repeat url(${JSON.stringify(t.backgroundImageUrl)})`
        : t.backgroundColor;

  const primaryButton: React.CSSProperties = {
    background: "var(--fr-primary)",
    color: "var(--fr-button-text)",
    border: "none",
    borderRadius: t.buttonRadius,
    padding: "13px 28px",
    fontSize: 16,
    fontWeight: 650,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "transform 120ms ease, filter 150ms ease",
  };

  return (
    <div
      style={{
        ...vars,
        minHeight: "100dvh",
        background,
        color: "var(--fr-text)",
        fontFamily: FONT_STACKS[t.font],
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @keyframes fr-in-fwd { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
        @keyframes fr-in-back { from { opacity: 0; transform: translateY(-26px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .fr-anim { animation: none !important; } }
        .fr-primary-btn:hover { filter: brightness(1.08); }
        .fr-primary-btn:active { transform: translateY(1px); }
      `}</style>

      {/* Progress */}
      {t.progressStyle !== "none" && screen === "flow" && oneAtATime && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 10 }}>
          {t.progressStyle === "bar" ? (
            <div style={{ height: 4, background: "color-mix(in srgb, var(--fr-text) 10%, transparent)" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.round(progress * 100)}%`,
                  background: "var(--fr-primary)",
                  transition: "width 360ms cubic-bezier(0.2, 0.9, 0.3, 1)",
                }}
              />
            </div>
          ) : (
            <div style={{ textAlign: "right", padding: "10px 16px", fontSize: 13, opacity: 0.65 }}>
              {Math.round(progress * 100)}% complete
            </div>
          )}
        </div>
      )}

      {/* Logo */}
      {t.logoUrl && (
        <div style={{ position: "fixed", top: 18, left: 20, zIndex: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.logoUrl} alt="" style={{ height: 34, maxWidth: 160, objectFit: "contain" }} />
        </div>
      )}

      {mode === "preview" && (
        <div
          style={{
            position: "fixed",
            top: 12,
            right: 12,
            zIndex: 20,
            background: "rgba(28,36,32,0.85)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 650,
            padding: "6px 12px",
            borderRadius: 999,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Preview. Responses aren&apos;t saved
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          maxWidth: 760,
          width: "100%",
          margin: "0 auto",
          padding: "72px 24px 110px",
        }}
      >
        {/* ── Welcome ── */}
        {screen === "welcome" && (
          <div className="fr-anim" style={{ animation: "fr-in-fwd 420ms cubic-bezier(0.2,0.9,0.3,1) both", textAlign: "center" }}>
            {form.welcome.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.welcome.imageUrl} alt="" style={{ maxWidth: 220, maxHeight: 140, objectFit: "contain", margin: "0 auto 26px", display: "block", borderRadius: 12 }} />
            )}
            <h1 style={{ fontSize: "clamp(26px, 4.5vw, 40px)", lineHeight: 1.15, margin: "0 0 14px", fontWeight: 650 }}>
              {form.welcome.title || form.title}
            </h1>
            {form.welcome.description && (
              <p style={{ fontSize: "clamp(15px, 2vw, 18px)", opacity: 0.75, lineHeight: 1.55, margin: "0 auto 28px", maxWidth: 520 }}>
                {form.welcome.description}
              </p>
            )}
            <button
              className="fr-primary-btn"
              style={primaryButton}
              onClick={() => {
                setScreen("flow");
                markStarted();
              }}
            >
              {form.welcome.buttonText || "Start"}
            </button>
            <p style={{ fontSize: 13, opacity: 0.5, margin: "14px 0 0" }}>
              {form.welcome.estimateLabel || `${form.questions.filter((q) => q.type !== "statement").length} questions`}
              <span style={{ margin: "0 6px" }}>·</span>press <strong>Enter ↵</strong> to begin
            </p>
          </div>
        )}

        {/* ── One-at-a-time flow ── */}
        {screen === "flow" && oneAtATime && step.kind === "question" && (
          <div
            key={transitionKey}
            className="fr-anim"
            style={{ animation: `${direction === 1 ? "fr-in-fwd" : "fr-in-back"} 340ms cubic-bezier(0.2,0.9,0.3,1) both` }}
          >
            <QuestionScreen
              question={step.question}
              number={historyRef.current.length + 1}
              value={answers[step.question.id]}
              error={error ?? fieldErrors[step.question.id] ?? null}
              onChange={(v) => {
                setError(null);
                setFieldErrors((fe) => {
                  if (!fe[step.question.id]) return fe;
                  const next = { ...fe };
                  delete next[step.question.id];
                  return next;
                });
                setAnswers((a) => {
                  const next = { ...a };
                  if (v === undefined) delete next[step.question.id];
                  else next[step.question.id] = v;
                  return next;
                });
                markStarted();
              }}
              onAdvance={advance}
              onUploadFile={uploadFile(step.question.id)}
              submitting={submitting}
              primaryButton={primaryButton}
              isLast={false}
            />
          </div>
        )}

        {/* ── Classic layout ── */}
        {screen === "flow" && !oneAtATime && (
          <div className="fr-anim" style={{ animation: "fr-in-fwd 380ms ease both" }}>
            <h1 style={{ fontSize: "clamp(24px, 3.6vw, 34px)", margin: "0 0 6px", fontWeight: 650 }}>{form.title}</h1>
            {form.welcome.description && (
              <p style={{ opacity: 0.7, margin: "0 0 34px", lineHeight: 1.55 }}>{form.welcome.description}</p>
            )}
            {form.questions
              .filter((q) => isQuestionVisible(q, answers))
              .map((q, i) => (
                <div key={q.id} style={{ marginBottom: 38 }}>
                  <QuestionScreen
                    question={q}
                    number={i + 1}
                    value={answers[q.id]}
                    error={fieldErrors[q.id] ?? null}
                    compact
                    onChange={(v) => {
                      setFieldErrors((fe) => {
                        if (!fe[q.id]) return fe;
                        const next = { ...fe };
                        delete next[q.id];
                        return next;
                      });
                      setAnswers((a) => {
                        const next = { ...a };
                        if (v === undefined) delete next[q.id];
                        else next[q.id] = v;
                        return next;
                      });
                      markStarted();
                    }}
                    onUploadFile={uploadFile(q.id)}
                    submitting={false}
                    primaryButton={primaryButton}
                    isLast={false}
                    hideContinue
                  />
                </div>
              ))}
            {error && <p style={{ color: "#c0392b", fontSize: 14, fontWeight: 600 }}>{error}</p>}
            <button
              className="fr-primary-btn"
              style={{ ...primaryButton, opacity: submitting ? 0.7 : 1 }}
              disabled={submitting}
              onClick={() => {
                // Validate all visible questions client-side first
                const visible = form.questions.filter((q) => isQuestionVisible(q, answers));
                const errs: Record<string, string> = {};
                for (const q of visible) {
                  const v = answers[q.id];
                  if (q.type === "statement") continue;
                  if (q.required && !isAnswered(q, v)) errs[q.id] = "This question needs an answer.";
                  else if (isAnswered(q, v)) {
                    const p = validateAnswer(q, v as AnswerValue);
                    if (p) errs[q.id] = p;
                  }
                }
                if (Object.keys(errs).length) {
                  setFieldErrors(errs);
                  setError("Some answers need another look.");
                  return;
                }
                void submit(answers);
              }}
            >
              {submitting ? "Sending…" : "Submit"}
            </button>
          </div>
        )}

        {/* ── Ending ── */}
        {screen === "done" && ending && (
          <div className="fr-anim" style={{ animation: "fr-in-fwd 420ms cubic-bezier(0.2,0.9,0.3,1) both", textAlign: "center" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 999,
                background: "var(--fr-primary)",
                color: "var(--fr-button-text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                margin: "0 auto 22px",
              }}
            >
              ✓
            </div>
            <h1 style={{ fontSize: "clamp(24px, 4vw, 34px)", margin: "0 0 12px", fontWeight: 650 }}>{ending.title}</h1>
            {ending.description && (
              <p style={{ fontSize: 16, opacity: 0.75, lineHeight: 1.55, maxWidth: 480, margin: "0 auto 26px" }}>{ending.description}</p>
            )}
            {ending.buttonText && ending.buttonUrl && (
              <a className="fr-primary-btn" style={{ ...primaryButton, textDecoration: "none", display: "inline-block" }} href={ending.buttonUrl}>
                {ending.buttonText}
              </a>
            )}
            {ending.redirectUrl && <p style={{ fontSize: 13, opacity: 0.5, marginTop: 18 }}>Taking you onwards…</p>}
          </div>
        )}
      </div>

      {/* Bottom bar: back/next + brand */}
      {screen === "flow" && oneAtATime && step.kind === "question" && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            background: `linear-gradient(transparent, ${t.backgroundColor} 55%)`,
          }}
        >
          <span style={{ fontSize: 12.5, opacity: 0.5 }}>{form.tenantName}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <NavButton onClick={goBack} disabled={historyRef.current.length === 0 && !form.welcome.enabled} label="Back" symbol="↑" />
            <NavButton onClick={advance} disabled={submitting} label="Next" symbol="↓" primary />
          </div>
        </div>
      )}
    </div>
  );
}

function NavButton({
  onClick,
  disabled,
  label,
  symbol,
  primary,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  symbol: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 40,
        height: 40,
        borderRadius: 9,
        border: primary ? "none" : "1.5px solid var(--fr-line)",
        background: primary ? "var(--fr-primary)" : "transparent",
        color: primary ? "var(--fr-button-text)" : "var(--fr-text)",
        fontSize: 17,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        transition: "filter 140ms ease",
        fontFamily: "inherit",
      }}
    >
      {symbol}
    </button>
  );
}

function QuestionScreen({
  question,
  number,
  value,
  error,
  onChange,
  onAdvance,
  onUploadFile,
  submitting,
  primaryButton,
  compact,
  hideContinue,
}: {
  question: Question;
  number: number;
  value: AnswerValue | undefined;
  error: string | null;
  onChange: (v: AnswerValue | undefined) => void;
  onAdvance?: () => void;
  onUploadFile: (file: File) => Promise<{ id: string; fileName: string }>;
  submitting: boolean;
  primaryButton: React.CSSProperties;
  isLast?: boolean;
  compact?: boolean;
  hideContinue?: boolean;
}) {
  const showContinue =
    !hideContinue &&
    !["single_choice", "dropdown", "yes_no", "picture_choice", "opinion_scale", "star_rating"].includes(question.type);

  return (
    <div>
      {question.section && (
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fr-primary)", margin: "0 0 10px" }}>
          {question.section}
        </p>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: question.description ? 6 : 20 }}>
        <span style={{ fontSize: 14, color: "var(--fr-primary)", fontWeight: 650, flexShrink: 0 }}>{number} →</span>
        <h2 style={{ fontSize: compact ? "clamp(17px, 2vw, 20px)" : "clamp(20px, 3vw, 28px)", lineHeight: 1.3, margin: 0, fontWeight: 600 }}>
          {question.title || "…"}
          {question.required && <span style={{ color: "var(--fr-primary)", marginLeft: 4 }}>*</span>}
        </h2>
      </div>
      {question.description && (
        <p style={{ fontSize: 15, opacity: 0.68, lineHeight: 1.55, margin: "0 0 20px", paddingLeft: compact ? 0 : 34 }}>{question.description}</p>
      )}
      {question.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={question.imageUrl} alt="" style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 12, marginBottom: 20, display: "block" }} />
      )}

      <div style={{ paddingLeft: compact ? 0 : undefined }}>
        <QuestionInput question={question} value={value} onChange={onChange} onAdvance={onAdvance} onUploadFile={onUploadFile} autoFocus={!compact} />
      </div>

      {question.type === "statement" && !hideContinue && (
        <button className="fr-primary-btn" style={{ ...primaryButton, marginTop: 24 }} onClick={onAdvance}>
          {question.buttonText || "Continue"}
        </button>
      )}

      {error && (
        <p role="alert" style={{ display: "inline-block", background: "rgba(192,57,43,0.1)", color: "#c0392b", fontSize: 13.5, fontWeight: 600, padding: "7px 12px", borderRadius: 8, margin: "14px 0 0" }}>
          {error}
        </p>
      )}

      {showContinue && question.type !== "statement" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 26 }}>
          <button className="fr-primary-btn" style={{ ...primaryButton, opacity: submitting ? 0.7 : 1 }} disabled={submitting} onClick={onAdvance}>
            {submitting ? "Sending…" : "OK ✓"}
          </button>
          {!compact && <span style={{ fontSize: 12.5, opacity: 0.5 }}>press <strong>Enter ↵</strong></span>}
        </div>
      )}
    </div>
  );
}
