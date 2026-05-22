"use client";

// B5 of the client-chase arc — respond-page list component.
//
// Renders the currently-due milestones from B5's page loader. Each row has
// three controls: confirm / set-date / leave-note. Submits via the three
// actions in app/actions/portal.ts. Empty state for "all caught up."
//
// COPY STATUS: every user-facing string in this component is DRAFT pending
// the pre-B7 copy batch. House style: no em-dashes, calm tone.

import { useState, useTransition } from "react";
import { P } from "./portal-ui";
import {
  portalConfirmFromRespondAction,
  portalSetExpectedDateAction,
  portalLeaveChaseNoteAction,
} from "@/app/actions/portal";

type Item = {
  milestoneCode: string;
  milestoneDefinitionId: string;
  label: string;
  description: string;
  expectedDate: string | null;
};

type Props = {
  token: string;
  contactName: string;
  contactSide: "vendor" | "purchaser";
  propertyAddress: string;
  isOptedOut: boolean;
  items: Item[];
};

export function RespondList({
  token,
  contactName,
  propertyAddress,
  isOptedOut,
  items,
}: Props) {
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<"confirm" | "date" | "note" | null>(null);
  const [dateInput, setDateInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [submittingCode, setSubmittingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneFor, setDoneFor] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  function open(code: string, mode: "confirm" | "date" | "note") {
    setActiveItem(code);
    setActiveMode(mode);
    setDateInput("");
    setNoteInput("");
    setError(null);
  }
  function close() {
    setActiveItem(null);
    setActiveMode(null);
  }

  function handleConfirm(item: Item) {
    setSubmittingCode(item.milestoneCode);
    setError(null);
    startTransition(async () => {
      try {
        const result = await portalConfirmFromRespondAction({
          token,
          milestoneCode: item.milestoneCode,
          milestoneDefinitionId: item.milestoneDefinitionId,
          eventDate: dateInput || null,
        });
        if (!result.ok && result.reason === "agent_only") {
          // B1 hard-block — should never reach here because A6's exclude
          // list filters those codes out of the respond page. Defensive UX.
          setError("Your agent confirms this step. Nothing for you to do here.");
        } else if (result.ok) {
          setDoneFor((prev) => [...prev, item.milestoneCode]);
          close();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setSubmittingCode(null);
      }
    });
  }

  function handleSetDate(item: Item) {
    if (!dateInput) {
      setError("Please pick a date.");
      return;
    }
    setSubmittingCode(item.milestoneCode);
    setError(null);
    startTransition(async () => {
      try {
        await portalSetExpectedDateAction({
          token,
          milestoneCode: item.milestoneCode,
          milestoneDefinitionId: item.milestoneDefinitionId,
          expectedDate: dateInput,
        });
        setDoneFor((prev) => [...prev, item.milestoneCode]);
        close();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setSubmittingCode(null);
      }
    });
  }

  function handleNote(item: Item) {
    if (!noteInput.trim()) {
      setError("Please type something first.");
      return;
    }
    setSubmittingCode(item.milestoneCode);
    setError(null);
    startTransition(async () => {
      try {
        await portalLeaveChaseNoteAction({
          token,
          milestoneCode: item.milestoneCode,
          note: noteInput,
        });
        setDoneFor((prev) => [...prev, item.milestoneCode]);
        close();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setSubmittingCode(null);
      }
    });
  }

  const remaining = items.filter((i) => !doneFor.includes(i.milestoneCode));

  // ─── Empty state ──────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div style={{ padding: "32px 20px", maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: P.textPrimary, margin: 0 }}>
          You&apos;re all caught up
        </h1>
        <p style={{ fontSize: 15, color: P.textMuted, marginTop: 12, lineHeight: 1.6 }}>
          Nothing on {propertyAddress.split(",")[0]} is waiting for your update right now.
          We&apos;ll send you another email if anything new comes up.
        </p>
      </div>
    );
  }

  // ─── All-done state (after submitting every visible item) ─────────────────
  if (remaining.length === 0) {
    return (
      <div style={{ padding: "32px 20px", maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: P.textPrimary, margin: 0 }}>
          Thanks. Everyone&apos;s updated.
        </h1>
        <p style={{ fontSize: 15, color: P.textMuted, marginTop: 12, lineHeight: 1.6 }}>
          We&apos;ve passed your update on to your agent. You can close this page.
        </p>
      </div>
    );
  }

  // ─── List view ────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "24px 16px 48px", maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: P.textPrimary, margin: 0 }}>
        Quick update on {propertyAddress.split(",")[0]}
      </h1>
      <p style={{ fontSize: 14, color: P.textMuted, marginTop: 10, marginBottom: 24, lineHeight: 1.6 }}>
        Hi {contactName.split(" ")[0]}, a few things are waiting for your input. Pick what fits each one.
      </p>

      {isOptedOut && (
        <div
          style={{
            marginBottom: 20,
            padding: "10px 14px",
            background: "#fef3c7",
            border: "0.5px solid #fcd34d",
            borderRadius: 8,
            fontSize: 13,
            color: "#92400e",
            lineHeight: 1.5,
          }}
        >
          You unsubscribed from these chase emails. You can still use this page anytime; we just won&apos;t email you again unless you re-subscribe.
        </div>
      )}

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            background: "#fee2e2",
            border: "0.5px solid #fecaca",
            borderRadius: 8,
            fontSize: 13,
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {remaining.map((item) => {
          const isExpanded = activeItem === item.milestoneCode;
          const isSubmitting = submittingCode === item.milestoneCode;
          return (
            <div
              key={item.milestoneCode}
              style={{
                background: "white",
                border: `0.5px solid ${P.border}`,
                borderRadius: 12,
                padding: "16px 18px",
              }}
            >
              <p style={{ fontSize: 15, fontWeight: 600, color: P.textPrimary, margin: 0, lineHeight: 1.4 }}>
                {item.label}
              </p>
              {item.description && (
                <p style={{ fontSize: 13, color: P.textMuted, margin: "6px 0 0", lineHeight: 1.5 }}>
                  {item.description}
                </p>
              )}
              {item.expectedDate && (
                <p style={{ fontSize: 12, color: P.textMuted, margin: "8px 0 0", fontStyle: "italic" }}>
                  You previously said: around{" "}
                  {new Date(item.expectedDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
                </p>
              )}

              {/* Controls */}
              {!isExpanded ? (
                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                  <button
                    onClick={() => open(item.milestoneCode, "confirm")}
                    disabled={isSubmitting}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      background: P.primaryBg,
                      color: P.primaryText,
                      fontSize: 13,
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Yes, this is done
                  </button>
                  <button
                    onClick={() => open(item.milestoneCode, "date")}
                    disabled={isSubmitting}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      background: "transparent",
                      color: P.textPrimary,
                      fontSize: 13,
                      fontWeight: 500,
                      border: `0.5px solid ${P.border}`,
                      cursor: "pointer",
                    }}
                  >
                    Set a date
                  </button>
                  <button
                    onClick={() => open(item.milestoneCode, "note")}
                    disabled={isSubmitting}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      background: "transparent",
                      color: P.textPrimary,
                      fontSize: 13,
                      fontWeight: 500,
                      border: `0.5px solid ${P.border}`,
                      cursor: "pointer",
                    }}
                  >
                    Leave a note
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 14 }}>
                  {activeMode === "confirm" && (
                    <>
                      <p style={{ fontSize: 13, color: P.textMuted, margin: "0 0 10px", lineHeight: 1.5 }}>
                        When did this happen? (optional)
                      </p>
                      <input
                        type="date"
                        value={dateInput}
                        onChange={(e) => setDateInput(e.target.value)}
                        style={{
                          fontSize: 14,
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: `0.5px solid ${P.border}`,
                          width: "100%",
                          marginBottom: 12,
                        }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => handleConfirm(item)}
                          disabled={isSubmitting}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            background: P.primaryBg,
                            color: P.primaryText,
                            fontSize: 13,
                            fontWeight: 600,
                            border: "none",
                            cursor: isSubmitting ? "wait" : "pointer",
                            opacity: isSubmitting ? 0.6 : 1,
                          }}
                        >
                          {isSubmitting ? "Saving..." : "Confirm"}
                        </button>
                        <button
                          onClick={close}
                          disabled={isSubmitting}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            background: "transparent",
                            color: P.textMuted,
                            fontSize: 13,
                            fontWeight: 500,
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}

                  {activeMode === "date" && (
                    <>
                      <p style={{ fontSize: 13, color: P.textMuted, margin: "0 0 10px", lineHeight: 1.5 }}>
                        When do you think this will happen?
                      </p>
                      <input
                        type="date"
                        value={dateInput}
                        onChange={(e) => setDateInput(e.target.value)}
                        style={{
                          fontSize: 14,
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: `0.5px solid ${P.border}`,
                          width: "100%",
                          marginBottom: 12,
                        }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => handleSetDate(item)}
                          disabled={isSubmitting || !dateInput}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            background: P.primaryBg,
                            color: P.primaryText,
                            fontSize: 13,
                            fontWeight: 600,
                            border: "none",
                            cursor: isSubmitting ? "wait" : "pointer",
                            opacity: isSubmitting || !dateInput ? 0.6 : 1,
                          }}
                        >
                          {isSubmitting ? "Saving..." : "Save date"}
                        </button>
                        <button
                          onClick={close}
                          disabled={isSubmitting}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            background: "transparent",
                            color: P.textMuted,
                            fontSize: 13,
                            fontWeight: 500,
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}

                  {activeMode === "note" && (
                    <>
                      <p style={{ fontSize: 13, color: P.textMuted, margin: "0 0 10px", lineHeight: 1.5 }}>
                        Tell your agent what&apos;s happening:
                      </p>
                      <textarea
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        rows={3}
                        placeholder="Anything they should know..."
                        style={{
                          fontSize: 14,
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: `0.5px solid ${P.border}`,
                          width: "100%",
                          marginBottom: 12,
                          resize: "vertical",
                          fontFamily: "inherit",
                        }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => handleNote(item)}
                          disabled={isSubmitting || !noteInput.trim()}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            background: P.primaryBg,
                            color: P.primaryText,
                            fontSize: 13,
                            fontWeight: 600,
                            border: "none",
                            cursor: isSubmitting ? "wait" : "pointer",
                            opacity: isSubmitting || !noteInput.trim() ? 0.6 : 1,
                          }}
                        >
                          {isSubmitting ? "Sending..." : "Send to agent"}
                        </button>
                        <button
                          onClick={close}
                          disabled={isSubmitting}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            background: "transparent",
                            color: P.textMuted,
                            fontSize: 13,
                            fontWeight: 500,
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
