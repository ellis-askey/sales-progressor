"use client";

import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";

interface SurveyNrConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function SurveyNrConfirmModal({ onConfirm, onCancel }: SurveyNrConfirmModalProps) {
  const { theme } = usePortalTheme();

  return (
    <Modal
      open={true}
      onClose={onCancel}
      ariaLabel="Skip the private survey?"
      size="sm"
      dismissOnBackdrop={false}
      showCloseButton={false}
      closeTone="onDark"
    >
      <div data-theme={theme} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <Modal.Header style={SHEET_BAND_STYLE}>
          <SheetBandHeader kicker="Survey" title="Skip the private survey?" />
        </Modal.Header>

        <Modal.Body>
          <p style={{ fontSize: 13, color: "rgba(15,23,42,0.55)", lineHeight: 1.6, margin: 0 }}>
            Confirm the buyer isn&apos;t getting a private Level 2 or Level 3 survey. The survey report step is also skipped.
          </p>
        </Modal.Body>

        {/* Footer: Cancel left (96px fixed width) + Primary right (flex-1).
            Cancel keeps its inline mouseenter/leave hover handlers - flagged
            as a preserved grandfather in the Phase 3 PLAN. */}
        <Modal.Footer style={{ padding: "0 20px 20px", gap: 12, justifyContent: undefined }}>
          <button
            onClick={onCancel}
            style={{
              width: 96, padding: "10px 0", borderRadius: 12,
              background: "transparent", color: "rgba(15,23,42,0.55)",
              fontWeight: 500, fontSize: 14,
              border: "1px solid rgba(15,23,42,0.15)", cursor: "pointer", transition: "background 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="agent-btn-color-primary"
            style={{ flex: 1, padding: "10px 16px", borderRadius: 12, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}
          >
            Yes, skip these
          </button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}
