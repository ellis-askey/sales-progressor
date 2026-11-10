"use client";

// Opens the agent email composer (critique 2026-10-05). Drop this anywhere —
// the hub header, a file — and it manages the modal's open state itself.
// Pass initialTransactionId to pre-select the sale (e.g. from a file).

import { useState } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { useIsFounder } from "@/components/layout/FounderGate";
import { ComposeEmailModal, type ComposeSaleHint } from "@/components/compose/ComposeEmailModal";

export function ComposeEmailButton({
  initialTransactionId = null,
  variant = "primary",
  label = "New email",
  initialSaleHint = null,
  keep = false,
}: {
  initialTransactionId?: string | null;
  variant?: "primary" | "ghost";
  label?: string;
  // When opened from a file, the address + photo we already have, so the modal
  // shows WHICH property instantly instead of flashing the sale search box.
  initialSaleHint?: ComposeSaleHint | null;
  // Set on file-context buttons (e.g. the contact card) that must stay even for
  // the founder — they carry a file the app-wide dock can't. General top-right
  // header buttons omit it, so they hide for the founder (who uses the dock).
  keep?: boolean;
}) {
  const founder = useIsFounder();
  const [open, setOpen] = useState(false);
  if (founder && !keep) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={variant === "primary" ? "agent-btn agent-btn-sm agent-btn-primary" : "agent-btn agent-btn-sm agent-btn-secondary"}
        style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
      >
        <PaperPlaneTilt size={15} weight="fill" />
        {label}
      </button>
      <ComposeEmailModal open={open} onClose={() => setOpen(false)} initialTransactionId={initialTransactionId} initialSaleHint={initialSaleHint} />
    </>
  );
}
