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
import { ProgressorPicker, type ProgressorOption } from "@/components/transactions-v2/ProgressorPicker";

type ServiceType = "self_managed" | "outsourced";

type Props = {
  open: boolean;
  transactionId: string;
  current: ServiceType;
  // Reserved: whether a director is handing their own file over vs an internal
  // admin switch. The copy is unified across both now, so it's currently unused.
  agentHandover?: boolean;
  // When a director hands their file to the agency's external progressor (not
  // TSP), this names that business so the copy reads "Hand to {name}". Null
  // keeps the unchanged TSP wording.
  progressorName?: string | null;
  // Multi-progressor: all progressors the agency works with. When 2+, the modal
  // shows a picker and the director must choose before handing over. For 0/1 this
  // is empty and progressorName (the single primary) drives the copy as before.
  progressors?: ProgressorOption[];
  // The file's purchase price (pence), so the picker can show each progressor's
  // actual fee for this sale.
  pricePence?: number | null;
  onClose: () => void;
};

export function SwitchServiceTypeModal({ open, transactionId, current, progressorName = null, progressors = [], pricePence = null, onClose }: Props) {
  const { theme, isNight } = usePortalTheme();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string>("");

  const target: ServiceType = current === "self_managed" ? "outsourced" : "self_managed";
  const toTSP = target === "outsourced";

  // Multi-progressor handover: the director chooses which progressor takes the
  // file. The effective name (for the copy) is the picked one; nothing is chosen
  // by default, so the copy stays generic until they pick.
  const multiProgressor = toTSP && progressors.length >= 2;
  const pickedName = multiProgressor ? (progressors.find((p) => p.businessId === pickedId)?.name ?? null) : null;
  const effectiveName = multiProgressor ? pickedName : progressorName;

  // Direction-aware copy. Header carries the title + a one-line lead; the body
  // says what happens next. Voice clean: no em-dashes. When handing over to an
  // external progression business (not TSP), the copy names that business. In the
  // multi-progressor case the copy stays generic ("Hand this file over?") until a
  // progressor is picked, then names them.
  const toProgressor = toTSP && !!effectiveName;
  const title = !toTSP
    ? "Switch to self-progress?"
    : toProgressor ? `Hand this file to ${effectiveName}?` : multiProgressor ? "Hand this file over?" : "Switch to TSP progression?";
  const subtitle = !toTSP
    ? "You'll take the progression back over."
    : toProgressor
      ? `${effectiveName} will take over the progression of this sale.`
      : multiProgressor
        ? "Choose which of your progressors takes over this sale."
        : "We'll take over the progression of this sale.";
  const body = !toTSP
    ? "Progressing on this sale will stop and you'll take it back over. Everything already recorded stays exactly where it is, so you can carry on from where it was left off."
    : toProgressor
      ? `${effectiveName} will pick the file up from here. You'll still have full visibility of the sale and see updates as they happen.`
      : multiProgressor
        ? ""
        : "Our team will pick the file up from here. You'll still have full visibility of the sale and see updates as they happen.";
  const confirmLabel = !toTSP
    ? "Switch to self-progress"
    : toProgressor ? `Hand to ${effectiveName}` : multiProgressor ? "Hand over" : "Switch to TSP progression";
  const confirmDisabled = isPending || (multiProgressor && !pickedId);

  // Reset error + pick when the modal opens or the direction changes.
  useEffect(() => {
    if (open) { setError(null); setPickedId(""); }
  }, [open, target]);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await switchServiceTypeAction(transactionId, target, multiProgressor ? pickedId : undefined);
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
          {body && (
            <p className="text-sm leading-relaxed" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>
              {body}
            </p>
          )}
          {multiProgressor && (
            <ProgressorPicker progressors={progressors} selectedId={pickedId} onSelect={setPickedId} pricePence={pricePence} />
          )}
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
            disabled={confirmDisabled}
            className="agent-btn agent-btn-primary agent-btn-md"
          >
            {isPending ? "Switching…" : confirmLabel}
          </button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}
