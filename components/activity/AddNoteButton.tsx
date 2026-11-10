"use client";

// Standalone "Add note" launcher (critique #275). Sits next to the "New email"
// button in the top-right of the general pages (hub, focus, chains, comms,
// to-do, files). The note flow itself lives in AddNoteModal (controlled), so the
// app-wide quick-action dock can open the exact same surface. For the founder,
// this header button is hidden — the dock provides it instead.

import { useState } from "react";
import { NotePencil } from "@phosphor-icons/react";
import { useIsFounder } from "@/components/layout/FounderGate";
import { AddNoteModal } from "@/components/activity/AddNoteModal";

export function AddNoteButton({ variant = "ghost" }: { variant?: "primary" | "ghost" }) {
  const founder = useIsFounder();
  const [open, setOpen] = useState(false);

  // The founder gets the app-wide dock instead of these header buttons.
  if (founder) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={variant === "primary" ? "agent-btn agent-btn-sm agent-btn-primary" : "agent-btn agent-btn-sm agent-btn-secondary"}
        style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
      >
        <NotePencil size={15} weight="fill" />
        Add note
      </button>
      <AddNoteModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
