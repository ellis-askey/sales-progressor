"use client";

// "Email the surveyor" launcher (critique #211). A quick pick of who's providing
// access, then it opens the composer pre-filled — To the surveyor, Cc the buyer,
// access details written from the file — for a final read, edit, and send or
// schedule. Saves WhatsApping the buyer and surveyor separately.

import { useEffect, useState } from "react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { ComposeEmailModal, type ComposePrefill } from "@/components/compose/ComposeEmailModal";
import { buildSurveyorEmailDraft, type SurveyAccessChoice } from "@/app/actions/survey-email";

const ACCESS_OPTIONS: { value: SurveyAccessChoice; label: string }[] = [
  { value: "seller", label: "Seller will be there" },
  { value: "keys", label: "Keys from our branch" },
  { value: "buyer", label: "Buyer will be there" },
  { value: "other", label: "Other" },
];

export function SurveyEmailModal({
  transactionId,
  open,
  onClose,
}: {
  transactionId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { theme, isNight } = usePortalTheme();
  const [access, setAccess] = useState<SurveyAccessChoice>("seller");
  const [otherNote, setOtherNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<ComposePrefill | null>(null);

  useEffect(() => {
    if (open) { setAccess("seller"); setOtherNote(""); setError(null); setLoading(false); setPrefill(null); }
  }, [open]);

  async function compose() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await buildSurveyorEmailDraft(transactionId, access, access === "other" ? otherNote : null);
      if (r.ok) setPrefill(r.draft);
      else setError(r.error);
    } catch {
      setError("Couldn't build the email. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // Once we have a draft, hand straight off to the composer (pre-filled). Closing
  // the composer closes the whole flow.
  if (prefill) {
    return <ComposeEmailModal open onClose={() => { setPrefill(null); onClose(); }} prefill={prefill} />;
  }

  if (!open) return null;

  return (
    <Modal open onClose={onClose} ariaLabel="Email the surveyor" size="sm" dismissOnBackdrop={false} showCloseButton={false} closeTone="onDark">
      <div
        data-theme={theme}
        data-night={isNight ? "" : undefined}
        className="nv2-night"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <Modal.Header style={SHEET_BAND_STYLE}>
          <SheetBandHeader title="Email the surveyor" subtitle="We'll pre-fill it and copy in the buyer. You can edit before sending." />
        </Modal.Header>

        <Modal.Body>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 8 }}>
                Who&apos;s providing access?
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {ACCESS_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className="sve-opt"
                    data-on={access === o.value ? "true" : undefined}
                    onClick={() => setAccess(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {access === "other" && (
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 6 }}>
                  Access details <span style={{ color: "var(--agent-text-muted)", fontWeight: 400 }}>(goes into the email)</span>
                </label>
                <input
                  type="text"
                  value={otherNote}
                  onChange={(e) => setOtherNote(e.target.value)}
                  placeholder="e.g. the tenant, Sam, will let you in"
                  className="sve-input"
                />
              </div>
            )}

            {error && <p style={{ fontSize: 12.5, color: "var(--agent-danger, #dc2626)", margin: 0 }}>{error}</p>}
          </div>
        </Modal.Body>

        <Modal.Footer style={{ padding: "16px 20px 20px", gap: 12, justifyContent: undefined }}>
          <button type="button" onClick={onClose} className="agent-btn agent-btn-neutral agent-btn-md">
            Cancel
          </button>
          <button
            type="button"
            onClick={compose}
            disabled={loading}
            className="agent-btn agent-btn-primary agent-btn-md"
            style={{ flex: 1 }}
          >
            {loading ? "Preparing…" : "Compose email"}
          </button>
        </Modal.Footer>
      </div>

      <style>{`
        .sve-opt {
          width: 100%; text-align: center;
          padding: 11px 10px; border-radius: 10px;
          border: 1.5px solid var(--agent-border-default);
          background: transparent; cursor: pointer;
          font-size: 13px; font-weight: 600; color: var(--agent-text-primary);
          transition: border-color 150ms ease;
        }
        .sve-opt:hover { border-color: var(--agent-coral); }
        .sve-opt[data-on="true"], .sve-opt[data-on="true"]:hover { border-color: var(--agent-coral-deep); color: var(--agent-coral-deep); }
        .sve-input {
          width: 100%; padding: 10px 12px; border-radius: 10px;
          border: 1px solid var(--agent-border-default);
          background: transparent; font-size: 14px; color: var(--agent-text-primary);
          outline: none; transition: border-color 150ms ease;
        }
        .sve-input:hover { border-color: var(--agent-coral); }
        .sve-input:focus { border-color: var(--agent-coral-deep); }
      `}</style>
    </Modal>
  );
}
