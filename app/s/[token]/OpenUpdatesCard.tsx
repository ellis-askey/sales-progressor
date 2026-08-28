"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { FileText, CalendarBlank, X } from "@phosphor-icons/react/dist/ssr";
import { PortalGlassCard } from "@/components/portal/PortalGlassCard";
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
    <PortalGlassCard glassId="sol-open-updates" label="Open updates" defaultVariant="v03" radius={16} style={{ padding: "18px" }}>
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
    </PortalGlassCard>
  );
}

function UpdateRow({ token, step }: { token: string; step: Step }) {
  const [open, setOpen] = useState(false);       // add-update drawer mounted
  const [entered, setEntered] = useState(false); // drawer slid up
  const [done, setDone] = useState<Done>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(step.expectedDate ?? "");
  const [note, setNote] = useState("");
  const [savedDate, setSavedDate] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const [pending, start] = useTransition();

  function openDrawer() {
    setError(null);
    setOpen(true);
    requestAnimationFrame(() => setEntered(true));
  }
  function closeDrawer() {
    setEntered(false);
    setTimeout(() => setOpen(false), 260);
  }

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
        closeDrawer();
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
            <button type="button" className="pbtn pbtn-press" disabled={pending} onClick={confirm} style={primaryBtn(pending)}>
              {pending ? "Saving…" : primaryLabel(step.label)}
            </button>
            <button type="button" className="pbtn pbtn-press" disabled={pending} onClick={openDrawer} style={secondaryBtn(open)}>
              Add update
            </button>
          </div>
          {error && !open && <p style={{ margin: "10px 0 0", fontSize: 13, color: S.danger }}>{error}</p>}
        </>
      )}

      {open && (
        <AddUpdateDrawer
          entered={entered}
          stepLabel={step.label}
          date={date}
          note={note}
          pending={pending}
          error={error}
          noInput={noInput}
          onDate={(v) => setDate(v)}
          onNote={(v) => setNote(v)}
          onSend={sendUpdate}
          onClose={closeDrawer}
        />
      )}
    </div>
  );
}

// The "Add update" bottom sheet — slides up/down like the menu, one per step.
function AddUpdateDrawer({
  entered, stepLabel, date, note, pending, error, noInput, onDate, onNote, onSend, onClose,
}: {
  entered: boolean;
  stepLabel: string;
  date: string;
  note: string;
  pending: boolean;
  error: string | null;
  noInput: boolean;
  onDate: (v: string) => void;
  onNote: (v: string) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  // Portal to the .portal-scope root so the sheet escapes the glass card's
  // containing block (PortalGlassCard's backdrop-filter otherwise traps a
  // position:fixed child inside the card, per the reported bug). Staying inside
  // .portal-scope keeps the reduced-motion CSS applying to it.
  const [host] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" ? ((document.querySelector(".portal-scope") as HTMLElement) ?? document.body) : null,
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!host) return null;

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(9,20,40,0.34)", backdropFilter: "blur(3px)", opacity: entered ? 1 : 0, transition: "opacity 240ms ease" }} />
      <div
        role="dialog"
        aria-label="Add an update"
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 51,
          maxWidth: 620, margin: "0 auto", background: S.card,
          borderRadius: "20px 20px 0 0", boxShadow: "0 -10px 34px rgba(9,20,40,0.18)",
          padding: "10px 18px calc(20px + env(safe-area-inset-bottom))",
          transform: entered ? "translateY(0)" : "translateY(100%)",
          transition: "transform 300ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(15,39,64,0.14)", margin: "4px auto 10px" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: S.ink }}>Add an update</p>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: S.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stepLabel}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: S.muted, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={16} weight="bold" />
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>Expected date <span style={optional}>(optional)</span></label>
          <DateField value={date} onChange={onDate} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Update <span style={optional}>(optional)</span></label>
          <textarea value={note} onChange={(e) => onNote(e.target.value)} rows={3} placeholder="A short note on where this stands…" style={{ ...inputStyle, width: "100%", resize: "vertical", boxSizing: "border-box" }} />
        </div>

        {error && <p style={{ margin: "10px 0 0", fontSize: 13, color: S.danger }}>{error}</p>}

        <button type="button" className="pbtn pbtn-press" disabled={pending || noInput} onClick={onSend} style={{ ...primaryBtn(pending || noInput), width: "100%", marginTop: 14 }}>
          {pending ? "Sending…" : "Send update"}
        </button>
      </div>
    </>,
    host,
  );
}

// Date field with a calendar icon on the left and a real placeholder (native
// date inputs show an empty box otherwise). The input text is transparent while
// empty so the browser's own format hint doesn't clash with our placeholder.
function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: S.muted, pointerEvents: "none", display: "inline-flex" }}>
        <CalendarBlank size={16} weight="regular" />
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, width: "100%", boxSizing: "border-box", paddingLeft: 38, color: value ? S.ink : "transparent" }}
      />
      {!value && (
        <span style={{ position: "absolute", left: 38, top: "50%", transform: "translateY(-50%)", color: S.faint, pointerEvents: "none", fontSize: 14 }}>
          Select a date
        </span>
      )}
    </div>
  );
}

// Shape + press-down borrowed from the client portal's PortalButton (sm), kept in
// the solicitor blue rather than coral. The .pbtn/.pbtn-press classes carry the
// tactile scale-on-press (globals.css); this owns the colour and sizing.
function primaryBtn(disabled: boolean): React.CSSProperties {
  return { background: S.primary, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", padding: "8px 15px", borderRadius: 11, boxShadow: "0 1px 2px rgba(23,58,128,0.28), 0 6px 16px -6px rgba(23,58,128,0.5)", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 };
}
function secondaryBtn(active: boolean): React.CSSProperties {
  return { background: active ? S.accentTint : "#fff", color: active ? S.accent : S.inkSoft, border: `1px solid ${active ? S.accentBorder : "#d5deea"}`, fontSize: 13, fontWeight: 700, padding: "8px 15px", borderRadius: 11, cursor: "pointer" };
}
const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: S.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 };
const optional: React.CSSProperties = { color: S.faint, fontWeight: 400, textTransform: "none", letterSpacing: 0 };
// Softer fill than pure white so the field reads as an input on the white drawer.
const inputStyle: React.CSSProperties = { fontSize: 14, padding: "10px 12px", border: "1px solid #d9e2ef", borderRadius: 9, color: S.ink, fontFamily: "inherit", background: "#eef3fb" };
