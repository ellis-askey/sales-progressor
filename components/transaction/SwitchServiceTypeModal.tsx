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
  onClose: () => void;
};

export function SwitchServiceTypeModal({ open, transactionId, current, onClose }: Props) {
  const { theme, isNight } = usePortalTheme();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const target: ServiceType = current === "self_managed" ? "outsourced" : "self_managed";

  // Direction-aware copy. Voice clean: no em-dashes, no "milestone" /
  // "transaction" / "platform". Body explains what happens next so admin
  // can confirm intent.
  const title =
    target === "outsourced" ? "Switch to outsourced?" : "Switch to self-progress?";
  const body =
    target === "outsourced"
      ? "Our team will pick this file up and progress it from here. The agent will still see it and any updates as they happen. The file will land in 'Needs SP assigning' on the hub."
      : "The agent will handle this file from here. Our team won't get any further updates about it.";
  const confirmLabel =
    target === "outsourced" ? "Switch to outsourced" : "Switch to self-progress";

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
          <SheetBandHeader kicker="Service type" title={title} />
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
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              color: "var(--agent-text-secondary, #4b5563)",
              background: "transparent",
              border: "0.5px solid var(--agent-border-default, rgba(0,0,0,0.12))",
              cursor: isPending ? "default" : "pointer",
              opacity: isPending ? 0.5 : 1,
            }}
            className="hover:bg-black/[0.04]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              background: "var(--agent-coral-deep, #E5502E)",
              border: "none",
              cursor: isPending ? "default" : "pointer",
              opacity: isPending ? 0.7 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minWidth: 140,
              justifyContent: "center",
            }}
          >
            {isPending && (
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.35)",
                  borderTopColor: "#fff",
                  animation: "agent-spin 700ms linear infinite",
                  display: "inline-block",
                }}
              />
            )}
            {isPending ? "Switching…" : confirmLabel}
          </button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}
