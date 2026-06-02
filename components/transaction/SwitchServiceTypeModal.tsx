"use client";

// Confirmation modal for switching a property file's service type
// (self_managed ↔ outsourced). Rendered by PropertyHero for admin viewers
// only. The auth gate lives both at the call site (button only renders for
// admin) and inside switchServiceTypeAction (hasAdminPowers check).
//
// Modal pattern matches components/transaction/AiSummaryButton.tsx —
// createPortal + usePortalTheme so agent CSS variables resolve, Escape +
// backdrop click to dismiss, agent-modal-in animation.

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react/dist/ssr";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
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

  // Escape to dismiss.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, isPending]);

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

  if (!open) return null;

  return createPortal(
    <div
      data-theme={theme}
      data-night={isNight ? "" : undefined}
      className="nv2-night fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 1500 }}
      onClick={isPending ? undefined : onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl w-full max-w-md"
        style={{
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "rgba(0,0,0,0.06)" }}
        >
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            disabled={isPending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "transparent",
              border: "none",
              cursor: isPending ? "default" : "pointer",
              color: "var(--agent-text-muted, #6b7280)",
              opacity: isPending ? 0.4 : 1,
            }}
            className="hover:bg-black/[0.05]"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
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
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3 border-t"
          style={{ borderColor: "rgba(0,0,0,0.06)" }}
        >
          <button
            type="button"
            onClick={onClose}
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
        </div>
      </div>
    </div>,
    document.body,
  );
}
