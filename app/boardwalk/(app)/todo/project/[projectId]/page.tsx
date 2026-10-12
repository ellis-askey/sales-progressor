"use client";

// Project workspace: list (sections + reorder), board (sections as kanban
// columns, drag between), calendar (due-date grid). The chosen view is
// remembered per project. Header: favourite, members, share, edit, duplicate,
// save as template, archive.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { Hash, Star, Plus, UserPlus } from "lucide-react";
import { useTodo } from "@/components/boardwalk/todo/TodoProvider";
import { InlineAdd, TaskList, TaskRow } from "@/components/boardwalk/todo/TaskList";
import { ViewHeader, ViewShell, EmptyNote } from "@/components/boardwalk/todo/ViewHeader";
import { ProjectModal, ShareModal } from "@/components/boardwalk/todo/ProjectModal";
import { BwButton, BwMenu, useBwToast } from "@/components/boardwalk/ui";
import { formsApi } from "@/lib/forms/client";
import type { TaskDto } from "@/lib/todo/types";
import { daysInMonth, isoWeekday, todayInLondon, toParts, addDays } from "@/lib/todo/recurrence";

type ProjectView = "list" | "board" | "calendar";

export default function ProjectPage() {
  const todo = useTodo();
  const router = useRouter();
  const { toast } = useBwToast();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const viewKey = `project:${projectId}`;
  const project = todo.projects.find((p) => p.id === projectId);
  const tasks = todo.views[viewKey];
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [sectionName, setSectionName] = useState("");
  // Optimistic view override — switching views must be instant; the saved
  // preference catches up in the background.
  const [localView, setLocalView] = useState<ProjectView | null>(null);

  const view: ProjectView = localView ?? (project?.viewPref as ProjectView) ?? "list";

  useEffect(() => {
    void todo.loadView(viewKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  const setView = (v: ProjectView) => {
    setLocalView(v);
    void formsApi(`/api/todo/projects/${projectId}/membership`, {
      method: "POST",
      body: JSON.stringify({ viewPref: v }),
    })
      .then(() => todo.refreshBootstrap())
      .catch(() => {});
  };

  const toggleFavourite = () => {
    void formsApi(`/api/todo/projects/${projectId}/membership`, {
      method: "POST",
      body: JSON.stringify({ isFavorite: !project?.isFavorite }),
    }).then(() => todo.refreshBootstrap());
  };

  async function projectAction(action: "duplicate" | "template" | "archive") {
    try {
      if (action === "duplicate") {
        const res = await formsApi<{ project: { id: string } }>(`/api/todo/projects/${projectId}/duplicate`, { method: "POST", body: JSON.stringify({}) });
        await todo.refreshBootstrap();
        router.push(`/boardwalk/todo/project/${res.project.id}`);
      } else if (action === "template") {
        await formsApi(`/api/todo/projects/${projectId}/duplicate`, { method: "POST", body: JSON.stringify({ asTemplate: true, name: project?.name }) });
        await todo.refreshBootstrap();
        toast("Saved as a template. Find it when creating a new project.");
      } else {
        await formsApi(`/api/todo/projects/${projectId}`, { method: "PATCH", body: JSON.stringify({ archived: true }) });
        await todo.refreshBootstrap();
        toast("Project archived.");
        router.push("/boardwalk/todo/today");
      }
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function addSection() {
    const name = sectionName.trim();
    if (!name) return;
    setSectionName("");
    setAddingSection(false);
    await formsApi(`/api/todo/projects/${projectId}/sections`, { method: "POST", body: JSON.stringify({ name }) });
    await todo.refreshBootstrap();
  }

  if (!todo.ready) return <ViewShell><p className="bw-hint" style={{ padding: 30 }}>Loading…</p></ViewShell>;
  if (!project) return <ViewShell><EmptyNote icon={<Hash size={22} />} title="Project not found" hint="It may have been archived or removed." /></ViewShell>;

  const active = (tasks ?? []).filter((t) => !t.completedAt);

  return (
    <ViewShell wide={view !== "list"}>
      <ViewHeader
        kicker={project.visibility === "private" ? "Private project" : project.memberIds.length > 1 ? "Shared project" : "Project"}
        title={project.name}
        meta={`${active.length} open task${active.length === 1 ? "" : "s"}${project.description ? ` · ${project.description}` : ""}`}
        actions={
          <>
            <button
              className="bw-btn bw-btn-ghost bw-btn-sm"
              aria-label={project.isFavorite ? "Remove from favourites" : "Add to favourites"}
              style={{ width: 30, padding: 0 }}
              onClick={toggleFavourite}
            >
              <Star size={15} fill={project.isFavorite ? "var(--bw-amber)" : "none"} style={{ color: project.isFavorite ? "var(--bw-amber)" : undefined }} />
            </button>
            <button className="bw-btn bw-btn-ghost bw-btn-sm" onClick={() => setShareOpen(true)}>
              <UserPlus size={14} /> {project.memberIds.length > 1 ? `${project.memberIds.length} people` : "Share"}
            </button>
            <div className="bw-seg">
              {(["list", "board", "calendar"] as const).map((v) => (
                <button key={v} data-active={view === v} onClick={() => setView(v)} style={{ textTransform: "capitalize" }}>
                  {v}
                </button>
              ))}
            </div>
            <BwMenu
              trigger={<button className="bw-btn bw-btn-secondary bw-btn-sm" aria-label="Project actions" style={{ width: 30, padding: 0 }}>⋯</button>}
            >
              <button className="bw-menu-item" onClick={() => setEditOpen(true)}>Edit project</button>
              <button className="bw-menu-item" onClick={() => setAddingSection(true)}>Add section</button>
              <button className="bw-menu-item" onClick={() => void projectAction("duplicate")}>Duplicate</button>
              <button className="bw-menu-item" onClick={() => void projectAction("template")}>Save as template</button>
              <div className="bw-menu-sep" />
              <button className="bw-menu-item bw-menu-danger" onClick={() => void projectAction("archive")}>Archive</button>
            </BwMenu>
          </>
        }
      />

      {addingSection && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, maxWidth: 380 }}>
          <input
            className="bw-input bw-input-sm"
            placeholder="Section name"
            value={sectionName}
            autoFocus
            onChange={(e) => setSectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void addSection();
              if (e.key === "Escape") setAddingSection(false);
            }}
          />
          <BwButton size="sm" variant="primary" onClick={() => void addSection()}>Add</BwButton>
        </div>
      )}

      {view === "list" && <ListView projectId={projectId} viewKey={viewKey} tasks={active} />}
      {view === "board" && <BoardView projectId={projectId} viewKey={viewKey} tasks={active} />}
      {view === "calendar" && <ProjectCalendar viewKey={viewKey} tasks={active} projectId={projectId} />}

      {editOpen && <ProjectModal existing={project} onClose={() => setEditOpen(false)} onCreated={() => setEditOpen(false)} />}
      {shareOpen && <ShareModal project={project} onClose={() => setShareOpen(false)} />}
    </ViewShell>
  );
}

// ─── List ────────────────────────────────────────────────────────────────────

function ListView({ projectId, viewKey, tasks }: { projectId: string; viewKey: string; tasks: TaskDto[] }) {
  const todo = useTodo();
  const { toast } = useBwToast();
  const project = todo.projects.find((p) => p.id === projectId)!;
  const unsectioned = tasks.filter((t) => !t.sectionId);

  async function renameSection(sectionId: string, current: string) {
    const name = window.prompt("Section name", current);
    if (!name?.trim() || name === current) return;
    await formsApi(`/api/todo/sections/${sectionId}`, { method: "PATCH", body: JSON.stringify({ name }) });
    await todo.refreshBootstrap();
  }

  async function removeSection(sectionId: string) {
    await formsApi(`/api/todo/sections/${sectionId}`, { method: "DELETE" });
    await todo.refreshBootstrap();
    void todo.loadView(viewKey, true);
    toast("Section removed. Its tasks stay in the project.");
  }

  return (
    <div>
      {unsectioned.length > 0 || project.sections.length === 0 ? (
        <TaskList
          viewKey={viewKey}
          tasks={unsectioned}
          reorderable
          inlineAddDefaults={{ projectId }}
          emptyState={project.sections.length === 0 ? <EmptyNote icon={<Hash size={22} />} title="An empty project." hint="Add the first task below, or create sections to give it structure." /> : null}
        />
      ) : null}
      {project.sections.map((s) => {
        const sectionTasks = tasks.filter((t) => t.sectionId === s.id);
        return (
          <section key={s.id} style={{ marginTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <p className="bw-kicker" style={{ fontSize: 10.5, margin: 0 }}>
                {s.name} <span style={{ color: "var(--bw-ink-faint)", marginLeft: 6 }}>{sectionTasks.length}</span>
              </p>
              <BwMenu
                trigger={<button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Section actions" style={{ width: 22, height: 20, padding: 0, fontSize: 11 }}>⋯</button>}
              >
                <button className="bw-menu-item" onClick={() => void renameSection(s.id, s.name)}>Rename</button>
                <button className="bw-menu-item bw-menu-danger" onClick={() => void removeSection(s.id)}>Remove section</button>
              </BwMenu>
            </div>
            {sectionTasks.map((t) => (
              <TaskRow key={t.id} task={t} viewKey={viewKey} />
            ))}
            <InlineAdd viewKey={viewKey} defaults={{ projectId, sectionId: s.id }} />
          </section>
        );
      })}
    </div>
  );
}

// ─── Board ───────────────────────────────────────────────────────────────────

function BoardCard({ task }: { task: TaskDto }) {
  const todo = useTodo();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => todo.openTask(task.id)}
      className="bw-card"
      style={{
        padding: "10px 12px",
        cursor: "grab",
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        opacity: isDragging ? 0.65 : 1,
        zIndex: isDragging ? 60 : undefined,
        position: "relative",
        borderLeft: task.priority < 4 ? `3px solid ${task.priority === 1 ? "var(--bw-red)" : task.priority === 2 ? "var(--bw-amber)" : "#3b6ea5"}` : undefined,
      }}
    >
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.4 }}>{task.title}</p>
      <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
        {task.dueDate && (
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--bw-ink-soft)" }}>
            {new Date(`${task.dueDate}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
          </span>
        )}
        {task.subtaskCount > 0 && (
          <span style={{ fontSize: 11, color: "var(--bw-ink-faint)" }}>{task.subtaskDone}/{task.subtaskCount}</span>
        )}
        {task.assigneeId && (
          <span style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: 99, background: "var(--bw-blush)", color: "var(--bw-blush-ink)", fontSize: 8, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            {memberInitials(task.assigneeId)}
          </span>
        )}
      </div>
    </div>
  );
}

// Module-level member lookup so board cards can render initials without threading props
let _memberCache: { id: string; name: string }[] = [];
function memberInitials(id: string) {
  const m = _memberCache.find((x) => x.id === id);
  return (m?.name ?? "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function BoardColumn({ id, title, tasks, projectId, viewKey }: { id: string; title: string; tasks: TaskDto[]; projectId: string; viewKey: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        width: 280,
        flexShrink: 0,
        background: isOver ? "var(--bw-blush)" : "var(--bw-paper-sunken)",
        borderRadius: 14,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxHeight: "100%",
        transition: "background 130ms ease",
      }}
    >
      <p className="bw-kicker" style={{ fontSize: 10, margin: "2px 4px 2px" }}>
        {title} <span style={{ color: "var(--bw-ink-faint)", marginLeft: 5 }}>{tasks.length}</span>
      </p>
      <div className="bw-scroll" style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        {tasks.map((t) => (
          <BoardCard key={t.id} task={t} />
        ))}
      </div>
      <InlineAdd viewKey={viewKey} defaults={{ projectId, sectionId: id === "none" ? undefined : id }} placeholder="Add task" />
    </div>
  );
}

function BoardView({ projectId, viewKey, tasks }: { projectId: string; viewKey: string; tasks: TaskDto[] }) {
  const todo = useTodo();
  _memberCache = todo.members;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const project = todo.projects.find((p) => p.id === projectId)!;

  function onDragEnd(e: DragEndEvent) {
    const taskId = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;
    const sectionId = over === "none" ? null : over;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.sectionId === sectionId) return;
    void todo.patchTask(taskId, { sectionId, projectId });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="bw-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 14, alignItems: "flex-start", minHeight: 420 }}>
        <BoardColumn id="none" title="No section" tasks={tasks.filter((t) => !t.sectionId)} projectId={projectId} viewKey={viewKey} />
        {project.sections.map((s) => (
          <BoardColumn key={s.id} id={s.id} title={s.name} tasks={tasks.filter((t) => t.sectionId === s.id)} projectId={projectId} viewKey={viewKey} />
        ))}
      </div>
    </DndContext>
  );
}

// ─── Calendar (project-scoped month grid) ───────────────────────────────────

function ProjectCalendar({ viewKey, tasks, projectId }: { viewKey: string; tasks: TaskDto[]; projectId: string }) {
  const todo = useTodo();
  const today = todayInLondon();
  const [month, setMonth] = useState(today.slice(0, 7));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byDate = useMemo(() => {
    const map = new Map<string, TaskDto[]>();
    for (const t of tasks) if (t.dueDate) map.set(t.dueDate, [...(map.get(t.dueDate) ?? []), t]);
    return map;
  }, [tasks]);

  const first = `${month}-01`;
  const { y, m } = toParts(first);
  const total = daysInMonth(y, m);
  const lead = isoWeekday(first) - 1;
  const cells: { date: string; inMonth: boolean }[] = [];
  for (let i = lead; i > 0; i--) cells.push({ date: addDays(first, -i), inMonth: false });
  for (let i = 0; i < total; i++) cells.push({ date: addDays(first, i), inMonth: true });
  while (cells.length % 7 !== 0) cells.push({ date: addDays(cells[cells.length - 1].date, 1), inMonth: false });

  const Cell = useCallback(
    function Cell({ date, inMonth }: { date: string; inMonth: boolean }) {
      const { setNodeRef, isOver } = useDroppable({ id: date });
      const list = byDate.get(date) ?? [];
      return (
        <div ref={setNodeRef} style={{ minHeight: 100, border: "1px solid var(--bw-line)", borderRadius: 10, padding: 6, background: isOver ? "var(--bw-blush)" : inMonth ? "var(--bw-paper-raised)" : "var(--bw-paper)", opacity: inMonth ? 1 : 0.5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: date === today ? 800 : 600, color: date === today ? "var(--bw-brand)" : "var(--bw-ink-soft)" }}>{Number(date.slice(8))}</span>
            <button aria-label={`Add task on ${date}`} className="bw-btn bw-btn-ghost bw-btn-sm" style={{ width: 18, height: 18, padding: 0, fontSize: 12 }} onClick={() => todo.openQuickAdd({ dueDate: date, projectId })}>+</button>
          </div>
          {list.slice(0, 3).map((t) => (
            <CalChip key={t.id} task={t} />
          ))}
          {list.length > 3 && <span style={{ fontSize: 10, color: "var(--bw-ink-faint)" }}>+ {list.length - 3}</span>}
        </div>
      );
    },
    [byDate, projectId, today, todo]
  );

  function onDragEnd(e: DragEndEvent) {
    const over = e.over ? String(e.over.id) : null;
    if (!over || !/^\d{4}-\d{2}-\d{2}$/.test(over)) return;
    void todo.patchTask(String(e.active.id), { dueDate: over });
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <button className="bw-btn bw-btn-secondary bw-btn-sm" onClick={() => setMonth(addDays(first, -1).slice(0, 7))}>‹</button>
        <p className="bw-display" style={{ fontSize: 17, margin: 0 }}>
          {new Date(`${first}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}
        </p>
        <button className="bw-btn bw-btn-secondary bw-btn-sm" onClick={() => setMonth(addDays(`${month}-${String(total).padStart(2, "0")}`, 1).slice(0, 7))}>›</button>
      </div>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {cells.map((c) => (
            <Cell key={c.date} date={c.date} inMonth={c.inMonth} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function CalChip({ task }: { task: TaskDto }) {
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
        display: "block", width: "100%", textAlign: "left", border: "none",
        background: "var(--bw-paper-sunken)", borderRadius: 6, padding: "3px 7px",
        fontSize: 10.5, fontWeight: 550, color: "var(--bw-ink)", cursor: "grab",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        fontFamily: "var(--bw-font-sans)", marginBottom: 3,
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        opacity: isDragging ? 0.6 : 1, position: isDragging ? "relative" : undefined, zIndex: isDragging ? 50 : undefined,
      }}
    >
      {task.title}
    </button>
  );
}
