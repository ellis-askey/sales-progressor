"use client";

// Director-only "assign to" dropdown. Reused by:
//   - new-sale form (initial owner of a fresh file)
//   - file-detail reassign control (change owner on an existing file)
//
// Visual: a simple compact <select> styled like other agent-app form
// fields so it fits the new-sale flow without ceremony. List comes
// from lib/services/agency-team.listAssignableAgentsForAgency — the
// caller is responsible for pre-fetching and passing it in. Director
// label gets a "(you)" suffix on whichever option matches the current
// user, so the picker reads naturally either way.

import type { AssignableAgent } from "@/lib/services/agency-team";

type Props = {
  value: string;                         // currently-selected userId
  onChange: (userId: string) => void;
  agents: AssignableAgent[];
  currentUserId: string;
  label?: string;                        // e.g. "Assign to"
  disabled?: boolean;
  className?: string;
};

export function AgentPicker({
  value,
  onChange,
  agents,
  currentUserId,
  label,
  disabled,
  className,
}: Props) {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <label style={{ fontSize: 11, fontWeight: 500, color: "var(--agent-text-secondary)" }}>
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="glass-input"
        style={{
          // Let .glass-input's padding determine the height so the selected
          // option lines up with the rest of the agent-app form controls
          // (a fixed height + class padding was clipping the descenders on
          // the selected value).
          fontSize: 13,
          cursor: disabled ? "not-allowed" : "pointer",
          appearance: "auto",
        }}
      >
        {agents.map((a) => {
          const isMe = a.id === currentUserId;
          return (
            <option key={a.id} value={a.id}>
              {a.name}{isMe ? " (you)" : ""}
            </option>
          );
        })}
      </select>
    </div>
  );
}
