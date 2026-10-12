"use client";

// Floating bulk-action bar — appears when tasks are selected (Ctrl/Cmd-click
// a row or use its menu). Reschedule, priority, assign, move, complete.

import { useState } from "react";
import { CalendarDays, Flag, UserRound, Hash, Check, X } from "lucide-react";
import { useTodo } from "./TodoProvider";
import { AssigneePicker, DuePicker, PriorityPicker, ProjectPicker } from "./Pickers";

export function BulkBar() {
  const todo = useTodo();
  const [picker, setPicker] = useState<"due" | "priority" | "assignee" | "project" | null>(null);
  const ids = [...todo.selection];
  if (!ids.length) return null;

  return (
    <div
      className="bw-fade-up"
      style={{
        position: "fixed",
        bottom: 22,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        background: "var(--bw-ink-strong)",
        color: "#fff",
        borderRadius: 999,
        boxShadow: "var(--bw-shadow-lg)",
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "6px 8px 6px 16px",
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 700, marginRight: 8 }}>{ids.length} selected</span>

      {(
        [
          ["due", <CalendarDays key="d" size={14} />, "Reschedule"],
          ["priority", <Flag key="p" size={14} />, "Priority"],
          ["assignee", <UserRound key="a" size={14} />, "Assign"],
          ["project", <Hash key="m" size={14} />, "Move"],
        ] as const
      ).map(([key, icon, label]) => (
        <div key={key} style={{ position: "relative" }}>
          <button
            onClick={() => setPicker(picker === key ? null : key)}
            aria-label={label}
            title={label}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: "#fff", cursor: "pointer", padding: "7px 10px", borderRadius: 999, fontSize: 12.5, fontFamily: "var(--bw-font-sans)" }}
          >
            {icon}
          </button>
          {picker === key && (
            <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" }}>
              <div style={{ position: "relative" }}>
                {key === "due" && (
                  <DuePicker value={null} time={null} recurrence={null} onClose={() => setPicker(null)} onChange={(d) => { void todo.bulkPatch(ids, { dueDate: d.dueDate }); setPicker(null); }} />
                )}
                {key === "priority" && <PriorityPicker value={4} onClose={() => setPicker(null)} onChange={(p) => void todo.bulkPatch(ids, { priority: p })} />}
                {key === "assignee" && <AssigneePicker value={null} onClose={() => setPicker(null)} onChange={(id) => void todo.bulkPatch(ids, { assigneeId: id })} />}
                {key === "project" && <ProjectPicker onClose={() => setPicker(null)} onPick={(projectId, sectionId) => void todo.bulkPatch(ids, { projectId, sectionId })} />}
              </div>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={() => {
          for (const id of ids) void todo.completeTask(id, true);
          todo.clearSelection();
        }}
        style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--bw-sage-ink)", border: "none", color: "#fff", cursor: "pointer", padding: "7px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, fontFamily: "var(--bw-font-sans)", marginLeft: 4 }}
      >
        <Check size={13} /> Complete
      </button>
      <button onClick={todo.clearSelection} aria-label="Clear selection" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: "7px 8px", display: "flex" }}>
        <X size={14} />
      </button>
    </div>
  );
}
