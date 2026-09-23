"use client";

// Inline "add a solicitor" pop-up, opened from the log-a-chase drawer's "Who with"
// when a side has no solicitor on file yet. Reuses the standard SolicitorPicker
// (search an existing firm + handler, or create a new one) and saves it to the
// file as that side's solicitor via saveSolicitorsAction — so the user never
// leaves the page, and the new solicitor drops straight into the pills. The file's
// solicitor invariant requires a named case handler, so Save stays disabled until
// both a firm and a handler are chosen. See the enquiries round-4 drawer changes.

import { useState } from "react";
import { X } from "@phosphor-icons/react";
import { SolicitorPicker, type SolicitorSelection } from "@/components/solicitors/SolicitorPicker";
import { saveSolicitorsAction } from "@/app/actions/transactions";
import type { EnquiryParty } from "@/lib/services/enquiries";

export function AddSolicitorModal({
  transactionId,
  side,
  onAdded,
  onClose,
}: {
  transactionId: string;
  side: "vendor" | "purchaser";
  onAdded: (party: EnquiryParty) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<SolicitorSelection | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const sideLabel = side === "vendor" ? "seller's" : "buyer's";

  function requestClose() {
    if (saving || closing) return;
    setClosing(true);
    setTimeout(onClose, 180);
  }

  async function commit(sel: SolicitorSelection) {
    if (!sel.firmId || !sel.contactId) {
      setError("Add a case handler (name plus email or phone) to save this solicitor.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveSolicitorsAction(
        transactionId,
        side === "vendor"
          ? { vendorSolicitorFirmId: sel.firmId, vendorSolicitorContactId: sel.contactId }
          : { purchaserSolicitorFirmId: sel.firmId, purchaserSolicitorContactId: sel.contactId },
      );
      onAdded({ id: side === "vendor" ? "vsol" : "psol", label: sel.firmName, side, kind: "solicitor" });
      setClosing(true);
      setTimeout(onClose, 180);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
      setSaving(false);
    }
  }

  return (
    <div className={`enq-addsol-overlay${closing ? " is-closing" : ""}`} role="presentation" onClick={requestClose}>
      <div
        className={`enq-addsol${closing ? " is-closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Add the ${sideLabel} solicitor`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="enq-sheet-head">
          <div className="enq-sheet-headtext">
            <span className="enq-sheet-title">Add the {sideLabel} solicitor</span>
            <span className="enq-sheet-subtitle">Saved to the file too</span>
          </div>
          <button type="button" className="enq-sheet-x" aria-label="Close" onClick={requestClose}><X size={16} /></button>
        </div>

        <SolicitorPicker
          label=""
          value={draft}
          onChange={setDraft}
          // A brand-new firm+handler created via the picker's own modal → commit
          // straight away once it carries a handler; otherwise let them finish here.
          onFirmCreated={(sel) => { if (sel.contactId) commit(sel); }}
        />

        {error && <p className="enq-addsol-err">{error}</p>}

        <div className="enq-calllog-actions">
          <button type="button" className="enq-btn enq-btn-flip" disabled={saving} onClick={requestClose}>Cancel</button>
          <button
            type="button"
            className="enq-btn enq-btn-primary2"
            disabled={saving || !draft?.firmId || !draft?.contactId}
            onClick={() => draft && commit(draft)}
          >
            {saving ? "Saving…" : "Add solicitor"}
          </button>
        </div>
      </div>
    </div>
  );
}
