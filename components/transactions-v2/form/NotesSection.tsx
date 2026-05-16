"use client";

type Props = {
  notes: string;
  onNotesChange: (v: string) => void;
};

export function NotesSection({ notes, onNotesChange }: Props) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--nv2-text-reading)", marginBottom: 8 }}>
        Notes
      </label>
      <textarea
        className="agent-textarea"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Any context about this sale…"
        rows={3}
        style={{ resize: "vertical" }}
      />
    </div>
  );
}
