"use client";

type Props = {
  notes: string;
  onNotesChange: (v: string) => void;
};

export function NotesSection({ notes, onNotesChange }: Props) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "rgba(15,23,42,0.60)", marginBottom: 8 }}>
        Notes
      </label>
      <textarea
        className="agent-textarea"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Any context about this transaction…"
        rows={3}
        style={{ resize: "vertical" }}
      />
    </div>
  );
}
