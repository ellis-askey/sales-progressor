"use client";

// Respond-page list component. B5 (initial scaffold) + B7 (DIY/NUDGE
// branching, A2 in-place pill, hard-block per-code lookup).
//
// Branches on each item's who field:
//   - DIY    (who:"you")           — client themselves performs the action
//   - NUDGE  (who:"solicitor"|"lender") — third party owns it; client reports
//
// Button labels, modal prompts, and post-save feedback differ by tone per
// the locked surface-2 copy. Post-save feedback is rendered as an A2-style
// in-place pill: the row's content is replaced with a brief confirmation
// (~1.2s) before the row collapses out.
//
// Defence-in-depth: if a hard-block code (the six bilateral codes) somehow
// reaches a confirm action, the server action returns reason="agent_only"
// and we render the per-code explanation from PORTAL_AGENT_ONLY_COPY.

import { useState, useTransition } from "react";
import { P } from "./portal-ui";
import {
  portalConfirmFromRespondAction,
  portalSetExpectedDateAction,
  portalLeaveChaseNoteAction,
} from "@/app/actions/portal";
import { getPortalAgentOnlyCopy } from "@/lib/chase/portal-agent-only-copy";
import { extractFirstName } from "@/lib/contacts/displayName";

type Who = "you" | "solicitor" | "lender";

type Item = {
  milestoneCode: string;
  milestoneDefinitionId: string;
  label: string;
  description: string;
  expectedDate: string | null;
  who: Who;
};

type Props = {
  token: string;
  contactName: string;
  contactSide: "vendor" | "purchaser";
  propertyAddress: string;
  isOptedOut: boolean;
  items: Item[];
};

type PillState = { kind: "confirm" | "date" | "note"; text: string };

// "15 Jun" style. Always GMT-equivalent because the input is a YYYY-MM-DD
// from the date picker — no time component.
function formatDdMmm(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

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
  const [pillByCode, setPillByCode] = useState<Record<string, PillState>>({});
  const [doneFor, setDoneFor] = useState<string[]>([]);
  const [hardBlockByCode, setHardBlockByCode] = useState<Record<string, string>>({});
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

  // A2 in-place pill: hold for 1200ms, then collapse the row out.
  function flashPill(code: string, pill: PillState) {
    setPillByCode((prev) => ({ ...prev, [code]: pill }));
    close();
    setTimeout(() => {
      setDoneFor((prev) => [...prev, code]);
      setPillByCode((prev) => {
        const next = { ...prev };
        delete next[code];
        return next;
      });
    }, 1200);
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
          // Defence-in-depth: A6 + page-loader should have filtered. If we
          // still got here, look up the per-code explanation and render it
          // in place of the row controls.
          setHardBlockByCode((prev) => ({
            ...prev,
            [item.milestoneCode]: getPortalAgentOnlyCopy(item.milestoneCode),
          }));
          close();
        } else if (result.ok) {
          const text = item.who === "you"
            ? "Done. We won't ask again."
            : "Thanks. We'll stop asking about this.";
          flashPill(item.milestoneCode, { kind: "confirm", text });
        }
      } catch (e) {
        // Always show the friendly fallback — never expose the underlying
        // error text. In production, Next.js redacts thrown server-action
        // errors to a generic "Server Components render" string which would
        // confuse users; in dev it would surface internals. The actual error
        // is still available in server logs for debugging.
        console.error("[respond] confirm action threw:", e);
        setError("Something went wrong. Please try again, or get in touch with us if it keeps happening.");
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
        const text = `Got it. We'll wait until ${formatDdMmm(dateInput)} before asking again.`;
        flashPill(item.milestoneCode, { kind: "date", text });
      } catch (e) {
        // See note in handleConfirm — friendly fallback always; underlying
        // error in server logs.
        console.error("[respond] set-date action threw:", e);
        setError("Something went wrong. Please try again, or get in touch with us if it keeps happening.");
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
        flashPill(item.milestoneCode, { kind: "note", text: "Thanks. We've got it." });
      } catch (e) {
        // See note in handleConfirm — friendly fallback always.
        console.error("[respond] leave-note action threw:", e);
        setError("Something went wrong. Please try again, or get in touch with us if it keeps happening.");
      } finally {
        setSubmittingCode(null);
      }
    });
  }

  const remaining = items.filter((i) => !doneFor.includes(i.milestoneCode));

  // ─── Tone-based sub-heading (DIY / NUDGE / mixed) ─────────────────────
  function subHeading(): string {
    if (items.length === 0) return "";
    const hasDiy = items.some((i) => i.who === "you");
    const hasNudge = items.some((i) => i.who !== "you");
    const first = extractFirstName(contactName);
    if (hasDiy && hasNudge) {
      return `Hi ${first}, some of these are yours; the rest are sitting with other parties. Update us on whatever you can.`;
    }
    if (hasDiy) {
      return `Hi ${first}, these are yours to confirm or update us on.`;
    }
    // all NUDGE
    const parties = new Set(items.map((i) => i.who));
    const phrase = parties.has("solicitor") && parties.has("lender")
      ? "your solicitor or lender"
      : parties.has("lender") ? "your lender" : "your solicitor";
    return `Hi ${first}, these are sitting with ${phrase}. You don't need to do anything yourself, but if you've heard back, you can update us.`;
  }

  // ─── Empty state ──────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div style={{ padding: "32px 20px", maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: P.textPrimary, margin: 0 }}>
          Nothing waiting on you right now.
        </h1>
        <p style={{ fontSize: 15, color: P.textMuted, marginTop: 12, lineHeight: 1.6 }}>
          We&apos;ll email if anything new comes up on {propertyAddress.split(",")[0]}. In the meantime, you can close this page.
        </p>
      </div>
    );
  }

  // ─── All-done state (after submitting every visible item) ─────────────
  if (remaining.length === 0) {
    return (
      <div style={{ padding: "32px 20px", maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: P.textPrimary, margin: 0 }}>
          That&apos;s everything. Thanks for the update.
        </h1>
        <p style={{ fontSize: 15, color: P.textMuted, marginTop: 12, lineHeight: 1.6 }}>
          Got it. We&apos;ll be in touch when the next step is ready.
        </p>
      </div>
    );
  }

  // ─── List view ────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "24px 16px 48px", maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: P.textPrimary, margin: 0 }}>
        Updates on {propertyAddress.split(",")[0]}
      </h1>
      <p style={{ fontSize: 14, color: P.textMuted, marginTop: 10, marginBottom: 24, lineHeight: 1.6 }}>
        {subHeading()}
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
          You&apos;ve unsubscribed from these update reminders. You can still use this page if you want to. We just won&apos;t email you about items here unless you re-subscribe.
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
          const pill = pillByCode[item.milestoneCode];
          const hardBlock = hardBlockByCode[item.milestoneCode];
          const isDiy = item.who === "you";
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
              {pill ? (
                <p
                  style={{
                    fontSize: 14,
                    color: "#065f46",
                    background: "#d1fae5",
                    border: "0.5px solid #6ee7b7",
                    borderRadius: 8,
                    padding: "10px 14px",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {pill.text}
                </p>
              ) : hardBlock ? (
                <>
                  <p style={{ fontSize: 15, fontWeight: 600, color: P.textPrimary, margin: 0, lineHeight: 1.4 }}>
                    {item.label}
                  </p>
                  <p style={{ fontSize: 13, color: P.textMuted, margin: "8px 0 0", lineHeight: 1.5 }}>
                    {hardBlock}
                  </p>
                </>
              ) : (
                <>
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
                      You said around {formatDdMmm(item.expectedDate)} — has that changed?
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
                        {isDiy ? "Yes, this is done" : "Yes, this is already done"}
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
                        Tell us when
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
                            {isDiy ? "When did this happen? (optional)" : "When did you hear back? (optional)"}
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
                            {isDiy ? "When do you think this'll happen?" : "When are you expecting this?"}
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
                            Tell us what&apos;s happening:
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
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
