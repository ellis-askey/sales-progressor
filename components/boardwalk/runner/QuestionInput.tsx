"use client";

// Per-type answer inputs for the Boardwalk form runner. Shared by the public
// form at /f/[publicId] and the builder's live preview — every question type
// renders exactly the same in both places. All colours come from the --fr-*
// CSS variables set by the runner from the form's theme.

import { useEffect, useRef, useState } from "react";
import type { AnswerValue, Question } from "@/lib/forms/types";

export interface QuestionInputProps {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue | undefined) => void;
  /** Called when the input wants to advance (Enter, choice click on single-select…) */
  onAdvance?: () => void;
  /** Upload handler for file/signature questions. Returns the stored upload id. */
  onUploadFile?: (file: File) => Promise<{ id: string; fileName: string }>;
  autoFocus?: boolean;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: "2px solid var(--fr-line)",
  fontSize: "clamp(18px, 2.6vw, 26px)",
  fontFamily: "inherit",
  color: "var(--fr-text)",
  padding: "6px 2px 10px",
  outline: "none",
  transition: "border-color 160ms ease",
};

function TextLike({ question, value, onChange, onAdvance, autoFocus, type }: QuestionInputProps & { type: string }) {
  return (
    <input
      type={type}
      inputMode={question.type === "number" ? "decimal" : question.type === "phone" ? "tel" : undefined}
      style={inputStyle}
      placeholder={question.placeholder || "Type your answer here…"}
      value={(value as string | number | undefined) ?? ""}
      autoFocus={autoFocus}
      maxLength={question.maxLength && question.maxLength > 0 ? question.maxLength : undefined}
      onChange={(e) => {
        if (question.type === "number") {
          const v = e.target.value;
          onChange(v === "" ? undefined : Number(v));
        } else {
          onChange(e.target.value || undefined);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onAdvance?.();
        }
      }}
      onFocus={(e) => (e.target.style.borderBottomColor = "var(--fr-primary)")}
      onBlur={(e) => (e.target.style.borderBottomColor = "var(--fr-line)")}
    />
  );
}

function LongText({ question, value, onChange, onAdvance, autoFocus }: QuestionInputProps) {
  return (
    <div>
      <textarea
        style={{ ...inputStyle, resize: "none", minHeight: 96, lineHeight: 1.5 }}
        placeholder={question.placeholder || "Type your answer here…"}
        rows={3}
        value={(value as string | undefined) ?? ""}
        autoFocus={autoFocus}
        maxLength={question.maxLength && question.maxLength > 0 ? question.maxLength : undefined}
        onChange={(e) => onChange(e.target.value || undefined)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onAdvance?.();
          }
        }}
        onFocus={(e) => (e.currentTarget.style.borderBottomColor = "var(--fr-primary)")}
        onBlur={(e) => (e.currentTarget.style.borderBottomColor = "var(--fr-line)")}
      />
      <p style={{ fontSize: 12, opacity: 0.55, margin: "6px 0 0" }}>Shift + Enter for a new line · Ctrl + Enter to continue</p>
    </div>
  );
}

// ─── Choices ─────────────────────────────────────────────────────────────────

const KEY_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function choiceBase(selected: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    textAlign: "left",
    padding: "12px 14px",
    borderRadius: 10,
    border: `1.5px solid ${selected ? "var(--fr-primary)" : "var(--fr-line)"}`,
    background: selected ? "var(--fr-primary-tint)" : "var(--fr-surface)",
    color: "var(--fr-text)",
    fontSize: 16,
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "border-color 140ms ease, background 140ms ease, transform 120ms ease",
  };
}

function KeyBadge({ letter, selected }: { letter: string; selected: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        border: `1.5px solid ${selected ? "var(--fr-primary)" : "var(--fr-line)"}`,
        background: selected ? "var(--fr-primary)" : "transparent",
        color: selected ? "var(--fr-button-text)" : "var(--fr-text)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {letter}
    </span>
  );
}

function Choices({ question, value, onChange, onAdvance }: QuestionInputProps) {
  const multi = question.type === "multiple_choice";
  const selectedIds = multi
    ? ((value as string[] | undefined) ?? [])
    : value !== undefined
      ? [String(value)]
      : [];
  const [otherDraft, setOtherDraft] = useState(() => {
    const other = selectedIds.find((v) => v.startsWith("other:"));
    return other ? other.slice(6) : "";
  });
  const otherSelected = selectedIds.some((v) => v.startsWith("other:"));

  function toggle(id: string) {
    if (multi) {
      const has = selectedIds.includes(id);
      const next = has ? selectedIds.filter((v) => v !== id) : [...selectedIds, id];
      onChange(next.length ? next : undefined);
    } else {
      onChange(id);
      // Single select advances automatically after a beat — the Typeform feel.
      setTimeout(() => onAdvance?.(), 240);
    }
  }

  function setOther(text: string) {
    setOtherDraft(text);
    const tag = `other:${text}`;
    if (multi) {
      const rest = selectedIds.filter((v) => !v.startsWith("other:"));
      onChange(text ? [...rest, tag] : rest.length ? rest : undefined);
    } else {
      onChange(text ? tag : undefined);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }}>
      {(question.choices ?? []).map((c, i) => {
        const selected = selectedIds.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            style={choiceBase(selected)}
            onClick={() => toggle(c.id)}
          >
            <KeyBadge letter={KEY_LETTERS[i] ?? "•"} selected={selected} />
            <span style={{ flex: 1 }}>{c.label}</span>
            {multi && selected && <span style={{ color: "var(--fr-primary)", fontWeight: 700 }}>✓</span>}
          </button>
        );
      })}
      {question.allowOther && (
        <div style={choiceBase(otherSelected)}>
          <KeyBadge letter="＋" selected={otherSelected} />
          <input
            placeholder="Other: type your answer"
            value={otherDraft}
            onChange={(e) => setOther(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAdvance?.())}
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 16, fontFamily: "inherit", color: "var(--fr-text)" }}
          />
        </div>
      )}
      {multi && (
        <p style={{ fontSize: 12.5, opacity: 0.55, margin: "4px 0 0" }}>
          Choose {question.maxSelections ? `up to ${question.maxSelections}` : "as many as apply"}
        </p>
      )}
    </div>
  );
}

function PictureChoices({ question, value, onChange, onAdvance }: QuestionInputProps) {
  const selected = value !== undefined ? String(value) : undefined;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, maxWidth: 560 }}>
      {(question.choices ?? []).map((c) => {
        const isSel = selected === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              onChange(c.id);
              setTimeout(() => onAdvance?.(), 240);
            }}
            style={{
              ...choiceBase(isSel),
              flexDirection: "column",
              alignItems: "stretch",
              padding: 8,
              gap: 8,
            }}
          >
            <span
              style={{
                display: "block",
                aspectRatio: "4/3",
                borderRadius: 7,
                background: c.imageUrl
                  ? `center/cover no-repeat url(${JSON.stringify(c.imageUrl)})`
                  : "linear-gradient(135deg, var(--fr-primary-tint), var(--fr-line))",
              }}
            />
            <span style={{ fontSize: 14, textAlign: "center" }}>{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Dropdown({ question, value, onChange, onAdvance, autoFocus }: QuestionInputProps) {
  return (
    <select
      autoFocus={autoFocus}
      value={(value as string | undefined) ?? ""}
      onChange={(e) => {
        onChange(e.target.value || undefined);
        if (e.target.value) setTimeout(() => onAdvance?.(), 200);
      }}
      style={{
        ...inputStyle,
        cursor: "pointer",
        appearance: "auto" as never,
        borderBottom: "2px solid var(--fr-line)",
        maxWidth: 420,
      }}
    >
      <option value="" disabled>
        Choose an option…
      </option>
      {(question.choices ?? []).map((c) => (
        <option key={c.id} value={c.id} style={{ color: "#1c2420" }}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

function YesNo({ value, onChange, onAdvance }: QuestionInputProps) {
  return (
    <div style={{ display: "flex", gap: 10, maxWidth: 340 }}>
      {(["yes", "no"] as const).map((v, i) => {
        const selected = value === v;
        return (
          <button
            key={v}
            type="button"
            style={{ ...choiceBase(selected), justifyContent: "center", fontWeight: 600 }}
            onClick={() => {
              onChange(v);
              setTimeout(() => onAdvance?.(), 240);
            }}
          >
            <KeyBadge letter={i === 0 ? "Y" : "N"} selected={selected} />
            {v === "yes" ? "Yes" : "No"}
          </button>
        );
      })}
    </div>
  );
}

// ─── Scales & ratings ────────────────────────────────────────────────────────

function OpinionScale({ question, value, onChange, onAdvance }: QuestionInputProps) {
  const min = question.min ?? 1;
  const max = question.max ?? 10;
  const values: number[] = [];
  for (let i = min; i <= max; i++) values.push(i);
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {values.map((v) => {
          const selected = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => {
                onChange(v);
                setTimeout(() => onAdvance?.(), 240);
              }}
              style={{
                width: 44,
                height: 48,
                borderRadius: 9,
                border: `1.5px solid ${selected ? "var(--fr-primary)" : "var(--fr-line)"}`,
                background: selected ? "var(--fr-primary)" : "var(--fr-surface)",
                color: selected ? "var(--fr-button-text)" : "var(--fr-text)",
                fontSize: 16,
                fontWeight: 650,
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "all 130ms ease",
              }}
            >
              {v}
            </button>
          );
        })}
      </div>
      {(question.minLabel || question.maxLabel) && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12.5, opacity: 0.6, maxWidth: (44 + 6) * values.length }}>
          <span>{question.minLabel}</span>
          <span>{question.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

function Stars({ question, value, onChange, onAdvance }: QuestionInputProps) {
  const count = question.starCount ?? 5;
  const [hover, setHover] = useState(0);
  const current = (value as number | undefined) ?? 0;
  return (
    <div style={{ display: "flex", gap: 6 }} onMouseLeave={() => setHover(0)}>
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => {
        const lit = n <= (hover || current);
        return (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => {
              onChange(n);
              setTimeout(() => onAdvance?.(), 260);
            }}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 38,
              lineHeight: 1,
              color: lit ? "var(--fr-primary)" : "var(--fr-line)",
              transition: "color 100ms ease, transform 120ms ease",
              transform: hover === n ? "scale(1.15)" : "none",
              padding: 2,
            }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

function Ranking({ question, value, onChange }: QuestionInputProps) {
  const choices = question.choices ?? [];
  const order = (value as string[] | undefined) ?? choices.map((c) => c.id);
  useEffect(() => {
    if (value === undefined && choices.length) onChange(choices.map((c) => c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function move(index: number, dir: -1 | 1) {
    const next = [...order];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    onChange(next);
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }}>
      {order.map((id, i) => {
        const label = choices.find((c) => c.id === id)?.label ?? id;
        return (
          <div key={id} style={{ ...choiceBase(false), cursor: "default" }}>
            <span style={{ fontWeight: 700, color: "var(--fr-primary)", width: 22 }}>{i + 1}</span>
            <span style={{ flex: 1 }}>{label}</span>
            <button type="button" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0} style={{ background: "transparent", border: "none", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.25 : 0.7, fontSize: 15, color: "var(--fr-text)" }}>↑</button>
            <button type="button" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === order.length - 1} style={{ background: "transparent", border: "none", cursor: i === order.length - 1 ? "default" : "pointer", opacity: i === order.length - 1 ? 0.25 : 0.7, fontSize: 15, color: "var(--fr-text)" }}>↓</button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Advanced ────────────────────────────────────────────────────────────────

function Consent({ question, value, onChange }: QuestionInputProps) {
  const checked = value === true;
  return (
    <button
      type="button"
      onClick={() => onChange(checked ? undefined : true)}
      style={{ ...choiceBase(checked), maxWidth: 520, alignItems: "flex-start" }}
    >
      <span
        aria-hidden
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          flexShrink: 0,
          border: `1.5px solid ${checked ? "var(--fr-primary)" : "var(--fr-line)"}`,
          background: checked ? "var(--fr-primary)" : "transparent",
          color: "var(--fr-button-text)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          marginTop: 1,
        }}
      >
        {checked ? "✓" : ""}
      </span>
      <span style={{ fontSize: 15, lineHeight: 1.5, textAlign: "left" }}>
        {question.consentText || "I agree."}
      </span>
    </button>
  );
}

function FileUpload({ question, value, onChange, onUploadFile }: QuestionInputProps) {
  const ids = (value as string[] | undefined) ?? [];
  const [names, setNames] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const maxFiles = question.maxFiles ?? 1;

  const acceptMap: Record<string, string> = {
    image: "image/*",
    pdf: ".pdf",
    document: ".pdf,.doc,.docx,.txt",
    any: "",
  };
  const kinds = question.acceptedFileTypes?.length ? question.acceptedFileTypes : ["any"];
  const accept = kinds.includes("any") ? undefined : kinds.map((k) => acceptMap[k]).filter(Boolean).join(",");

  async function pick(files: FileList | null) {
    if (!files?.length || !onUploadFile) return;
    setError(null);
    setUploading(true);
    try {
      const room = maxFiles - ids.length;
      for (const file of Array.from(files).slice(0, room)) {
        const res = await onUploadFile(file);
        setNames((n) => ({ ...n, [res.id]: res.fileName }));
        onChange([...((value as string[] | undefined) ?? []), res.id]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      {ids.map((id) => (
        <div key={id} style={{ ...choiceBase(true), cursor: "default", marginBottom: 8 }}>
          <span style={{ flex: 1, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📎 {names[id] ?? "Uploaded file"}
          </span>
          <button
            type="button"
            onClick={() => onChange(ids.filter((v) => v !== id).length ? ids.filter((v) => v !== id) : undefined)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--fr-text)", opacity: 0.6, fontSize: 15 }}
            aria-label="Remove file"
          >
            ✕
          </button>
        </div>
      ))}
      {ids.length < maxFiles && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            ...choiceBase(false),
            justifyContent: "center",
            borderStyle: "dashed",
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? "Uploading…" : `⬆ Choose ${ids.length ? "another" : "a"} file`}
        </button>
      )}
      <input ref={inputRef} type="file" hidden accept={accept} multiple={maxFiles > 1} onChange={(e) => pick(e.target.files)} />
      <p style={{ fontSize: 12.5, opacity: 0.55, margin: "8px 0 0" }}>
        Up to {maxFiles} file{maxFiles === 1 ? "" : "s"}, {question.maxFileSizeMb ?? 10} MB each.
      </p>
      {error && <p style={{ fontSize: 13, color: "#c0392b", margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}

function Signature({ value, onChange, onUploadFile }: QuestionInputProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);
  const signed = typeof value === "string" && !!value;

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (signed) return;
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || signed) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = "#1c2420";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    setHasInk(true);
  }
  function end() {
    drawing.current = false;
  }
  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange(undefined);
  }

  async function confirm() {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk || !onUploadFile) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Couldn't capture the signature.");
      const file = new File([blob], "signature.png", { type: "image/png" });
      const res = await onUploadFile(file);
      onChange(res.id);
    } catch {
      // keep ink; user can retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <canvas
        ref={canvasRef}
        width={480}
        height={170}
        style={{
          width: "100%",
          height: 170,
          borderRadius: 10,
          border: `1.5px ${signed ? "solid var(--fr-primary)" : "dashed var(--fr-line)"}`,
          background: "#ffffff",
          touchAction: "none",
          cursor: signed ? "default" : "crosshair",
          opacity: signed ? 0.75 : 1,
        }}
        onPointerDown={start}
        onPointerMove={moveDraw}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
        {signed ? (
          <>
            <span style={{ fontSize: 14, color: "var(--fr-primary)", fontWeight: 650 }}>✓ Signature captured</span>
            <button type="button" onClick={clear} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13.5, textDecoration: "underline", color: "var(--fr-text)", opacity: 0.7 }}>
              Sign again
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={confirm}
              disabled={!hasInk || saving}
              style={{
                background: hasInk ? "var(--fr-primary)" : "var(--fr-line)",
                color: "var(--fr-button-text)",
                border: "none",
                borderRadius: 8,
                padding: "9px 16px",
                fontSize: 13.5,
                fontWeight: 650,
                cursor: hasInk ? "pointer" : "default",
                fontFamily: "inherit",
              }}
            >
              {saving ? "Saving…" : "Use this signature"}
            </button>
            {hasInk && (
              <button type="button" onClick={clear} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13.5, textDecoration: "underline", color: "var(--fr-text)", opacity: 0.7 }}>
                Clear
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export function QuestionInput(props: QuestionInputProps) {
  const { question } = props;
  switch (question.type) {
    case "short_text":
      return <TextLike {...props} type="text" />;
    case "email":
      return <TextLike {...props} type="email" />;
    case "phone":
      return <TextLike {...props} type="tel" />;
    case "url":
      return <TextLike {...props} type="text" />;
    case "number":
      return <TextLike {...props} type="number" />;
    case "address":
    case "long_text":
      return <LongText {...props} />;
    case "single_choice":
    case "multiple_choice":
      return <Choices {...props} />;
    case "picture_choice":
      return <PictureChoices {...props} />;
    case "dropdown":
      return <Dropdown {...props} />;
    case "yes_no":
      return <YesNo {...props} />;
    case "date":
      return <TextLike {...props} type="date" />;
    case "time":
      return <TextLike {...props} type="time" />;
    case "opinion_scale":
      return <OpinionScale {...props} />;
    case "star_rating":
      return <Stars {...props} />;
    case "ranking":
      return <Ranking {...props} />;
    case "consent":
      return <Consent {...props} />;
    case "file_upload":
      return <FileUpload {...props} />;
    case "signature":
      return <Signature {...props} />;
    case "statement":
      return null;
    default:
      return null;
  }
}
