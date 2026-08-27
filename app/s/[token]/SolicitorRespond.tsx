"use client";

import { useState, useTransition } from "react";
import { solicitorConfirmStepAction, solicitorUpdateStepAction } from "./actions";

type Step = { id: string; code: string; label: string; expectedDate: string | null };
type Done = null | "confirmed" | "updated";

const NAVY = "#0f2740";
const BORDER = "#cdd8e6";

export function SolicitorRespond({ token, steps }: { token: string; steps: Step[] }) {
  const single = steps.length === 1;
  return (
    <div style={{ padding: "12px 0 18px" }}>
      {!single && (
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#33475b" }}>
          Please confirm where these {steps.length} steps stand:
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {steps.map((s) => (
          <StepCard key={s.id} token={token} step={s} emphasise={single} />
        ))}
      </div>
      <p style={{ margin: "16px 0 0", fontSize: 12, lineHeight: 1.55, color: "#8493a8" }}>
        Nothing here is binding; it simply keeps our file up to date so everyone can see progress.
      </p>
    </div>
  );
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

function StepCard({ token, step, emphasise }: { token: string; step: Step; emphasise: boolean }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Done>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(step.expectedDate ?? "");
  const [note, setNote] = useState("");
  // What the "updated" confirmation should say, captured at submit time.
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

  return (
    <div style={{ border: `1px solid ${BORDER}`, borderLeft: `4px solid ${NAVY}`, borderRadius: 6, padding: "13px 16px", background: "#ffffff" }}>
      <p style={{ margin: 0, fontSize: emphasise ? 15 : 14, fontWeight: 600, color: NAVY, lineHeight: 1.4 }}>
        {step.label}
      </p>

      {done ? (
        <p
          style={{ margin: "10px 0 0", fontSize: 13, color: "#2f7d4f", fontWeight: 600 }}
          dangerouslySetInnerHTML={{
            __html: done === "confirmed" ? "Confirmed as done. Thank you." : updatedMessage,
          }}
        />
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <button type="button" disabled={pending} onClick={confirm} style={primaryBtn(pending)}>
              {pending && !open ? "Saving…" : "Confirm this is done"}
            </button>
            <button type="button" disabled={pending} onClick={() => setOpen((o) => !o)} style={secondaryBtn}>
              {open ? "Close" : "Give an update"}
            </button>
          </div>

          {open && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Expected date <span style={{ color: "#8493a8", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Update <span style={{ color: "#8493a8", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
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
                  disabled={pending || (!date.trim() && !note.trim())}
                  onClick={sendUpdate}
                  style={{ ...primaryBtn(pending || (!date.trim() && !note.trim())), width: "auto", display: "inline-block" }}
                >
                  {pending ? "Sending…" : "Send update"}
                </button>
              </div>
            </div>
          )}

          {error && <p style={{ margin: "10px 0 0", fontSize: 13, color: "#c0392b" }}>{error}</p>}
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
    background: NAVY,
    color: "#ffffff",
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    padding: "11px 16px",
    borderRadius: 7,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}

const secondaryBtn: React.CSSProperties = {
  background: "#ffffff",
  color: NAVY,
  border: `1px solid ${BORDER}`,
  fontSize: 13,
  fontWeight: 600,
  padding: "11px 14px",
  borderRadius: 7,
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "#6b7c93",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  fontSize: 14,
  padding: "9px 11px",
  border: `1px solid ${BORDER}`,
  borderRadius: 7,
  color: NAVY,
  fontFamily: "inherit",
};
