"use client";

import { NotesField } from "@/components/ui/NotesField";

type Props = {
  notes: string;
  onNotesChange: (v: string) => void;
};

export function NotesSection({ notes, onNotesChange }: Props) {
  return (
    <NotesField
      label="Notes"
      hideLabel
      value={notes}
      onChange={onNotesChange}
      placeholder="Any context about this sale…"
    />
  );
}
