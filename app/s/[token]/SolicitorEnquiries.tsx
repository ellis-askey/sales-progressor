"use client";

import { useState, useTransition } from "react";
import {
  solicitorEnquiriesSatisfiedAction,
  solicitorEnquiriesUpdateAction,
  solicitorEnquiriesExpectedDateAction,
} from "./actions";

type Mode = null | "date" | "update";
type Done = null | "satisfied" | "date" | "update";

const NAVY = "#0f2740";
const BORDER = "#cdd8e6";

// The enquiries loop panel on the solicitor page. Shown whenever the file's
// enquiries stage is open, alongside (or instead of) the milestone steps. The
// buyer's solicitor can confirm all enquiries satisfied; either side can reply
// with an update or give an expected date. Styling mirrors SolicitorRespond.
export function SolicitorEnquiries({
  token,
  side,
  courtLine,
  outstandingNote,
}: {
  token: string;
  side: "vendor" | "purchaser";
  courtLine: string;
  outstandingNote: string | null;
}) {
  const isBuyerSol = side === "purchaser";
  const [mode, setMode] = useState<Mode>(null);
  const [done, setDone] = useState<Done>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState("");
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
    <div style={{ background: "#ffffff", borderLeft: "1px solid #dfe5ec", borderRight: "1px solid #dfe5ec", padding: "8px 26px 4px" }}>
      <div style={{ border: `1px solid ${BORDER}`, borderLeft: `4px solid ${NAVY}`, borderRadius: 6, padding: "13px 16px", background: "#ffffff" }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: NAVY, lineHeight: 1.4 }}>
          Enquiries
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55, color: "#33475b" }}>
          {courtLine}
        </p>
        {outstandingNote && (
          <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55, color: "#6b7c93" }}>
            Outstanding: {outstandingNote}
          </p>
        )}

        {done ? (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "#2f7d4f", fontWeight: 600 }}>
            {done === "satisfied" && "Thank you. We've marked enquiries as satisfied."}
            {done === "date" && `Thank you. We've noted ${formatUk(date)} and won't chase before then.`}
            {done === "update" && "Thank you. Your update has been passed on."}
          </p>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {isBuyerSol && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => solicitorEnquiriesSatisfiedAction(token), "satisfied")}
                  style={primaryBtn(pending)}
                >
                  {pending ? "Saving…" : "Confirm all enquiries are satisfied"}
                </button>
              )}
              <button type="button" disabled={pending} onClick={() => setMode(mode === "update" ? null : "update")} style={secondaryBtn}>
                Reply with an update
              </button>
              <button type="button" disabled={pending} onClick={() => setMode(mode === "date" ? null : "date")} style={secondaryBtn}>
                Give an expected date
              </button>
            </div>

            {mode === "date" && (
              <div style={{ marginTop: 12 }}>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
                <button
                  type="button"
                  disabled={pending || !date}
                  onClick={() => run(() => solicitorEnquiriesExpectedDateAction(token, date), "date")}
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
                  placeholder="A short note on where the enquiries stand…"
                  style={{ ...inputStyle, width: "100%", resize: "vertical", boxSizing: "border-box" }}
                />
                <button
                  type="button"
                  disabled={pending || !text.trim()}
                  onClick={() => run(() => solicitorEnquiriesUpdateAction(token, text), "update")}
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
