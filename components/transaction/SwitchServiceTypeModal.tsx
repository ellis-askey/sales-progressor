"use client";

// Confirmation modal for switching a property file's service type
// (self_managed ↔ outsourced). Rendered by PropertyHero for admin viewers
// only. The auth gate lives both at the call site (button only renders for
// admin) and inside switchServiceTypeAction (hasAdminPowers check).

import { useEffect, useState, useTransition } from "react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { switchServiceTypeAction } from "@/app/actions/transactions";

type ServiceType = "self_managed" | "outsourced";

type Props = {
  open: boolean;
  transactionId: string;
  current: ServiceType;
  // Reserved: whether a director is handing their own file over vs an internal
  // admin switch. The copy is unified across both now, so it's currently unused.
  agentHandover?: boolean;
  onClose: () => void;
};

export function SwitchServiceTypeModal({ open, transactionId, current, onClose }: Props) {
  const { theme, isNight } = usePortalTheme();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const target: ServiceType = current === "self_managed" ? "outsourced" : "self_managed";
  const toTSP = target === "outsourced";

  // Direction-aware copy. Header carries the title + a one-line lead; the body
  // says what happens next. Voice clean: no em-dashes.
  const title = toTSP ? "Switch to TSP progression?" : "Switch to self-progress?";
  const subtitle = toTSP
    ? "We'll take over the progression of this sale."
    : "You'll take the progression back over.";
  const body = toTSP
    ? "Our team will pick the file up from here. You'll still have full visibility of the sale and see updates as they happen."
    : "Our team will stop progressing this sale, but everything already recorded will stay exactly where it is. You can continue from where we left off.";
  const confirmLabel = toTSP ? "Switch to TSP progression" : "Switch to self-progress";

  // Reset error when the modal opens or the direction changes.
  useEffect(() => {
    if (open) setError(null);
  }, [open, target]);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await switchServiceTypeAction(transactionId, target);
      if (res.ok) {
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  // Guarded close so escape / backdrop / X don't interrupt the server
  // action mid-flight. Mirrors the pre-canonical guarded handlers.
  function safeClose() {
    if (!isPending) onClose();
  }

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={safeClose}
      ariaLabel={title}
      size="md"
      zLayer="escalated"
      closeTone="onDark"
    >
      <div
        data-theme={theme}
        data-night={isNight ? "" : undefined}
        className="nv2-night"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <Modal.Header style={SHEET_BAND_STYLE}>
          <SheetBandHeader title={title} subtitle={subtitle} />
        </Modal.Header>

        <Modal.Body>
          <p className="text-sm leading-relaxed" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>
            {body}
          </p>
          {error && (
            <p
              className="mt-3 text-xs"
              style={{ color: "var(--agent-danger, #C73E3E)" }}
              role="alert"
            >
              {error}
            </p>
          )}
        </Modal.Body>

        <Modal.Footer style={{ padding: "12px 20px 16px" }}>
          <button
            type="button"
            onClick={safeClose}
            disabled={isPending}
            className="agent-btn agent-btn-neutral agent-btn-md"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="agent-btn agent-btn-primary agent-btn-md"
          >
            {isPending ? "Switching…" : confirmLabel}
          </button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}
