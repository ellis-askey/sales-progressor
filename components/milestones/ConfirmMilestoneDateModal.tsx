"use client";

// Date-capture prompt shown when an exchange/completion step (VM19/PM26/VM20/
// PM27) is confirmed from a "Done" button (reminders page, in-file reminders
// tab, work queue, next-action card). The Steps tab captures the real event
// date inline before confirming; this gives the Reminders surfaces the same
// capture so the recorded exchange/completion date is correct and the
// completion email isn't wrongly suppressed by the 24h staleness rule.
//
// Reuses the canonical Modal + Button primitives and the same getEventDateLabel
// + date-input pattern as components/milestones/MilestoneRow.tsx.

import { useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { getEventDateLabel } from "@/lib/portal-copy";
import { DateField } from "@/components/ui/DateField";

// The four bilateral exchange/completion codes that carry a real-world date.
const DATE_PROMPT_CODES = new Set(["VM19", "PM26", "VM20", "PM27"]);

export function milestoneNeedsDatePrompt(code: string | null | undefined): boolean {
  return !!code && DATE_PROMPT_CODES.has(code);
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function ConfirmMilestoneDateModal({
  open,
  milestoneCode,
  milestoneName,
  loading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  milestoneCode: string | null;
  milestoneName?: string;
  loading?: boolean;
  onConfirm: (eventDate: string) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(todayStr());
  const { isNight } = usePortalTheme();

  const isExchange = milestoneCode === "VM19" || milestoneCode === "PM26";
  const heading = isExchange ? "Confirm exchange" : "Confirm completion";
  const label = milestoneCode ? getEventDateLabel(milestoneCode) : "Date";

  return (
    <Modal open={open} onClose={onClose} ariaLabel={heading} size="sm" dismissOnBackdrop={!loading}>
      <div data-night={isNight ? "" : undefined} className="nv2-night" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <ModalHeader>
        <h2 className="text-base font-semibold text-slate-900">{heading}</h2>
        {milestoneName && <p className="text-xs text-slate-900/50 mt-0.5">{milestoneName}</p>}
      </ModalHeader>
      <ModalBody>
        <label className="block text-xs text-slate-900/50 mb-1">{label}</label>
        <DateField
          value={date}
          max={todayStr()}
          onChange={(e) => setDate(e.target.value)}
          className="glass-input px-2 py-1.5 text-sm"
          wrapperStyle={{ display: "inline-block" }}
        />
        <p className="text-[10px] text-slate-900/50 mt-2">
          Defaults to today. Change it only if this happened earlier.
        </p>
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end gap-2">
          <button type="button" className="agent-btn agent-btn-neutral agent-btn-sm" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <Button variant="primary" size="sm" loading={loading} disabled={!date} onClick={() => onConfirm(date)}>
            Confirm
          </Button>
        </div>
      </ModalFooter>
      </div>
    </Modal>
  );
}
