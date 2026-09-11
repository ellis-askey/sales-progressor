"use client";

import { useState } from "react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { extractFirstName } from "@/lib/contacts/displayName";

export type MortgageChoice = {
  // true  → switch the buyer to mortgage-funded and open the mortgage steps.
  // false → keep them as a cash buyer, just re-open the mortgage steps.
  convertToMortgage: boolean;
  // Only meaningful when convertToMortgage is true: the offer's already in
  // place, so mark applied/valuation/offer complete now.
  offerAlreadyReceived: boolean;
};

interface MortgageModalProps {
  // The buyer's name(s), for the subtitle. Empty falls back to "The buyer".
  buyerNames?: string[];
  onConfirm: (choice: MortgageChoice) => void;
  onCancel: () => void;
}

// The buyer subject line: first names, joined naturally, with the matching verb.
function buyerLead(names: string[]): { subject: string; verb: string } {
  const firsts = names.map((n) => extractFirstName(n)).filter(Boolean);
  if (firsts.length === 0) return { subject: "The buyer", verb: "was" };
  if (firsts.length === 1) return { subject: firsts[0], verb: "was" };
  const joined =
    firsts.length === 2
      ? `${firsts[0]} and ${firsts[1]}`
      : `${firsts.slice(0, -1).join(", ")} and ${firsts[firsts.length - 1]}`;
  return { subject: joined, verb: "were" };
}

// The sign-up T&C tick, animated. Coral-deep box + white check that springs in.
function CheckTick({ on }: { on: boolean }) {
  return (
    <span className="mm-check" data-on={on ? "true" : undefined} aria-hidden>
      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}

// Radio dot: coral ring + filled dot that springs in when selected.
function RadioDot({ on }: { on: boolean }) {
  return (
    <span className="mm-radio" data-on={on ? "true" : undefined} aria-hidden>
      <span className="mm-radio-dot" />
    </span>
  );
}

export function MortgageModal({ buyerNames = [], onConfirm, onCancel }: MortgageModalProps) {
  const { theme, isNight } = usePortalTheme();
  const [convert, setConvert] = useState(true);
  const [offerReceived, setOfferReceived] = useState(false);

  const { subject, verb } = buyerLead(buyerNames);

  function handleContinue() {
    onConfirm({
      convertToMortgage: convert,
      offerAlreadyReceived: convert && offerReceived,
    });
  }

  return (
    <Modal
      open={true}
      onClose={onCancel}
      ariaLabel="Re-open mortgage steps"
      size="md"
      dismissOnBackdrop={false}
      closeTone="onDark"
    >
      <div
        data-theme={theme}
        data-night={isNight ? "" : undefined}
        className="nv2-night"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <Modal.Header style={SHEET_BAND_STYLE}>
          <SheetBandHeader
            title="Re-open mortgage steps?"
            subtitle={`${subject} ${verb} previously recorded as not using a mortgage.`}
          />
        </Modal.Header>

        <Modal.Body>
          <p style={{ fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.6, margin: "0 0 16px" }}>
            This opens the mortgage steps and updates the buyer&apos;s purchase type. Choose how you&apos;d like to proceed.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Option 1 — convert to mortgage (+ nested offer checkbox) */}
            <div className="mm-opt" data-on={convert ? "true" : undefined}>
              <button type="button" role="radio" aria-checked={convert} className="mm-opt-main" onClick={() => setConvert(true)}>
                <RadioDot on={convert} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>
                    Buyer is now using a mortgage
                  </span>
                  <span style={{ display: "block", fontSize: 13, color: "var(--agent-text-secondary)", marginTop: 3, lineHeight: 1.5 }}>
                    Update the buyer to mortgage-funded and open the mortgage steps.
                  </span>
                </span>
              </button>

              <label className="mm-check-row" data-muted={convert ? undefined : "true"}>
                <input
                  type="checkbox"
                  checked={convert && offerReceived}
                  onChange={(e) => { setConvert(true); setOfferReceived(e.target.checked); }}
                  style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                />
                <CheckTick on={convert && offerReceived} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                    Mortgage offer already received
                  </span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--agent-text-secondary)", marginTop: 2, lineHeight: 1.5 }}>
                    We&apos;ll mark the mortgage steps complete: applied, valuation and offer received.
                  </span>
                </span>
              </label>
            </div>

            {/* Option 2 — keep as cash buyer */}
            <div className="mm-opt" data-on={!convert ? "true" : undefined}>
              <button type="button" role="radio" aria-checked={!convert} className="mm-opt-main" onClick={() => setConvert(false)}>
                <RadioDot on={!convert} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>
                    Keep as cash buyer
                  </span>
                  <span style={{ display: "block", fontSize: 13, color: "var(--agent-text-secondary)", marginTop: 3, lineHeight: 1.5 }}>
                    Just open the mortgage steps, but keep their purchase type as it is.
                  </span>
                </span>
              </button>
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer style={{ padding: "14px 20px 20px", display: "flex", gap: 12, justifyContent: undefined }}>
          <button type="button" onClick={onCancel} className="agent-btn agent-btn-neutral agent-btn-md">
            Cancel
          </button>
          <button type="button" onClick={handleContinue} className="agent-btn agent-btn-primary agent-btn-md" style={{ flex: 1 }}>
            Continue
          </button>
        </Modal.Footer>
      </div>

      <style>{`
        .mm-opt {
          border: 1.5px solid var(--agent-border-default);
          border-radius: 14px;
          background: transparent;
          transition: border-color 160ms ease;
        }
        .mm-opt:hover { border-color: var(--agent-coral); }
        .mm-opt[data-on="true"], .mm-opt[data-on="true"]:hover { border-color: var(--agent-coral-deep); }
        .mm-opt-main {
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: transparent;
          border: none;
          text-align: left;
          cursor: pointer;
        }
        .mm-check-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          border-top: 1px solid var(--agent-border-default);
          cursor: pointer;
          position: relative;
        }
        .mm-check-row[data-muted="true"] { opacity: 0.5; }
        .mm-radio {
          flex-shrink: 0;
          width: 20px; height: 20px; margin-top: 1px;
          border-radius: 50%;
          border: 2px solid var(--agent-border-strong, rgba(15,23,42,0.28));
          display: grid; place-items: center;
          transition: border-color 150ms ease;
        }
        .mm-radio[data-on="true"] { border-color: var(--agent-coral-deep); }
        .mm-radio-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background: var(--agent-coral-deep);
          transform: scale(0); opacity: 0;
          transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 160ms ease;
        }
        .mm-radio[data-on="true"] .mm-radio-dot { transform: scale(1); opacity: 1; }
        .mm-check {
          flex-shrink: 0;
          width: 20px; height: 20px; margin-top: 1px;
          border-radius: 6px;
          border: 1.5px solid var(--agent-border-strong, rgba(15,23,42,0.28));
          background: transparent;
          display: grid; place-items: center;
          transition: background 160ms ease, border-color 160ms ease;
        }
        .mm-check[data-on="true"] { background: var(--agent-coral-deep); border-color: var(--agent-coral-deep); }
        .mm-check svg {
          opacity: 0; transform: scale(0.5);
          transition: opacity 160ms ease, transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .mm-check[data-on="true"] svg { opacity: 1; transform: scale(1); }
        @media (prefers-reduced-motion: reduce) {
          .mm-radio-dot, .mm-check svg { transition: opacity 120ms ease; }
        }
      `}</style>
    </Modal>
  );
}
