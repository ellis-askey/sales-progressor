"use client";

import { useState, useTransition } from "react";
import {
  solicitorEnquiriesSatisfiedAction,
  solicitorEnquiriesUpdateAction,
  solicitorEnquiriesExpectedDateAction,
} from "./actions";
import { S } from "./ui";

type Mode = null | "date" | "update";
type Done = null | "satisfied" | "date" | "update";

// The enquiries loop panel on the solicitor page. Shown whenever the file's
// enquiries stage is open, alongside (or instead of) the milestone steps. The
// buyer's solicitor can confirm all enquiries satisfied; either side can reply
// with an update or give an expected date. Skin matches SolicitorRespond.
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
    <div style={cardStyle}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: S.ink, lineHeight: 1.4 }}>Enquiries</p>
      <p style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.55, color: S.inkSoft }}>{courtLine}</p>
      {outstandingNote && (
        <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55, color: S.muted }}>Outstanding: {outstandingNote}</p>
      )}

      {done ? (
        <DoneBox>
          {done === "satisfied" && "Thank you. We've marked enquiries as satisfied."}
          {done === "date" && `Thank you. We've noted ${formatUk(date)} and won't chase before then.`}
          {done === "update" && "Thank you. Your update has been passed on."}
        </DoneBox>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {isBuyerSol && (
              <button type="button" disabled={pending} onClick={() => run(() => solicitorEnquiriesSatisfiedAction(token), "satisfied")} style={primaryBtn(pending)}>
                {pending ? "Saving…" : "Confirm all enquiries are satisfied"}
              </button>
            )}
            <button type="button" disabled={pending} onClick={() => setMode(mode === "update" ? null : "update")} style={secondaryBtn(mode === "update")}>
              Reply with an update
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
                onClick={() => run(() => solicitorEnquiriesExpectedDateAction(token, date), "date")}
                style={{ ...primaryBtn(pending || !date), marginLeft: 8, width: "auto", display: "inline-block" }}
              >
                Save date
              </button>
            </div>
          )}

          {mode === "update" && (
            <div style={revealStyle}>
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

          {error && <p style={{ margin: "10px 0 0", fontSize: 13, color: S.danger }}>{error}</p>}
        </>
      )}
    </div>
  );
}

// ── Shared skin (matches SolicitorRespond) ───────────────────────────────────

export function DoneBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, background: S.successBg, borderRadius: 8, padding: "10px 12px" }}>
      <span style={{ color: S.success, fontSize: 14, fontWeight: 700 }}>✓</span>
      <p style={{ margin: 0, fontSize: 13, color: S.success, fontWeight: 600 }}>{children}</p>
    </div>
  );
}

export function formatUk(iso: string): string {
  if (!iso) return "the date";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export const cardStyle: React.CSSProperties = {
  background: S.cardFrostBg,
  backdropFilter: S.cardFrostBlur,
  WebkitBackdropFilter: S.cardFrostBlur,
  border: `1px solid ${S.cardFrostBorder}`,
  borderRadius: 14,
  boxShadow: S.cardShadow,
  padding: "16px 18px",
};

export const revealStyle: React.CSSProperties = {
  marginTop: 14,
  background: S.nested,
  border: `1px solid ${S.nestedBorder}`,
  borderRadius: 10,
  padding: 14,
};

export function primaryBtn(disabled: boolean): React.CSSProperties {
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

export function secondaryBtn(active: boolean): React.CSSProperties {
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

export const inputStyle: React.CSSProperties = {
  fontSize: 14,
  padding: "10px 12px",
  border: `1px solid #d5deea`,
  borderRadius: 9,
  color: S.ink,
  fontFamily: "inherit",
  background: "#ffffff",
};
