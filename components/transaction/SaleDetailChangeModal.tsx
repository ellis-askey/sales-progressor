"use client";

// Confirm dialog for an inline purchase-type / tenure change made from the
// hero. Reuses the canonical Modal primitive and the shared
// SaleDetailsDeltaPreview so it renders the same impact preview the edit
// drawer shows. Completed steps that will be reopened are called out loudly
// at the top, because reversing confirmed work is the one consequence an
// agent must not miss.

import { Warning } from "@phosphor-icons/react";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { SaleDetailsDeltaPreview } from "./SaleDetailsDeltaPreview";
import type { SaleDetailsDelta } from "@/app/actions/transactions";

export function SaleDetailChangeModal({
  open,
  onClose,
  title,
  delta,
  loading,
  confirming,
  error,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  // null while the preview is still loading.
  delta: SaleDetailsDelta | null;
  loading: boolean;
  confirming: boolean;
  error: string | null;
  onConfirm: () => void;
}) {
  const reopened = delta ? delta.becomingNr.filter((i) => i.wasComplete).length : 0;
  const hasStepChanges = !!delta && (delta.becomingNr.length > 0 || delta.becomingRequired.length > 0);

  return (
    <Modal open={open} onClose={onClose} ariaLabel={title} size="md" dismissOnBackdrop={!confirming} closeTone="onDark">
      <Modal.Header style={SHEET_BAND_STYLE}>
        <SheetBandHeader kicker="Sale details" title={title} />
      </Modal.Header>

      <Modal.Body>
        {loading ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>Checking what this changes…</p>
        ) : (
          <>
            {reopened > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "10px 12px",
                  marginBottom: 14,
                  borderRadius: 10,
                  background: "rgba(234, 88, 12, 0.08)",
                  border: "0.5px solid rgba(234, 88, 12, 0.3)",
                }}
              >
                <Warning size={16} weight="fill" style={{ color: "#c2410c", flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 12.5, color: "#9a3412", lineHeight: 1.45 }}>
                  {reopened} completed step{reopened === 1 ? "" : "s"} will be reopened. You can confirm {reopened === 1 ? "it" : "them"} again afterwards.
                </p>
              </div>
            )}

            {delta && hasStepChanges && <SaleDetailsDeltaPreview delta={delta} />}

            {delta && !hasStepChanges && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
                No steps change. We&apos;ll update the file and keep everything where it is.
              </p>
            )}

            {error && (
              <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--agent-danger)", lineHeight: 1.45 }}>{error}</p>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          disabled={confirming}
          className="agent-btn-ghost-bordered"
          style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, opacity: confirming ? 0.5 : 1 }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading || confirming}
          className="agent-btn-color-primary"
          style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, opacity: loading || confirming ? 0.6 : 1 }}
        >
          {confirming ? "Saving…" : "Confirm change"}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
