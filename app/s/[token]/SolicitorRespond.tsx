"use client";

import { useState, useTransition } from "react";
import { solicitorConfirmStepAction, solicitorUpdateStepAction } from "./actions";
import { S } from "./ui";

type Step = { id: string; code: string; label: string; expectedDate: string | null };
type Done = null | "confirmed" | "updated";

export function SolicitorRespond({ token, steps }: { token: string; steps: Step[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {steps.map((s) => (
        <StepCard key={s.id} token={token} step={s} />
      ))}
      <p style={{ margin: "4px 4px 0", fontSize: 12, lineHeight: 1.55, color: S.faint }}>
        Nothing here is binding; it simply keeps our file up to date so everyone can see progress.
      </p>
    </div>
  );
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

function StepCard({ token, step }: { token: string; step: Step }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Done>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(step.expectedDate ?? "");
  const [note, setNote] = useState("");
  const [savedDate, setSavedDate] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const [pending, start] = useTransition();

  function confirm() {
    setError(null);
    start(async () => {
      try {
        await solicitorConfirmStepAction(token, step.id);
        setDone("confirmed");
      } catch (e) {
        setError(errMsg(e));
      }
    });
  }

  function sendUpdate() {
    setError(null);
    const d = date.trim() ? date : null;
    const n = note;
    if (!d && !n.trim()) {
      setError("Please add a date or a short update.");
      return;
    }
    start(async () => {
      try {
        await solicitorUpdateStepAction(token, step.id, d, n);
        setSavedDate(d);
        setSavedNote(!!n.trim());
        setDone("updated");
        setOpen(false);
      } catch (e) {
        setError(errMsg(e));
      }
    });
  }

  const updatedMessage = (() => {
    const parts: string[] = [];
    if (savedDate) parts.push(`noted ${formatUk(savedDate)}`);
    if (savedNote) parts.push("passed your update on");
    return `Thank you. We&rsquo;ve ${parts.join(" and ")}.`;
  })();

  const noInput = !date.trim() && !note.trim();

  return (
    <div
      style={{
        background: S.card,
        border: `1px solid ${S.cardBorder}`,
        borderRadius: 14,
        boxShadow: S.cardShadow,
        padding: "16px 18px",
      }}
    >
      <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: S.ink, lineHeight: 1.4 }}>{step.label}</p>

      {done ? (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, background: S.successBg, borderRadius: 8, padding: "10px 12px" }}>
          <span style={{ color: S.success, fontSize: 14, fontWeight: 700 }}>✓</span>
          <p
            style={{ margin: 0, fontSize: 13, color: S.success, fontWeight: 600 }}
            dangerouslySetInnerHTML={{ __html: done === "confirmed" ? "Confirmed as done. Thank you." : updatedMessage }}
          />
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            <button type="button" disabled={pending} onClick={confirm} style={primaryBtn(pending && !open)}>
              {pending && !open ? "Saving…" : "Confirm this is done"}
            </button>
            <button type="button" disabled={pending} onClick={() => setOpen((o) => !o)} style={secondaryBtn(open)}>
              {open ? "Close" : "Give an update"}
            </button>
          </div>

          {open && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14, background: S.nested, border: `1px solid ${S.nestedBorder}`, borderRadius: 10, padding: 14 }}>
              <div>
                <label style={labelStyle}>
                  Expected date <span style={optional}>(optional)</span>
                </label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>
                  Update <span style={optional}>(optional)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="A short note on where this stands…"
                  style={{ ...inputStyle, width: "100%", resize: "vertical", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <button
                  type="button"
                  disabled={pending || noInput}
                  onClick={sendUpdate}
                  style={{ ...primaryBtn(pending || noInput), width: "auto", display: "inline-block" }}
                >
                  {pending ? "Sending…" : "Send update"}
                </button>
              </div>
            </div>
          )}

          {error && <p style={{ margin: "10px 0 0", fontSize: 13, color: S.danger }}>{error}</p>}
        </>
      )}
    </div>
  );
}

function formatUk(iso: string): string {
  if (!iso) return "the date";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    background: S.primary,
    color: "#ffffff",
    border: "none",
    fontSize: 13.5,
    fontWeight: 600,
    padding: "11px 18px",
    borderRadius: 9,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}

function secondaryBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? S.accentTint : "#ffffff",
    color: active ? S.accent : S.inkSoft,
    border: `1px solid ${active ? S.accentBorder : "#d5deea"}`,
    fontSize: 13.5,
    fontWeight: 600,
    padding: "11px 16px",
    borderRadius: 9,
    cursor: "pointer",
  };
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: S.muted,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
};

const optional: React.CSSProperties = { color: S.faint, fontWeight: 400, textTransform: "none", letterSpacing: 0 };

const inputStyle: React.CSSProperties = {
  fontSize: 14,
  padding: "10px 12px",
  border: `1px solid #d5deea`,
  borderRadius: 9,
  color: S.ink,
  fontFamily: "inherit",
  background: "#ffffff",
};
