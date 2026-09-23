"use client";

// Log-a-chase sheet for the enquiries triage page. Captures who the chase was
// with (the file's real parties — solicitor firms + each buyer/seller, titles
// stripped), the outcome (calls), and a note — then hands it back to the parent,
// which records the chase + mirrors it onto the file's activity feed.
//
// One component, two presentations: a centred popup over the row on desktop, and
// a drawer that slides up from the bottom on mobile / tablet (tapping the blurred
// backdrop, Cancel, or Esc slides it back down). Used for phone always, and for
// email when the agent's mailbox ingest isn't connected. See critique #19a / #5 /
// #6 and the round-2 drawer changes.

import { useEffect, useState } from "react";
import { Phone, EnvelopeSimple, X } from "@phosphor-icons/react";
import type { EnquiryCallOutcome } from "@/app/actions/enquiries";
import type { EnquiryParty } from "@/lib/services/enquiries";

function roleLabel(p: EnquiryParty): string {
  if (p.kind === "solicitor") return p.side === "vendor" ? "Seller's solicitor" : "Buyer's solicitor";
  return p.side === "vendor" ? "Seller" : "Buyer";
}

export function EnquiryLogSheet({
  mode,
  address,
  parties,
  defaultPartyId,
  busy,
  onSubmit,
  onClose,
}: {
  mode: "phone" | "email";
  address: string;
  parties: EnquiryParty[];
  defaultPartyId: string;
  busy: boolean;
  onSubmit: (d: { outcome?: EnquiryCallOutcome; note?: string; partyLabel: string; contactId?: string }) => void;
  onClose: () => void;
}) {
  const [partyId, setPartyId] = useState(() =>
    parties.some((p) => p.id === defaultPartyId) ? defaultPartyId : parties[0]?.id ?? "",
  );
  const [outcome, setOutcome] = useState<EnquiryCallOutcome>("spoke");
  const [note, setNote] = useState("");
  const [closing, setClosing] = useState(false);
  const isPhone = mode === "phone";
  const selected = parties.find((p) => p.id === partyId) ?? parties[0] ?? null;

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
    if (!selected) return;
    onSubmit({ outcome: isPhone ? outcome : undefined, note: note.trim() || undefined, partyLabel: selected.label, contactId: selected.contactId });
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
        <div className="enq-sheet-grip" aria-hidden />
        <div className="enq-sheet-head">
          <div className="enq-sheet-headtext">
            <span className="enq-sheet-title">{isPhone ? "Log a call" : "Log an email"}</span>
            <span className="enq-sheet-subtitle">Saved to this file&apos;s activity log too</span>
          </div>
          <button type="button" className="enq-sheet-x" aria-label="Close" onClick={requestClose}><X size={16} /></button>
        </div>
        <p className="enq-sheet-addr" data-sensitive="true">{address}</p>

        <div className="enq-calllog-field">
          <span className="enq-calllog-lbl">Who with</span>
          <div className="enq-seg">
            {parties.map((p) => (
              <button key={p.id} type="button" className={partyId === p.id ? "on" : ""} onClick={() => setPartyId(p.id)} title={roleLabel(p)}>
                {p.label}
              </button>
            ))}
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
          <button type="button" className="enq-btn enq-btn-primary2" disabled={busy || !selected} onClick={submit}>
            {isPhone ? <Phone size={13} weight="fill" /> : <EnvelopeSimple size={13} weight="fill" />}
            {isPhone ? " Log call" : " Log email"}
          </button>
        </div>
      </div>
    </div>
  );
}
