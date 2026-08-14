"use client";

import { useState, useTransition } from "react";
import { solicitorRaisedConfirmAction, solicitorRaisedExpectedDateAction } from "./actions";

type Done = null | "raised" | "date";

const NAVY = "#0f2740";
const BORDER = "#cdd8e6";

// Shown on the solicitor page when the file is still waiting on enquiries to be
// raised (an open raise-chase). The buyer's solicitor confirms they've raised
// them, or gives a date. Styling mirrors SolicitorEnquiries.
export function SolicitorRaisePanel({ token }: { token: string }) {
  const [mode, setMode] = useState<null | "date">(null);
  const [done, setDone] = useState<Done>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState("");
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
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: NAVY, lineHeight: 1.4 }}>Enquiries</p>
        <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55, color: "#33475b" }}>
          Have you been able to raise your enquiries with the seller's solicitor yet?
        </p>

        {done ? (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "#2f7d4f", fontWeight: 600 }}>
            {done === "raised" && "Thank you. We've noted that enquiries have been raised."}
            {done === "date" && `Thank you. We've noted ${formatUk(date)} and won't chase before then.`}
          </p>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => solicitorRaisedConfirmAction(token), "raised")}
                style={primaryBtn(pending)}
              >
                {pending ? "Saving…" : "Yes, they've been raised"}
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
                  onClick={() => run(() => solicitorRaisedExpectedDateAction(token, date), "date")}
                  style={{ ...primaryBtn(pending || !date), marginLeft: 8, width: "auto", display: "inline-block" }}
                >
                  Save date
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
    background: NAVY, color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600,
    padding: "11px 16px", borderRadius: 7, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1,
  };
}

const secondaryBtn: React.CSSProperties = {
  background: "#ffffff", color: NAVY, border: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 600,
  padding: "11px 14px", borderRadius: 7, cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  fontSize: 14, padding: "9px 11px", border: `1px solid ${BORDER}`, borderRadius: 7, color: NAVY, fontFamily: "inherit",
};
