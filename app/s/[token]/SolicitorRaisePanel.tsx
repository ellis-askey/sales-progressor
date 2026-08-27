"use client";

import { useState, useTransition } from "react";
import { solicitorRaisedConfirmAction, solicitorRaisedExpectedDateAction } from "./actions";
import { S } from "./ui";
import { DoneBox, formatUk, cardStyle, revealStyle, primaryBtn, secondaryBtn, inputStyle } from "./SolicitorEnquiries";

type Done = null | "raised" | "date";

// Shown on the solicitor page when the file is still waiting on enquiries to be
// raised (an open raise-chase). The buyer's solicitor confirms they've raised
// them, or gives a date. Skin matches SolicitorEnquiries / SolicitorRespond.
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
    <div style={cardStyle}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: S.ink, lineHeight: 1.4 }}>Enquiries</p>
      <p style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.55, color: S.inkSoft }}>
        Have you been able to raise your enquiries with the seller&rsquo;s solicitor yet?
      </p>

      {done ? (
        <DoneBox>
          {done === "raised" && "Thank you. We've noted that enquiries have been raised."}
          {done === "date" && `Thank you. We've noted ${formatUk(date)} and won't chase before then.`}
        </DoneBox>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            <button type="button" disabled={pending} onClick={() => run(() => solicitorRaisedConfirmAction(token), "raised")} style={primaryBtn(pending)}>
              {pending ? "Saving…" : "Yes, they've been raised"}
            </button>
            <button type="button" disabled={pending} onClick={() => setMode(mode === "date" ? null : "date")} style={secondaryBtn(mode === "date")}>
              Give an expected date
            </button>
          </div>

          {mode === "date" && (
            <div style={revealStyle}>
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

          {error && <p style={{ margin: "10px 0 0", fontSize: 13, color: S.danger }}>{error}</p>}
        </>
      )}
    </div>
  );
}
