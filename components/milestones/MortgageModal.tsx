"use client";

import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";

interface MortgageModalProps {
  onConfirmMortgage: () => void;
  onConfirmReinstate: () => void;
  onCancel: () => void;
}

export function MortgageModal({ onConfirmMortgage, onConfirmReinstate, onCancel }: MortgageModalProps) {
  const { theme } = usePortalTheme();

  return (
    <Modal
      open={true}
      onClose={onCancel}
      ariaLabel="Is this buyer now using a mortgage?"
      size="sm"
      dismissOnBackdrop={false}
      showCloseButton={false}
      closeTone="onDark"
    >
      <div data-theme={theme} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <Modal.Header style={SHEET_BAND_STYLE}>
          <SheetBandHeader kicker="Mortgage" title="Is this buyer now using a mortgage?" />
        </Modal.Header>

        <Modal.Body>
          <p style={{ fontSize: 13, color: "rgba(15,23,42,0.45)", lineHeight: 1.6, margin: 0 }}>
            This re-opens the mortgage steps and updates the purchase type.
          </p>
        </Modal.Body>

        {/* Three-tier stacked footer overrides Modal.Footer's default right-
            aligned row. Cancel uses agent-btn-ghost-bordered (Button primitive
            doesn't expose it; grandfathered). */}
        <Modal.Footer style={{ padding: "14px 20px 20px", display: "flex", flexDirection: "column", gap: 8, justifyContent: undefined }}>
          {/* Primary */}
          <button
            onClick={onConfirmMortgage}
            className="agent-btn-color-primary"
            style={{ width: "100%", padding: "10px 16px", borderRadius: 12, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}
          >
            Yes, mortgage buyer
          </button>

          {/* Secondary */}
          <button
            onClick={onConfirmReinstate}
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: 12,
              background: "transparent",
              color: "rgba(15,23,42,0.65)",
              fontWeight: 500,
              fontSize: 14,
              border: "1px solid rgba(15,23,42,0.15)",
              cursor: "pointer",
              transition: "background 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Re-open without changing purchase type
          </button>

          {/* Tertiary */}
          <button
            onClick={onCancel}
            className="agent-btn agent-btn-ghost-bordered w-full"
          >
            Cancel
          </button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}
