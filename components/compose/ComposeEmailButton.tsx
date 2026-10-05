"use client";

// Opens the agent email composer (critique 2026-10-05). Drop this anywhere —
// the hub header, a file — and it manages the modal's open state itself.
// Pass initialTransactionId to pre-select the sale (e.g. from a file).

import { useState } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { ComposeEmailModal } from "@/components/compose/ComposeEmailModal";

export function ComposeEmailButton({
  initialTransactionId = null,
  variant = "primary",
  label = "New email",
}: {
  initialTransactionId?: string | null;
  variant?: "primary" | "ghost";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
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
      <ComposeEmailModal open={open} onClose={() => setOpen(false)} initialTransactionId={initialTransactionId} />
    </>
  );
}
