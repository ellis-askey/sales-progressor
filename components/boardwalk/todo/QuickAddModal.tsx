"use client";

// Global quick-add (press Q). Natural-language input with a live parse
// preview — recognised dates, recurrence, priority, #project, @labels and
// +assignee appear as chips the moment they're understood, and can be
// corrected with the pickers below. Enter adds and stays open for the next
// thought; Escape closes.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Flag, Hash, Repeat, Tag, UserRound, X } from "lucide-react";
import { parseQuickAdd } from "@/lib/todo/nlp";
import { extractFirstName } from "@/lib/contacts/displayName";
import { todayInLondon } from "@/lib/todo/recurrence";
import type { RecurrenceRule } from "@/lib/todo/types";
import { useTodo } from "./TodoProvider";
import { AssigneePicker, DuePicker, LabelPicker, PriorityPicker, ProjectPicker, PRIORITY_COLORS, formatDueLabel } from "./Pickers";

export function QuickAddModal() {
  const todo = useTodo();
  const [text, setText] = useState("");
  const [manual, setManual] = useState<{
    dueDate?: string | null;
    dueTime?: string | null;
    recurrence?: RecurrenceRule | null;
    priority?: number;
    projectId?: string | null;
    sectionId?: string | null;
    assigneeId?: string | null;
    labelIds?: string[];
  }>({});
  const [picker, setPicker] = useState<"due" | "priority" | "project" | "labels" | "assignee" | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = todo.quickAddOpen;

  useEffect(() => {
    if (open) {
      setText("");
      setManual(todo.quickAddDefaults as typeof manual);
      setPicker(null);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const parsed = useMemo(() => parseQuickAdd(text || " ", todayInLondon()), [text]);

  const matchedProject = useMemo(() => {
    if (manual.projectId !== undefined) return todo.projects.find((p) => p.id === manual.projectId) ?? null;
    if (parsed.projectToken) {
      return todo.projects.find((p) => p.name.toLowerCase().startsWith(parsed.projectToken!.toLowerCase())) ?? null;
    }
    return null;
  }, [manual.projectId, parsed.projectToken, todo.projects]);

  const matchedLabels = useMemo(() => {
    if (manual.labelIds) return manual.labelIds;
    return parsed.labelTokens
      .map((tok) => todo.labels.find((l) => l.name.toLowerCase() === tok.toLowerCase())?.id)
      .filter((x): x is string => !!x);
  }, [manual.labelIds, parsed.labelTokens, todo.labels]);

  const matchedAssignee = useMemo(() => {
    if (manual.assigneeId !== undefined) return manual.assigneeId;
    if (parsed.assigneeToken) {
      const tok = parsed.assigneeToken.toLowerCase();
      return todo.members.find((m) => extractFirstName(m.name).toLowerCase() === tok || m.name.toLowerCase() === tok)?.id ?? null;
    }
    return null;
  }, [manual.assigneeId, parsed.assigneeToken, todo.members]);

  const effective = {
    dueDate: manual.dueDate !== undefined ? manual.dueDate : parsed.dueDate,
    dueTime: manual.dueTime !== undefined ? manual.dueTime : parsed.dueTime,
    recurrence: manual.recurrence !== undefined ? manual.recurrence : parsed.recurrence,
    priority: manual.priority ?? parsed.priority ?? 4,
  };

  async function submit(keepOpen: boolean) {
    const title = parsed.title.trim();
    if (!title || busy) return;
    setBusy(true);
    const result = await todo.addTask(
      {
        title,
        dueDate: effective.dueDate ?? undefined,
        dueTime: effective.dueTime ?? undefined,
        recurrence: effective.recurrence ?? undefined,
        priority: effective.priority,
        projectId: matchedProject?.id ?? undefined,
        sectionId: manual.sectionId ?? undefined,
        assigneeId: matchedAssignee ?? undefined,
        labelIds: matchedLabels.length ? matchedLabels : undefined,
      },
      matchedProject ? `project:${matchedProject.id}` : "inbox"
    );
    setBusy(false);
    if (result) {
      setText("");
      setManual(todo.quickAddDefaults as typeof manual);
      if (!keepOpen) todo.closeQuickAdd();
      else inputRef.current?.focus();
    }
  }

  if (!open || typeof document === "undefined") return null;

  const chip = (icon: React.ReactNode, label: string, onClear?: () => void, color?: string) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: "var(--bw-paper-sunken)",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 600,
        color: color ?? "var(--bw-ink)",
      }}
    >
      {icon}
      {label}
      {onClear && (
        <button onClick={onClear} aria-label={`Clear ${label}`} style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 0, color: "inherit", opacity: 0.6 }}>
          <X size={11} />
        </button>
      )}
    </span>
  );

  return createPortal(
    <div className="bw-scope">
      <div className="bw-backdrop" onClick={todo.closeQuickAdd} />
      <div className="bw-modal" role="dialog" aria-modal="true" aria-label="Add task" style={{ alignItems: "flex-start", paddingTop: "14vh" }}>
        <div className="bw-modal-panel" style={{ maxWidth: 620 }}>
          <div style={{ padding: "18px 20px 16px" }}>
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit(!e.metaKey && !e.ctrlKey);
                }
                if (e.key === "Escape") todo.closeQuickAdd();
              }}
              placeholder='Try "Call vendor tomorrow at 10am p2 #Launch @admin +nick"'
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                fontSize: 17,
                fontFamily: "var(--bw-font-sans)",
                color: "var(--bw-ink)",
                background: "transparent",
              }}
            />

            {/* parse preview chips */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12, minHeight: 26 }}>
              {effective.dueDate && chip(<CalendarDays size={12} />, formatDueLabel(effective.dueDate, effective.dueTime), () => setManual((m) => ({ ...m, dueDate: null, dueTime: null })))}
              {effective.recurrence && chip(<Repeat size={12} />, effective.recurrence.label, () => setManual((m) => ({ ...m, recurrence: null })))}
              {effective.priority < 4 && chip(<Flag size={12} />, `P${effective.priority}`, () => setManual((m) => ({ ...m, priority: 4 })), PRIORITY_COLORS[effective.priority])}
              {matchedProject && chip(<Hash size={12} style={{ color: matchedProject.color }} />, matchedProject.name, () => setManual((m) => ({ ...m, projectId: null })))}
              {!matchedProject && parsed.projectToken && chip(<Hash size={12} />, `${parsed.projectToken}?`, undefined, "var(--bw-ink-faint)")}
              {matchedLabels.map((id) => {
                const l = todo.labels.find((x) => x.id === id);
                return l ? chip(<Tag size={12} style={{ color: l.color }} />, l.name, () => setManual((m) => ({ ...m, labelIds: matchedLabels.filter((x) => x !== id) }))) : null;
              })}
              {matchedAssignee && chip(<UserRound size={12} />, todo.memberName(matchedAssignee), () => setManual((m) => ({ ...m, assigneeId: null })))}
            </div>
          </div>

          {/* picker bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 16px", borderTop: "1px solid var(--bw-line)", background: "var(--bw-paper)", position: "relative", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <button className="bw-btn bw-btn-secondary bw-btn-sm" onClick={() => setPicker(picker === "due" ? null : "due")}>
                <CalendarDays size={13} /> {effective.dueDate ? formatDueLabel(effective.dueDate) : "Date"}
              </button>
              {picker === "due" && (
                <DuePicker
                  value={effective.dueDate ?? null}
                  time={effective.dueTime ?? null}
                  recurrence={effective.recurrence ?? null}
                  onClose={() => setPicker(null)}
                  onChange={(d) => setManual((m) => ({ ...m, ...d }))}
                />
              )}
            </div>
            <div style={{ position: "relative" }}>
              <button className="bw-btn bw-btn-secondary bw-btn-sm" onClick={() => setPicker(picker === "priority" ? null : "priority")}>
                <Flag size={13} style={{ color: effective.priority < 4 ? PRIORITY_COLORS[effective.priority] : undefined }} /> Priority
              </button>
              {picker === "priority" && (
                <PriorityPicker value={effective.priority} onClose={() => setPicker(null)} onChange={(p) => setManual((m) => ({ ...m, priority: p }))} />
              )}
            </div>
            <div style={{ position: "relative" }}>
              <button className="bw-btn bw-btn-secondary bw-btn-sm" onClick={() => setPicker(picker === "project" ? null : "project")}>
                <Hash size={13} /> {matchedProject ? matchedProject.name : "Inbox"}
              </button>
              {picker === "project" && (
                <ProjectPicker onClose={() => setPicker(null)} onPick={(projectId, sectionId) => setManual((m) => ({ ...m, projectId, sectionId }))} />
              )}
            </div>
            <div style={{ position: "relative" }}>
              <button className="bw-btn bw-btn-secondary bw-btn-sm" onClick={() => setPicker(picker === "labels" ? null : "labels")}>
                <Tag size={13} /> Labels{matchedLabels.length ? ` (${matchedLabels.length})` : ""}
              </button>
              {picker === "labels" && (
                <LabelPicker value={matchedLabels} onClose={() => setPicker(null)} onChange={(ids) => setManual((m) => ({ ...m, labelIds: ids }))} />
              )}
            </div>
            <div style={{ position: "relative" }}>
              <button className="bw-btn bw-btn-secondary bw-btn-sm" onClick={() => setPicker(picker === "assignee" ? null : "assignee")}>
                <UserRound size={13} /> {matchedAssignee ? todo.memberName(matchedAssignee) : "Assign"}
              </button>
              {picker === "assignee" && (
                <AssigneePicker value={matchedAssignee} onClose={() => setPicker(null)} onChange={(id) => setManual((m) => ({ ...m, assigneeId: id }))} />
              )}
            </div>

            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              <span className="bw-hint" style={{ fontSize: 11 }}>Enter adds another · Ctrl+Enter adds &amp; closes</span>
              <button className="bw-btn bw-btn-primary bw-btn-sm" disabled={!parsed.title.trim() || busy} onClick={() => void submit(false)}>
                Add task
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
