"use client";

// TaskRow + TaskList — second-pass density. Compact 32px-ish rows, title-first
// hierarchy, metadata as quiet chips, scheduled time right-aligned, slide-out
// completion, hover-revealed actions, slim inline add. Grouping and dnd-kit
// reorder preserved.

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
import { extractFirstName } from "@/lib/contacts/displayName";
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
  showTimeRight = false,
}: {
  task: TaskDto;
  viewKey: ViewKey;
  showProject?: boolean;
  draggable?: boolean;
  depth?: number;
  showTimeRight?: boolean;
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
  const hasMeta =
    task.dueDate || task.labelIds.length > 0 || task.subtaskCount > 0 || task.commentCount > 0 ||
    (showProject && project) || task.assigneeId || task.recurrence;

  function complete() {
    if (done) {
      void todo.completeTask(task.id, false);
      return;
    }
    setChecking(true);
    setTimeout(() => {
      void todo.completeTask(task.id, true);
      setChecking(false);
    }, 170);
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
        className={`bw-task-row-base${checking && !done ? " bw-row-leaving" : ""}`}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey) {
            todo.toggleSelect(task.id);
            return;
          }
          todo.openTask(task.id);
        }}
        style={{
          marginLeft: depth * 24,
          background: selected ? "var(--bw-blush)" : undefined,
        }}
      >
        {/* drag handle */}
        <span
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="bw-row-actions"
          style={{
            width: 12,
            alignSelf: "center",
            color: "var(--bw-ink-faint)",
            cursor: draggable ? "grab" : "default",
            visibility: draggable ? undefined : "hidden",
            display: "flex",
            touchAction: "none",
          }}
        >
          <GripVertical size={12} />
        </span>

        {/* complete checkbox */}
        <button
          aria-label={done ? "Reopen task" : "Complete task"}
          onClick={(e) => {
            e.stopPropagation();
            complete();
          }}
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            flexShrink: 0,
            marginTop: 2,
            border: `1.6px solid ${pColor}`,
            background: done || checking ? pColor : task.priority < 4 ? `color-mix(in srgb, ${pColor} 10%, transparent)` : "transparent",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "background 140ms ease, transform 140ms ease",
            transform: checking ? "scale(1.18)" : "none",
          }}
        >
          {(done || checking) && <Check size={10} strokeWidth={3.4} />}
        </button>

        {/* body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                fontWeight: 550,
                lineHeight: 1.45,
                color: done ? "var(--bw-ink-faint)" : "var(--bw-ink)",
                textDecoration: done ? "line-through" : "none",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
                minWidth: 0,
              }}
            >
              {task.title}
            </p>
            {showTimeRight && task.dueTime && (
              <span style={{ fontSize: 11.5, fontWeight: 650, color: "var(--bw-ink-soft)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                {task.dueTime}
              </span>
            )}
          </div>
          {hasMeta && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 2, flexWrap: "wrap" }}>
              {task.dueDate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDuePicker(true);
                  }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 3.5, border: "none", background: "transparent", padding: 0, cursor: "pointer", fontSize: 11, fontWeight: 600, color: dueTone(task.dueDate), fontFamily: "var(--bw-font-sans)" }}
                >
                  <CalendarDays size={10.5} />
                  {formatDueLabel(task.dueDate, showTimeRight ? null : task.dueTime)}
                  {task.recurrence && <Repeat size={9.5} />}
                </button>
              )}
              {!task.dueDate && task.recurrence && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3.5, fontSize: 11, color: "var(--bw-ink-soft)" }}>
                  <Repeat size={9.5} /> {task.recurrence.label}
                </span>
              )}
              {task.labelIds.map((id) => {
                const label = todo.labels.find((l) => l.id === id);
                if (!label) return null;
                return (
                  <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 3.5, fontSize: 10.5, fontWeight: 550, color: "var(--bw-ink-soft)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: label.color }} />
                    {label.name}
                  </span>
                );
              })}
              {task.subtaskCount > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3.5, fontSize: 10.5, color: "var(--bw-ink-faint)" }}>
                  <CircleCheck size={10.5} />
                  {task.subtaskDone}/{task.subtaskCount}
                </span>
              )}
              {task.commentCount > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3.5, fontSize: 10.5, color: "var(--bw-ink-faint)" }}>
                  <MessageSquare size={10.5} />
                  {task.commentCount}
                </span>
              )}
              {task.completedAt && task.completedById && (
                <span style={{ fontSize: 10.5, color: "var(--bw-ink-faint)" }}>
                  done by {extractFirstName(todo.memberName(task.completedById)) || "someone"}
                </span>
              )}
              {task.assigneeId && (
                <span
                  title={todo.memberName(task.assigneeId)}
                  style={{ width: 15, height: 15, borderRadius: 99, background: "var(--bw-blush)", color: "var(--bw-blush-ink)", fontSize: 7, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                >
                  {todo.memberName(task.assigneeId).split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </span>
              )}
              {showProject && project && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 550, color: "var(--bw-ink-faint)", marginLeft: "auto", background: "var(--bw-paper-sunken)", borderRadius: 999, padding: "1.5px 8px" }}>
                  <Hash size={9} style={{ color: project.color }} />
                  {project.name}
                </span>
              )}
            </div>
          )}
        </div>

        {/* hover actions */}
        <div className="bw-row-actions" onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 0, alignSelf: "center", position: "relative" }}>
          <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Schedule" style={{ width: 25, height: 25, padding: 0 }} onClick={() => setDuePicker(true)}>
            <CalendarDays size={12.5} />
          </button>
          <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Priority" style={{ width: 25, height: 25, padding: 0 }} onClick={() => setPrioPicker(true)}>
            <Flag size={12.5} style={{ color: task.priority < 4 ? pColor : undefined }} />
          </button>
          <BwMenu
            trigger={
              <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="More" style={{ width: 25, height: 25, padding: 0 }}>
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
    </div>
  );
}

// ─── Inline add row ──────────────────────────────────────────────────────────

export function InlineAdd({
  viewKey,
  defaults,
  placeholder = "Add task",
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
        className="bw-inline-add"
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px 7px 14px", border: "none", background: "transparent", cursor: "pointer", color: "var(--bw-ink-faint)", fontSize: 12.5, fontWeight: 550, fontFamily: "var(--bw-font-sans)", width: "100%", textAlign: "left", borderRadius: 8 }}
      >
        <Plus size={13} style={{ color: "var(--bw-brand)" }} />
        {placeholder}
      </button>
    );
  }

  return (
    <div style={{ padding: "6px 8px 6px 14px", display: "flex", gap: 7, alignItems: "center" }}>
      <input
        ref={inputRef}
        className="bw-input bw-input-sm"
        placeholder='Try "Chase photographer friday 10am p2"'
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
  showTimeRight = false,
}: {
  viewKey: ViewKey;
  tasks: TaskDto[];
  groupBy?: "none" | "date" | "priority" | "project";
  showProject?: boolean;
  reorderable?: boolean;
  inlineAddDefaults?: Record<string, unknown>;
  emptyState?: React.ReactNode;
  showTimeRight?: boolean;
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
        <p className="bw-kicker" style={{ fontSize: 10, margin: "14px 0 2px", paddingLeft: 14, display: "flex", alignItems: "baseline", gap: 7 }}>
          {g.label}
          <span style={{ color: "var(--bw-ink-faint)", fontWeight: 600 }}>{g.tasks.length}</span>
        </p>
      )}
      {g.tasks.map((t) => (
        <TaskRow key={t.id} task={t} viewKey={viewKey} showProject={showProject} draggable={reorderable && groupBy === "none"} showTimeRight={showTimeRight} />
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
