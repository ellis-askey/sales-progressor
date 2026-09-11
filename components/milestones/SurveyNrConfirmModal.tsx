"use client";

import { Info } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";

interface SurveyNrConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function SurveyNrConfirmModal({ onConfirm, onCancel }: SurveyNrConfirmModalProps) {
  const { theme, isNight } = usePortalTheme();

  return (
    <Modal
      open={true}
      onClose={onCancel}
      ariaLabel="Skip the private survey?"
      size="sm"
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
          <SheetBandHeader kicker="Survey" title="Skip the private survey?" />
        </Modal.Header>

        <Modal.Body>
          <p style={{ fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.6, margin: "0 0 16px" }}>
            Confirm the buyer isn&apos;t getting a private Level 2 or Level 3 survey. The survey report step will also be skipped.
          </p>

          {/* Reassurance callout — skipping is reversible. */}
          <div
            style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              borderRadius: 12, padding: "14px 16px",
              background: "var(--agent-surface-glass)",
              border: "0.5px solid var(--agent-border-default)",
            }}
          >
            <Info size={22} weight="regular" style={{ flexShrink: 0, marginTop: 1, color: "var(--agent-text-secondary)" }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>
                You can always add this later
              </p>
              <p style={{ fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5, margin: "3px 0 0" }}>
                If the buyer decides to get a survey, you can reopen these steps at any time.
              </p>
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer style={{ padding: "14px 20px 20px", gap: 12, justifyContent: undefined }}>
          <button type="button" onClick={onCancel} className="agent-btn agent-btn-ghost-bordered agent-btn-md">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="agent-btn agent-btn-primary agent-btn-md" style={{ flex: 1 }}>
            Yes, skip these
          </button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}
