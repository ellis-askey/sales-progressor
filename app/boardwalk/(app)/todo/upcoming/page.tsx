"use client";

// Upcoming — the next weeks as a chronological schedule or a month calendar.
// Chronological: date-grouped lists with quick-add on each day. Calendar:
// month grid where each day shows its tasks and clicking a day adds one;
// tasks can be dragged onto another day to reschedule.

import { useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CalendarRange } from "lucide-react";
import { useTodo } from "@/components/boardwalk/todo/TodoProvider";
import { InlineAdd, TaskRow } from "@/components/boardwalk/todo/TaskList";
import { EmptyNote, ViewHeader, ViewShell } from "@/components/boardwalk/todo/ViewHeader";
import { addDays, daysInMonth, isoWeekday, todayInLondon, toParts } from "@/lib/todo/recurrence";
import { formatDueLabel } from "@/components/boardwalk/todo/Pickers";
import type { TaskDto } from "@/lib/todo/types";

export default function UpcomingPage() {
  const todo = useTodo();
  const today = todayInLondon();
  const [mode, setMode] = useState<"list" | "calendar">(() => (todo.prefs.upcomingMode as "list" | "calendar") ?? "list");
  const [anchor, setAnchor] = useState(today); // list: window start · calendar: any day in month
  const from = mode === "list" ? anchor : `${anchor.slice(0, 7)}-01`;
  const to = mode === "list" ? addDays(anchor, 27) : addDays(`${anchor.slice(0, 7)}-${String(daysInMonth(toParts(anchor).y, toParts(anchor).m)).padStart(2, "0")}`, 0);
  const viewKey = `upcoming:${from}:${to}`;
  const tasks = todo.views[viewKey];

  useEffect(() => {
    void todo.loadView(viewKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  const byDate = useMemo(() => {
    const map = new Map<string, TaskDto[]>();
    for (const t of tasks ?? []) {
      if (!t.dueDate) continue;
      map.set(t.dueDate, [...(map.get(t.dueDate) ?? []), t]);
    }
    return map;
  }, [tasks]);

  function setMode2(m: "list" | "calendar") {
    setMode(m);
    todo.savePrefs({ upcomingMode: m });
  }

  return (
    <ViewShell wide={mode === "calendar"}>
      <ViewHeader
        kicker="Schedule"
        title="Upcoming"
        meta={tasks === undefined ? "Loading…" : `${tasks.length} scheduled task${tasks.length === 1 ? "" : "s"} in view`}
        actions={
          <>
            <div className="bw-seg">
              <button data-active={mode === "list"} onClick={() => setMode2("list")}>List</button>
              <button data-active={mode === "calendar"} onClick={() => setMode2("calendar")}>Calendar</button>
            </div>
            <div className="bw-seg">
              <button onClick={() => setAnchor(mode === "list" ? addDays(anchor, -28) : addDays(`${anchor.slice(0, 7)}-01`, -1))}>‹</button>
              <button onClick={() => setAnchor(today)}>Today</button>
              <button onClick={() => setAnchor(mode === "list" ? addDays(anchor, 28) : addDays(to, 1))}>›</button>
            </div>
          </>
        }
      />

      {mode === "list" ? (
        <ListMode viewKey={viewKey} from={from} byDate={byDate} loading={tasks === undefined} />
      ) : (
        <CalendarMode viewKey={viewKey} monthAnchor={anchor} byDate={byDate} />
      )}
    </ViewShell>
  );
}

function ListMode({ viewKey, from, byDate, loading }: { viewKey: string; from: string; byDate: Map<string, TaskDto[]>; loading: boolean }) {
  const today = todayInLondon();
  const days = Array.from({ length: 28 }, (_, i) => addDays(from, i));
  const total = [...byDate.values()].reduce((n, l) => n + l.length, 0);

  if (!loading && total === 0) {
    return <EmptyNote icon={<CalendarRange size={22} />} title="A clear month ahead." hint="Tasks with due dates appear here, day by day. Add one on any date below." />;
  }

  return (
    <div>
      {days.map((date) => {
        const list = byDate.get(date) ?? [];
        const weekend = isoWeekday(date) > 5;
        if (!list.length && weekend) return null;
        return (
          <section key={date} className="bw-day-section" style={{ marginBottom: 2 }}>
            <p className="bw-kicker" style={{ fontSize: 10, margin: "12px 0 1px", color: date === today ? "var(--bw-sage-ink)" : undefined, display: "flex", alignItems: "baseline", gap: 6 }}>
              {formatDueLabel(date)}
              <span style={{ fontWeight: 600, color: "var(--bw-ink-faint)", textTransform: "none", letterSpacing: "0.02em" }}>
                {new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })}
              </span>
              {list.length > 0 && <span style={{ color: "var(--bw-ink-faint)" }}>{list.length}</span>}
            </p>
            {list.map((t) => (
              <TaskRow key={t.id} task={t} viewKey={viewKey} showProject showTimeRight />
            ))}
            <InlineAdd viewKey={viewKey} defaults={{ dueDate: date }} placeholder="Add" />
          </section>
        );
      })}
    </div>
  );
}

// ─── Calendar mode with drag-to-reschedule ───────────────────────────────────

let _projects: { id: string; color: string }[] = [];
function projectColor(task: TaskDto): string {
  const p = task.projectId ? _projects.find((x) => x.id === task.projectId) : null;
  if (p) return p.color;
  return task.priority === 1 ? "var(--bw-red)" : task.priority === 2 ? "var(--bw-amber)" : "var(--bw-sage)";
}

function DraggableChip({ task }: { task: TaskDto }) {
  const todo = useTodo();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => todo.openTask(task.id)}
      title={task.title}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border: "none",
        borderLeft: `3px solid ${projectColor(task)}`,
        background: "var(--bw-paper-sunken)",
        borderRadius: 6,
        padding: "3px 7px",
        fontSize: 11,
        fontWeight: 550,
        color: "var(--bw-ink)",
        cursor: "grab",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontFamily: "var(--bw-font-sans)",
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        opacity: isDragging ? 0.6 : 1,
        position: isDragging ? "relative" : undefined,
        zIndex: isDragging ? 50 : undefined,
      }}
    >
      {task.dueTime && <span style={{ color: "var(--bw-ink-faint)", marginRight: 4 }}>{task.dueTime}</span>}
      {task.title}
    </button>
  );
}

function DayCell({ date, inMonth, tasks }: { date: string; inMonth: boolean; tasks: TaskDto[] }) {
  const todo = useTodo();
  const today = todayInLondon();
  const { setNodeRef, isOver } = useDroppable({ id: date });
  const day = Number(date.slice(8));
  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: 108,
        border: "1px solid var(--bw-line)",
        borderRadius: 10,
        padding: 6,
        background: isOver ? "var(--bw-blush)" : inMonth ? "var(--bw-paper-raised)" : "var(--bw-paper)",
        opacity: inMonth ? 1 : 0.55,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        transition: "background 120ms ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: date === today ? 800 : 600,
            color: date === today ? "#fff" : date < today ? "var(--bw-ink-faint)" : "var(--bw-ink-soft)",
            background: date === today ? "var(--bw-brand)" : "transparent",
            borderRadius: 999,
            minWidth: 20,
            height: 20,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 5px",
          }}
        >
          {day}
        </span>
        <button
          aria-label={`Add task on ${date}`}
          className="bw-btn bw-btn-ghost bw-btn-sm"
          style={{ width: 20, height: 20, padding: 0, fontSize: 13 }}
          onClick={() => todo.openQuickAdd({ dueDate: date })}
        >
          +
        </button>
      </div>
      {tasks.slice(0, 4).map((t) => (
        <DraggableChip key={t.id} task={t} />
      ))}
      {tasks.length > 4 && <span style={{ fontSize: 10, color: "var(--bw-ink-faint)", paddingLeft: 2 }}>+ {tasks.length - 4} more</span>}
    </div>
  );
}

function CalendarMode({ viewKey, monthAnchor, byDate }: { viewKey: string; monthAnchor: string; byDate: Map<string, TaskDto[]> }) {
  const todo = useTodo();
  _projects = todo.projects;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const month = monthAnchor.slice(0, 7);
  const first = `${month}-01`;
  const { y, m } = toParts(first);
  const days = daysInMonth(y, m);
  const lead = isoWeekday(first) - 1;
  const cells: { date: string; inMonth: boolean }[] = [];
  for (let i = lead; i > 0; i--) cells.push({ date: addDays(first, -i), inMonth: false });
  for (let i = 0; i < days; i++) cells.push({ date: addDays(first, i), inMonth: true });
  while (cells.length % 7 !== 0) cells.push({ date: addDays(first, days + (cells.length - lead - days)), inMonth: false });

  function onDragEnd(e: DragEndEvent) {
    const taskId = String(e.active.id);
    const date = e.over ? String(e.over.id) : null;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    void todo.patchTask(taskId, { dueDate: date });
  }

  return (
    <div>
      <p className="bw-display" style={{ fontSize: 18, margin: "0 0 10px" }}>
        {new Date(`${first}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 4 }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d} className="bw-kicker" style={{ fontSize: 9.5, textAlign: "center" }}>{d}</span>
        ))}
      </div>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {cells.map((c) => (
            <DayCell key={c.date} date={c.date} inMonth={c.inMonth} tasks={byDate.get(c.date) ?? []} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
