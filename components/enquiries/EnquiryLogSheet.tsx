"use client";

// Log-a-chase sheet for the enquiries triage page. Captures who the chase was
// with, (for a call) the outcome, and a free note — then hands it back to the
// parent, which records the chase + mirrors it onto the file's activity feed.
//
// One component, two presentations: a centred popup over the row on desktop, and
// a drawer that slides up from the bottom on mobile / tablet (tapping the blurred
// backdrop, Cancel, or Esc slides it back down). Used for phone always, and for
// email when the agent's mailbox ingest isn't connected (so their sent email
// wouldn't be captured automatically). See critique #19a / #5 / #6.

import { useEffect, useState } from "react";
import { Phone, EnvelopeSimple, X } from "@phosphor-icons/react";
import type { EnquiryCallOutcome, EnquiryCallParty } from "@/app/actions/enquiries";

export function EnquiryLogSheet({
  mode,
  address,
  defaultParty,
  busy,
  onSubmit,
  onClose,
}: {
  mode: "phone" | "email";
  address: string;
  defaultParty: EnquiryCallParty;
  busy: boolean;
  onSubmit: (d: { outcome?: EnquiryCallOutcome; note?: string; withParty: EnquiryCallParty }) => void;
  onClose: () => void;
}) {
  const [party, setParty] = useState<EnquiryCallParty>(defaultParty);
  const [outcome, setOutcome] = useState<EnquiryCallOutcome>("spoke");
  const [note, setNote] = useState("");
  const [closing, setClosing] = useState(false);
  const isPhone = mode === "phone";

  // Play the exit (slide-down on mobile / fade on desktop) before unmounting.
  function requestClose() {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 220);
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit() {
    onSubmit({ withParty: party, note: note.trim() || undefined, outcome: isPhone ? outcome : undefined });
    requestClose();
  }

  return (
    <div
      className={`enq-sheet-overlay${closing ? " is-closing" : ""}`}
      role="presentation"
      onClick={requestClose}
    >
      <div
        className={`enq-sheet${closing ? " is-closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={isPhone ? "Log a call" : "Log an email"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="enq-sheet-head">
          <span className="enq-sheet-title">{isPhone ? "Log a call" : "Log an email"}</span>
          <button type="button" className="enq-sheet-x" aria-label="Close" onClick={requestClose}><X size={16} /></button>
        </div>
        <p className="enq-sheet-sub" data-sensitive="true">{address}</p>

        <div className="enq-calllog-field">
          <span className="enq-calllog-lbl">Who with</span>
          <div className="enq-seg">
            <button type="button" className={party === "seller_solicitor" ? "on" : ""} onClick={() => setParty("seller_solicitor")}>Seller&apos;s solicitor</button>
            <button type="button" className={party === "buyer_solicitor" ? "on" : ""} onClick={() => setParty("buyer_solicitor")}>Buyer&apos;s solicitor</button>
            <button type="button" className={party === "buyer" ? "on" : ""} onClick={() => setParty("buyer")}>Buyer</button>
          </div>
        </div>

        {isPhone && (
          <div className="enq-calllog-field">
            <span className="enq-calllog-lbl">Outcome</span>
            <div className="enq-seg">
              <button type="button" className={outcome === "spoke" ? "on" : ""} onClick={() => setOutcome("spoke")}>Spoke</button>
              <button type="button" className={outcome === "voicemail" ? "on" : ""} onClick={() => setOutcome("voicemail")}>Voicemail</button>
              <button type="button" className={outcome === "no_answer" ? "on" : ""} onClick={() => setOutcome("no_answer")}>No answer</button>
            </div>
          </div>
        )}

        <textarea
          className="enq-calllog-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isPhone ? "What was discussed? (optional)" : "What did you send? (optional)"}
          rows={3}
        />

        <div className="enq-calllog-actions">
          <button type="button" className="enq-btn enq-btn-flip" disabled={busy} onClick={requestClose}>Cancel</button>
          <button type="button" className="enq-btn enq-btn-primary2" disabled={busy} onClick={submit}>
            {isPhone ? <Phone size={13} weight="fill" /> : <EnvelopeSimple size={13} weight="fill" />}
            {isPhone ? " Log call" : " Log email"}
          </button>
        </div>
      </div>
    </div>
  );
}
