"use client";

import { useState, useTransition } from "react";
import {
  solicitorConfirmStepAction,
  solicitorSetExpectedDateAction,
  solicitorLeaveUpdateAction,
} from "./actions";

type Step = { id: string; code: string; label: string; expectedDate: string | null };
type Mode = null | "date" | "update";
type Done = null | "confirmed" | "date" | "update";

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

function StepCard({ token, step, emphasise }: { token: string; step: Step; emphasise: boolean }) {
  const [mode, setMode] = useState<Mode>(null);
  const [done, setDone] = useState<Done>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(step.expectedDate ?? "");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  function run(fn: () => Promise<unknown>, outcome: Exclude<Done, null>) {
    setError(null);
    start(async () => {
      try {
        await fn();
        setDone(outcome);
        setMode(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div style={{ border: `1px solid ${BORDER}`, borderLeft: `4px solid ${NAVY}`, borderRadius: 6, padding: "13px 16px", background: "#ffffff" }}>
      <p style={{ margin: 0, fontSize: emphasise ? 15 : 14, fontWeight: 600, color: NAVY, lineHeight: 1.4 }}>
        {step.label}
      </p>

      {done ? (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#2f7d4f", fontWeight: 600 }}>
          {done === "confirmed" && "Confirmed as done. Thank you."}
          {done === "date" && `Thank you. We've noted ${formatUk(date)}.`}
          {done === "update" && "Thank you. Your update has been passed on."}
        </p>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => solicitorConfirmStepAction(token, step.id), "confirmed")}
              style={primaryBtn(pending)}
            >
              {pending ? "Saving…" : "Confirm this is done"}
            </button>
            <button type="button" disabled={pending} onClick={() => setMode(mode === "date" ? null : "date")} style={secondaryBtn}>
              Give an expected date
            </button>
            <button type="button" disabled={pending} onClick={() => setMode(mode === "update" ? null : "update")} style={secondaryBtn}>
              Provide an update
            </button>
          </div>

          {mode === "date" && (
            <div style={{ marginTop: 12 }}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle}
              />
              <button
                type="button"
                disabled={pending || !date}
                onClick={() => run(() => solicitorSetExpectedDateAction(token, step.id, date), "date")}
                style={{ ...primaryBtn(pending || !date), marginLeft: 8, width: "auto", display: "inline-block" }}
              >
                Save date
              </button>
            </div>
          )}

          {mode === "update" && (
            <div style={{ marginTop: 12 }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="A short note on where this stands…"
                style={{ ...inputStyle, width: "100%", resize: "vertical", boxSizing: "border-box" }}
              />
              <button
                type="button"
                disabled={pending || !text.trim()}
                onClick={() => run(() => solicitorLeaveUpdateAction(token, step.id, text), "update")}
                style={{ ...primaryBtn(pending || !text.trim()), marginTop: 8, width: "auto", display: "inline-block" }}
              >
                Send update
              </button>
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

const inputStyle: React.CSSProperties = {
  fontSize: 14,
  padding: "9px 11px",
  border: `1px solid ${BORDER}`,
  borderRadius: 7,
  color: NAVY,
  fontFamily: "inherit",
};
