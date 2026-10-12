"use client";

// TaskRow + TaskList — the everyday surface of Boardwalk To Do. Rows complete
// optimistically with a priority-tinted check, open the detail panel on
// click, and carry quick actions (reschedule, priority, more) on hover.
// Lists support grouping, drag-and-drop reorder (dnd-kit) and an inline
// add-task row that inherits the view's context (project, section, date).

import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check, GripVertical, CalendarDays, Flag, MessageSquare, Repeat,
  CircleCheck, Plus, Hash,
} from "lucide-react";
import type { TaskDto } from "@/lib/todo/types";
import { todayInLondon } from "@/lib/todo/recurrence";
import { parseQuickAdd } from "@/lib/todo/nlp";
import { useTodo, type ViewKey } from "./TodoProvider";
import { BwMenu } from "../ui";
import { AssigneePicker, DuePicker, PriorityPicker, ProjectPicker, PRIORITY_COLORS, dueTone, formatDueLabel } from "./Pickers";

// ─── Row ─────────────────────────────────────────────────────────────────────

export function TaskRow({
  task,
  viewKey,
  showProject = false,
  draggable = false,
  depth = 0,
}: {
  task: TaskDto;
  viewKey: ViewKey;
  showProject?: boolean;
  draggable?: boolean;
  depth?: number;
}) {
  const todo = useTodo();
  const [duePicker, setDuePicker] = useState(false);
  const [prioPicker, setPrioPicker] = useState(false);
  const [movePicker, setMovePicker] = useState(false);
  const [checking, setChecking] = useState(false);
  const selected = todo.selection.has(task.id);
  const project = task.projectId ? todo.projects.find((p) => p.id === task.projectId) : null;

  const sortable = useSortable({ id: task.id, disabled: !draggable });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const done = !!task.completedAt;
  const pColor = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[4];

  function complete() {
    if (done) {
      void todo.completeTask(task.id, false);
      return;
    }
    setChecking(true);
    setTimeout(() => {
      void todo.completeTask(task.id, true);
      setChecking(false);
    }, 180);
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: "relative",
      }}
    >
      <div
        className="bw-task-row"
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey) {
            todo.toggleSelect(task.id);
            return;
          }
          todo.openTask(task.id);
        }}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 9,
          padding: "9px 10px 9px 4px",
          marginLeft: depth * 26,
          borderBottom: "1px solid var(--bw-line)",
          cursor: "pointer",
          background: selected ? "var(--bw-blush)" : "transparent",
          borderRadius: selected ? 8 : 0,
          transition: "background 130ms ease",
        }}
      >
        {/* drag handle */}
        <span
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 14,
            alignSelf: "center",
            color: "var(--bw-ink-faint)",
            cursor: draggable ? "grab" : "default",
            opacity: draggable ? undefined : 0,
            display: "flex",
            touchAction: "none",
          }}
          className="bw-row-grip"
        >
          <GripVertical size={13} />
        </span>

        {/* complete checkbox */}
        <button
          aria-label={done ? "Reopen task" : "Complete task"}
          onClick={(e) => {
            e.stopPropagation();
            complete();
          }}
          style={{
            width: 19,
            height: 19,
            borderRadius: 999,
            flexShrink: 0,
            marginTop: 1,
            border: `1.8px solid ${pColor}`,
            background: done || checking ? pColor : task.priority < 4 ? `color-mix(in srgb, ${pColor} 10%, transparent)` : "transparent",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "background 140ms ease, transform 140ms ease",
            transform: checking ? "scale(1.15)" : "none",
          }}
        >
          {(done || checking) && <Check size={11} strokeWidth={3.2} />}
        </button>

        {/* body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.4,
              color: done ? "var(--bw-ink-faint)" : "var(--bw-ink)",
              textDecoration: done ? "line-through" : "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {task.title}
          </p>
          {(task.dueDate || task.labelIds.length > 0 || task.subtaskCount > 0 || task.commentCount > 0 || (showProject && project) || task.assigneeId || task.recurrence) && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
              {task.dueDate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDuePicker(true);
                  }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "transparent", padding: 0, cursor: "pointer", fontSize: 11.5, fontWeight: 600, color: dueTone(task.dueDate), fontFamily: "var(--bw-font-sans)" }}
                >
                  <CalendarDays size={11} />
                  {formatDueLabel(task.dueDate, task.dueTime)}
                  {task.recurrence && <Repeat size={10} />}
                </button>
              )}
              {!task.dueDate && task.recurrence && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--bw-ink-soft)" }}>
                  <Repeat size={10} /> {task.recurrence.label}
                </span>
              )}
              {task.labelIds.map((id) => {
                const label = todo.labels.find((l) => l.id === id);
                if (!label) return null;
                return (
                  <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--bw-ink-soft)" }}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: label.color }} />
                    {label.name}
                  </span>
                );
              })}
              {task.subtaskCount > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--bw-ink-faint)" }}>
                  <CircleCheck size={11} />
                  {task.subtaskDone}/{task.subtaskCount}
                </span>
              )}
              {task.commentCount > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--bw-ink-faint)" }}>
                  <MessageSquare size={11} />
                  {task.commentCount}
                </span>
              )}
              {task.assigneeId && (
                <span
                  title={todo.memberName(task.assigneeId)}
                  style={{ width: 17, height: 17, borderRadius: 99, background: "var(--bw-blush)", color: "var(--bw-blush-ink)", fontSize: 8, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                >
                  {todo.memberName(task.assigneeId).split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </span>
              )}
              {showProject && project && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--bw-ink-faint)", marginLeft: "auto" }}>
                  <Hash size={10} style={{ color: project.color }} />
                  {project.name}
                </span>
              )}
            </div>
          )}
        </div>

        {/* hover actions */}
        <div className="bw-row-actions" onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 1, alignSelf: "center", position: "relative" }}>
          <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Schedule" style={{ width: 26, padding: 0 }} onClick={() => setDuePicker(true)}>
            <CalendarDays size={13} />
          </button>
          <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Priority" style={{ width: 26, padding: 0 }} onClick={() => setPrioPicker(true)}>
            <Flag size={13} style={{ color: task.priority < 4 ? pColor : undefined }} />
          </button>
          <BwMenu
            trigger={
              <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="More" style={{ width: 26, padding: 0 }}>
                ⋯
              </button>
            }
          >
            <button className="bw-menu-item" onClick={() => todo.openTask(task.id)}>Open</button>
            <button className="bw-menu-item" onClick={() => setMovePicker(true)}>Move to…</button>
            <button className="bw-menu-item" onClick={() => void todo.duplicateTask(task.id)}>Duplicate</button>
            <button className="bw-menu-item" onClick={() => todo.toggleSelect(task.id)}>{selected ? "Deselect" : "Select"}</button>
            <div className="bw-menu-sep" />
            <button className="bw-menu-item bw-menu-danger" onClick={() => void todo.removeTask(task.id)}>Remove</button>
          </BwMenu>

          {duePicker && (
            <DuePicker
              value={task.dueDate}
              time={task.dueTime}
              recurrence={task.recurrence}
              onClose={() => setDuePicker(false)}
              onChange={(d) => void todo.patchTask(task.id, d)}
            />
          )}
          {prioPicker && (
            <PriorityPicker value={task.priority} onClose={() => setPrioPicker(false)} onChange={(p) => void todo.patchTask(task.id, { priority: p })} />
          )}
          {movePicker && (
            <ProjectPicker onClose={() => setMovePicker(false)} onPick={(projectId, sectionId) => void todo.patchTask(task.id, { projectId, sectionId })} />
          )}
        </div>
      </div>
      <style jsx>{`
        .bw-task-row .bw-row-actions {
          opacity: 0;
          transition: opacity 120ms ease;
        }
        .bw-task-row:hover .bw-row-actions,
        .bw-task-row:focus-within .bw-row-actions {
          opacity: 1;
        }
        .bw-task-row:hover {
          background: ${selected ? "var(--bw-blush)" : "var(--bw-paper-sunken)"};
          border-radius: 8px;
        }
        @media (hover: none) {
          .bw-task-row .bw-row-actions {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Inline add row ──────────────────────────────────────────────────────────

export function InlineAdd({
  viewKey,
  defaults,
  placeholder = "Add a task…",
}: {
  viewKey: ViewKey;
  defaults?: Record<string, unknown>;
  placeholder?: string;
}) {
  const todo = useTodo();
  const [active, setActive] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const raw = text.trim();
    if (!raw) return;
    const parsed = parseQuickAdd(raw, todayInLondon());
    const project = parsed.projectToken
      ? todo.projects.find((p) => p.name.toLowerCase().startsWith(parsed.projectToken!.toLowerCase()))
      : null;
    setText("");
    await todo.addTask(
      {
        title: parsed.title,
        dueDate: parsed.dueDate ?? (defaults?.dueDate as string | undefined),
        dueTime: parsed.dueTime ?? undefined,
        recurrence: parsed.recurrence ?? undefined,
        priority: parsed.priority ?? undefined,
        projectId: project?.id ?? (defaults?.projectId as string | undefined),
        sectionId: project ? undefined : (defaults?.sectionId as string | undefined),
        parentId: defaults?.parentId as string | undefined,
      },
      viewKey
    );
    inputRef.current?.focus();
  }

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 10px 10px 18px", border: "none", background: "transparent", cursor: "pointer", color: "var(--bw-ink-faint)", fontSize: 13.5, fontFamily: "var(--bw-font-sans)", width: "100%", textAlign: "left" }}
      >
        <Plus size={15} style={{ color: "var(--bw-brand)" }} />
        {placeholder}
      </button>
    );
  }

  return (
    <div style={{ padding: "8px 10px 8px 18px", display: "flex", gap: 8, alignItems: "center" }}>
      <input
        ref={inputRef}
        className="bw-input bw-input-sm"
        placeholder='e.g. "Chase photographer friday 10am p2 #Launch"'
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
          if (e.key === "Escape") setActive(false);
        }}
        onBlur={() => {
          if (!text.trim()) setActive(false);
        }}
        style={{ flex: 1 }}
      />
      <button className="bw-btn bw-btn-primary bw-btn-sm" onClick={() => void submit()}>
        Add
      </button>
    </div>
  );
}

// ─── List with grouping + reorder ────────────────────────────────────────────

export function TaskList({
  viewKey,
  tasks,
  groupBy = "none",
  showProject = false,
  reorderable = false,
  inlineAddDefaults,
  emptyState,
}: {
  viewKey: ViewKey;
  tasks: TaskDto[];
  groupBy?: "none" | "date" | "priority" | "project";
  showProject?: boolean;
  reorderable?: boolean;
  inlineAddDefaults?: Record<string, unknown>;
  emptyState?: React.ReactNode;
}) {
  const todo = useTodo();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: null as string | null, tasks }];
    if (groupBy === "priority") {
      return [1, 2, 3, 4]
        .map((p) => ({ key: `p${p}`, label: p === 4 ? "No priority" : `Priority ${p}`, tasks: tasks.filter((t) => t.priority === p) }))
        .filter((g) => g.tasks.length);
    }
    if (groupBy === "project") {
      const map = new Map<string, TaskDto[]>();
      for (const t of tasks) {
        const k = t.projectId ?? "inbox";
        map.set(k, [...(map.get(k) ?? []), t]);
      }
      return [...map.entries()].map(([k, list]) => ({
        key: k,
        label: k === "inbox" ? "Inbox" : todo.projects.find((p) => p.id === k)?.name ?? "Project",
        tasks: list,
      }));
    }
    // date
    const map = new Map<string, TaskDto[]>();
    for (const t of tasks) {
      const k = t.dueDate ?? "none";
      map.set(k, [...(map.get(k) ?? []), t]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === "none" ? 1 : b === "none" ? -1 : a.localeCompare(b)))
      .map(([k, list]) => ({ key: k, label: k === "none" ? "No date" : formatDueLabel(k), tasks: list }));
  }, [tasks, groupBy, todo.projects]);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = tasks.map((t) => t.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, String(active.id));
    void todo.reorder(viewKey, next);
  }

  if (!tasks.length && emptyState) {
    return (
      <>
        {emptyState}
        {inlineAddDefaults !== undefined && <InlineAdd viewKey={viewKey} defaults={inlineAddDefaults} />}
      </>
    );
  }

  const body = groups.map((g) => (
    <div key={g.key}>
      {g.label && (
        <p className="bw-kicker" style={{ fontSize: 10.5, margin: "18px 0 4px", paddingLeft: 18 }}>
          {g.label}
          <span style={{ marginLeft: 8, color: "var(--bw-ink-faint)", fontWeight: 600 }}>{g.tasks.length}</span>
        </p>
      )}
      {g.tasks.map((t) => (
        <TaskRow key={t.id} task={t} viewKey={viewKey} showProject={showProject} draggable={reorderable && groupBy === "none"} />
      ))}
    </div>
  ));

  return (
    <div>
      {reorderable && groupBy === "none" ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {body}
          </SortableContext>
        </DndContext>
      ) : (
        body
      )}
      {inlineAddDefaults !== undefined && <InlineAdd viewKey={viewKey} defaults={inlineAddDefaults} />}
    </div>
  );
}
