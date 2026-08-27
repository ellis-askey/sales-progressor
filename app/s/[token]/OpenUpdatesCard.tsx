"use client";

import { useState, useTransition } from "react";
import { FileText } from "@phosphor-icons/react/dist/ssr";
import { solicitorConfirmStepAction, solicitorUpdateStepAction } from "./actions";
import { S } from "./ui";

type Step = { id: string; code: string; label: string; expectedDate: string | null };
type Done = null | "confirmed" | "updated";

// Contextual primary-button wording (Ellis: the phrasing depends on the step).
// Receipt-type steps read "Mark as received"; others read "Mark as done".
function primaryLabel(label: string): string {
  return /(receiv|return|replies|pack|report|offer|issued|back)/i.test(label) ? "Mark as received" : "Mark as done";
}

function fmtUk(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function OpenUpdatesCard({ token, steps }: { token: string; steps: Step[] }) {
  return (
    <div style={{ background: S.card, border: `1px solid ${S.cardBorder}`, borderRadius: S.radiusMd, boxShadow: S.shadowCard, padding: "18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: S.muted }}>Open updates</p>
        <span style={{ fontSize: 11, fontWeight: 700, color: S.accent, background: S.accentBg, borderRadius: 999, padding: "1px 8px", minWidth: 20, textAlign: "center" }}>{steps.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((s) => (
          <UpdateRow key={s.id} token={token} step={s} />
        ))}
      </div>
      <p style={{ margin: "14px 2px 0", fontSize: 12, lineHeight: 1.55, color: S.faint }}>
        Nothing here is binding; it simply keeps our file up to date so everyone can see progress.
      </p>
    </div>
  );
}

function UpdateRow({ token, step }: { token: string; step: Step }) {
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
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    });
  }

  function sendUpdate() {
    setError(null);
    const d = date.trim() ? date : null;
    if (!d && !note.trim()) {
      setError("Please add a date or a short update.");
      return;
    }
    start(async () => {
      try {
        await solicitorUpdateStepAction(token, step.id, d, note);
        setSavedDate(d);
        setSavedNote(!!note.trim());
        setDone("updated");
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    });
  }

  const noInput = !date.trim() && !note.trim();

  return (
    <div style={{ border: `1px solid ${S.nestedBorder}`, borderRadius: 12, padding: "13px 14px", background: "#ffffff" }}>
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: S.accentBg, color: S.accent, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <FileText size={17} weight="regular" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: S.ink, lineHeight: 1.35 }}>{step.label}</p>
          {step.expectedDate && !done && (
            <p style={{ margin: "2px 0 0", fontSize: 12, color: S.muted }}>Expected by {fmtUk(step.expectedDate)}</p>
          )}
        </div>
      </div>

      {done ? (
        <div style={{ marginTop: 11, display: "flex", alignItems: "center", gap: 8, background: S.successBg, borderRadius: 8, padding: "9px 12px" }}>
          <span style={{ color: S.success, fontWeight: 700, fontSize: 14 }}>✓</span>
          <p style={{ margin: 0, fontSize: 13, color: S.success, fontWeight: 600 }}>
            {done === "confirmed"
              ? "Confirmed. Thank you."
              : `Thank you. We've ${[savedDate ? `noted ${fmtUk(savedDate)}` : null, savedNote ? "passed your update on" : null].filter(Boolean).join(" and ")}.`}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <button type="button" disabled={pending} onClick={confirm} style={primaryBtn(pending && !open)}>
              {pending && !open ? "Saving…" : primaryLabel(step.label)}
            </button>
            <button type="button" disabled={pending} onClick={() => setOpen((o) => !o)} style={secondaryBtn(open)}>
              {open ? "Close" : "Add update"}
            </button>
          </div>

          {open && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12, background: S.nested, border: `1px solid ${S.nestedBorder}`, borderRadius: 10, padding: 13 }}>
              <div>
                <label style={labelStyle}>Expected date <span style={optional}>(optional)</span></label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Update <span style={optional}>(optional)</span></label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="A short note on where this stands…" style={{ ...inputStyle, width: "100%", resize: "vertical", boxSizing: "border-box" }} />
              </div>
              <div>
                <button type="button" disabled={pending || noInput} onClick={sendUpdate} style={{ ...primaryBtn(pending || noInput), width: "auto", display: "inline-block" }}>
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

function primaryBtn(disabled: boolean): React.CSSProperties {
  return { background: S.primary, color: "#fff", border: "none", fontSize: 13.5, fontWeight: 600, padding: "10px 16px", borderRadius: 9, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 };
}
function secondaryBtn(active: boolean): React.CSSProperties {
  return { background: active ? S.accentTint : "#fff", color: active ? S.accent : S.inkSoft, border: `1px solid ${active ? S.accentBorder : "#d5deea"}`, fontSize: 13.5, fontWeight: 600, padding: "10px 14px", borderRadius: 9, cursor: "pointer" };
}
const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: S.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 };
const optional: React.CSSProperties = { color: S.faint, fontWeight: 400, textTransform: "none", letterSpacing: 0 };
const inputStyle: React.CSSProperties = { fontSize: 14, padding: "10px 12px", border: "1px solid #d5deea", borderRadius: 9, color: S.ink, fontFamily: "inherit", background: "#fff" };
