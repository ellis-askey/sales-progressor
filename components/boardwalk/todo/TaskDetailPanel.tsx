"use client";

// Task detail — a right-hand panel (full-screen sheet on mobile) that edits
// everything about a task without losing your place: title, description,
// project/section, due date, priority, labels, assignee, reminders,
// subtasks, comments with @mentions, attachments, and the activity history.
// Field edits save on change via the optimistic store.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, CalendarDays, Flag, Hash, Tag, UserRound, Bell, Paperclip, Repeat,
  Check, ChevronRight, Trash2, Copy,
} from "lucide-react";
import { formsApi } from "@/lib/forms/client";
import type { ActivityDto, AttachmentDto, CommentDto, ReminderDto, TaskDto } from "@/lib/todo/types";
import { useTodo } from "./TodoProvider";
import { useBwToast, BwButton, BwMenu } from "../ui";
import { AssigneePicker, DuePicker, LabelPicker, PriorityPicker, ProjectPicker, PRIORITY_COLORS, dueTone, formatDueLabel } from "./Pickers";
import { InlineAdd, TaskRow } from "./TaskList";

interface Detail {
  task: TaskDto;
  subtasks: TaskDto[];
  comments: CommentDto[];
  attachments: AttachmentDto[];
  reminders: ReminderDto[];
  activity: ActivityDto[];
}

export function TaskDetailPanel({ taskId, onClose, narrow }: { taskId: string; onClose: () => void; narrow: boolean }) {
  const todo = useTodo();
  const { toast } = useBwToast();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [picker, setPicker] = useState<"due" | "priority" | "project" | "labels" | "assignee" | "reminder" | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [comment, setComment] = useState("");
  const [showActivity, setShowActivity] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const d = await formsApi<Detail>(`/api/todo/tasks/${taskId}`);
      setDetail(d);
      setTitle(d.task.title);
      setDescription(d.task.description ?? "");
    } catch {
      toast("That task is no longer available.", "error");
      onClose();
    }
  }, [taskId, onClose, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !picker) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, picker]);

  const task = detail?.task;

  async function patch(patchData: Parameters<typeof todo.patchTask>[1]) {
    const updated = await todo.patchTask(taskId, patchData);
    if (updated) setDetail((d) => (d ? { ...d, task: updated } : d));
  }

  async function saveTitle() {
    if (task && title.trim() && title !== task.title) await patch({ title });
  }
  async function saveDescription() {
    if (task && (task.description ?? "") !== description) await patch({ description: description || null });
  }

  async function submitComment() {
    const body = comment.trim();
    if (!body) return;
    setComment("");
    try {
      await formsApi(`/api/todo/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ body }) });
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function uploadAttachment(file: File) {
    const data = new FormData();
    data.append("file", file);
    try {
      const res = await fetch(`/api/todo/tasks/${taskId}/attachments`, { method: "POST", body: data });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Upload failed.");
      await load();
      toast("Attached.");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function openAttachment(id: string) {
    try {
      const res = await formsApi<{ url: string }>(`/api/todo/attachments/${id}`);
      window.open(res.url, "_blank", "noopener");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function addReminder(offsetMinutes: number | null, custom?: string) {
    try {
      await formsApi(`/api/todo/tasks/${taskId}/reminders`, {
        method: "POST",
        body: JSON.stringify(offsetMinutes === null ? { remindAt: custom } : { offsetMinutes }),
      });
      await load();
      setPicker(null);
      toast("Reminder set.");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  if (typeof document === "undefined") return null;

  const project = task?.projectId ? todo.projects.find((p) => p.id === task.projectId) : null;
  const pColor = PRIORITY_COLORS[task?.priority ?? 4];

  const fieldBtn = (key: typeof picker, icon: React.ReactNode, label: string, tone?: string) => (
    <div style={{ position: "relative" }}>
      <button
        className="bw-btn bw-btn-secondary bw-btn-sm"
        style={{ color: tone, borderColor: "var(--bw-line)" }}
        onClick={() => setPicker(picker === key ? null : key)}
      >
        {icon} {label}
      </button>
    </div>
  );

  return createPortal(
    <div className="bw-scope">
      <div className="bw-backdrop" style={{ background: narrow ? "rgba(43,48,50,0.5)" : "rgba(43,48,50,0.18)" }} onClick={onClose} />
      <aside
        role="dialog"
        aria-label="Task details"
        className="bw-fade-up bw-scroll"
        style={{
          position: "fixed",
          top: narrow ? "auto" : 0,
          bottom: 0,
          right: 0,
          left: narrow ? 0 : "auto",
          width: narrow ? "100%" : "min(560px, 92vw)",
          height: narrow ? "92dvh" : "100dvh",
          background: "var(--bw-paper-raised)",
          borderLeft: narrow ? "none" : "1px solid var(--bw-line)",
          borderRadius: narrow ? "18px 18px 0 0" : 0,
          boxShadow: "var(--bw-shadow-lg)",
          zIndex: 85,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {!detail || !task ? (
          <p className="bw-hint" style={{ padding: 40, textAlign: "center" }}>Loading…</p>
        ) : (
          <>
            {/* header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 18px", borderBottom: "1px solid var(--bw-line)", position: "sticky", top: 0, background: "var(--bw-paper-raised)", zIndex: 5 }}>
              <button
                aria-label={task.completedAt ? "Reopen" : "Complete"}
                onClick={() => {
                  void todo.completeTask(task.id, !task.completedAt);
                  onClose();
                }}
                style={{
                  width: 20, height: 20, borderRadius: 999, flexShrink: 0,
                  border: `1.8px solid ${pColor}`,
                  background: task.completedAt ? pColor : "transparent",
                  color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                {task.completedAt && <Check size={11} strokeWidth={3} />}
              </button>
              <span className="bw-hint" style={{ flex: 1, display: "flex", alignItems: "center", gap: 5 }}>
                {project ? (
                  <>
                    <Hash size={11} style={{ color: project.color }} /> {project.name}
                    {task.sectionId && (
                      <>
                        <ChevronRight size={10} />
                        {project.sections.find((s) => s.id === task.sectionId)?.name}
                      </>
                    )}
                  </>
                ) : (
                  "Inbox"
                )}
              </span>
              <BwMenu trigger={<button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Task actions" style={{ width: 28, padding: 0 }}>⋯</button>}>
                <button className="bw-menu-item" onClick={() => void todo.duplicateTask(task.id)}><Copy size={13} /> Duplicate</button>
                <button className="bw-menu-item bw-menu-danger" onClick={() => { void todo.removeTask(task.id); onClose(); }}>
                  <Trash2 size={13} /> Remove task
                </button>
              </BwMenu>
              <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Close" style={{ width: 28, padding: 0 }} onClick={onClose}>
                <X size={15} />
              </button>
            </div>

            <div style={{ padding: "16px 20px 30px", flex: 1 }}>
              {/* title + description */}
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => void saveTitle()}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
                rows={1}
                style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: 19, fontWeight: 650, fontFamily: "var(--bw-font-sans)", color: task.completedAt ? "var(--bw-ink-faint)" : "var(--bw-ink-strong)", textDecoration: task.completedAt ? "line-through" : "none", background: "transparent", lineHeight: 1.35 }}
              />
              <textarea
                value={description}
                placeholder="Add a description…"
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => void saveDescription()}
                rows={description ? Math.min(6, description.split("\n").length + 1) : 2}
                style={{ width: "100%", border: "none", outline: "none", resize: "vertical", fontSize: 13.5, fontFamily: "var(--bw-font-sans)", color: "var(--bw-ink-soft)", background: "transparent", lineHeight: 1.55, marginTop: 4 }}
              />

              {/* field bar */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0 4px", position: "relative" }}>
                <div style={{ position: "relative" }}>
                  {fieldBtn("due", <CalendarDays size={13} />, task.dueDate ? formatDueLabel(task.dueDate, task.dueTime) : "Date", dueTone(task.dueDate))}
                  {picker === "due" && (
                    <DuePicker value={task.dueDate} time={task.dueTime} recurrence={task.recurrence} onClose={() => setPicker(null)} onChange={(d) => void patch(d)} />
                  )}
                </div>
                <div style={{ position: "relative" }}>
                  {fieldBtn("priority", <Flag size={13} style={{ color: task.priority < 4 ? pColor : undefined }} />, task.priority < 4 ? `P${task.priority}` : "Priority")}
                  {picker === "priority" && <PriorityPicker value={task.priority} onClose={() => setPicker(null)} onChange={(p) => void patch({ priority: p })} />}
                </div>
                <div style={{ position: "relative" }}>
                  {fieldBtn("project", <Hash size={13} />, project ? "Move" : "Project")}
                  {picker === "project" && <ProjectPicker onClose={() => setPicker(null)} onPick={(projectId, sectionId) => void patch({ projectId, sectionId })} />}
                </div>
                <div style={{ position: "relative" }}>
                  {fieldBtn("labels", <Tag size={13} />, task.labelIds.length ? `${task.labelIds.length} label${task.labelIds.length === 1 ? "" : "s"}` : "Labels")}
                  {picker === "labels" && <LabelPicker value={task.labelIds} onClose={() => setPicker(null)} onChange={(ids) => void patch({ labelIds: ids })} />}
                </div>
                <div style={{ position: "relative" }}>
                  {fieldBtn("assignee", <UserRound size={13} />, task.assigneeId ? todo.memberName(task.assigneeId) : "Assign")}
                  {picker === "assignee" && <AssigneePicker value={task.assigneeId} onClose={() => setPicker(null)} onChange={(id) => void patch({ assigneeId: id })} />}
                </div>
                <div style={{ position: "relative" }}>
                  {fieldBtn("reminder", <Bell size={13} />, detail.reminders.length ? `${detail.reminders.length} reminder${detail.reminders.length === 1 ? "" : "s"}` : "Remind")}
                  {picker === "reminder" && (
                    <ReminderPicker
                      hasDue={!!task.dueDate}
                      reminders={detail.reminders}
                      onAdd={addReminder}
                      onRemove={async (id) => {
                        await formsApi(`/api/todo/reminders/${id}`, { method: "DELETE" });
                        await load();
                      }}
                      onClose={() => setPicker(null)}
                    />
                  )}
                </div>
              </div>

              {task.recurrence && (
                <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--bw-ink-soft)", margin: "6px 0 0" }}>
                  <Repeat size={11} /> Repeats {task.recurrence.label}. Completing it moves it to the next occurrence.
                </p>
              )}

              {/* subtasks */}
              <section style={{ marginTop: 22 }}>
                <p className="bw-kicker" style={{ fontSize: 10, margin: "0 0 4px" }}>
                  Subtasks{detail.subtasks.length ? ` · ${detail.subtasks.filter((s) => s.completedAt).length}/${detail.subtasks.length}` : ""}
                </p>
                {detail.subtasks.map((s) => (
                  <TaskRow key={s.id} task={s} viewKey={`detail:${taskId}`} />
                ))}
                <InlineAdd viewKey={`detail:${taskId}`} defaults={{ parentId: taskId }} placeholder="Add a subtask…" />
              </section>

              {/* attachments */}
              {(detail.attachments.length > 0 || true) && (
                <section style={{ marginTop: 20 }}>
                  <p className="bw-kicker" style={{ fontSize: 10, margin: "0 0 6px" }}>Attachments</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {detail.attachments.map((a) => (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          onClick={() => void openAttachment(a.id)}
                          style={{ display: "flex", alignItems: "center", gap: 7, border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--bw-ink)", fontFamily: "var(--bw-font-sans)", padding: "3px 0", textDecoration: "underline" }}
                        >
                          <Paperclip size={12} /> {a.fileName}
                          <span className="bw-hint">({Math.max(1, Math.round(a.sizeBytes / 1024))} KB)</span>
                        </button>
                        <button
                          aria-label="Remove attachment"
                          className="bw-btn bw-btn-ghost bw-btn-sm"
                          style={{ width: 22, height: 22, padding: 0 }}
                          onClick={async () => {
                            await formsApi(`/api/todo/attachments/${a.id}`, { method: "DELETE" });
                            await load();
                          }}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                    <button className="bw-btn bw-btn-ghost bw-btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => fileRef.current?.click()}>
                      <Paperclip size={12} /> Attach a file
                    </button>
                    <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAttachment(f); e.target.value = ""; }} />
                  </div>
                </section>
              )}

              {/* comments */}
              <section style={{ marginTop: 20 }}>
                <p className="bw-kicker" style={{ fontSize: 10, margin: "0 0 6px" }}>Comments</p>
                {detail.comments.map((c) => (
                  <div key={c.id} style={{ display: "flex", gap: 9, padding: "8px 0", borderBottom: "1px solid var(--bw-line)" }}>
                    <span style={{ width: 26, height: 26, borderRadius: 99, background: "var(--bw-blush)", color: "var(--bw-blush-ink)", fontSize: 9.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {todo.memberName(c.authorId).split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12 }}>
                        <strong>{todo.memberName(c.authorId) || "Someone"}</strong>{" "}
                        <span className="bw-hint">
                          {new Date(c.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.body}</p>
                    </div>
                    {c.authorId === todo.me && (
                      <button aria-label="Remove comment" className="bw-btn bw-btn-ghost bw-btn-sm" style={{ width: 22, height: 22, padding: 0 }} onClick={async () => { await formsApi(`/api/todo/comments/${c.id}`, { method: "DELETE" }); await load(); }}>
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <textarea
                    className="bw-textarea"
                    rows={2}
                    placeholder="Write a comment… use @name to mention a colleague"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void submitComment();
                      }
                    }}
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                  <BwButton size="sm" variant="primary" disabled={!comment.trim()} onClick={() => void submitComment()}>
                    Comment
                  </BwButton>
                </div>
              </section>

              {/* activity */}
              <section style={{ marginTop: 18 }}>
                <button onClick={() => setShowActivity((s) => !s)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, fontFamily: "var(--bw-font-sans)" }}>
                  <span className="bw-kicker" style={{ fontSize: 10 }}>Activity {showActivity ? "▾" : "▸"}</span>
                </button>
                {showActivity && (
                  <div style={{ marginTop: 6 }}>
                    {detail.activity.map((a) => (
                      <p key={a.id} style={{ margin: "0 0 5px", fontSize: 12, color: "var(--bw-ink-soft)" }}>
                        <strong>{todo.memberName(a.actorId) || "Someone"}</strong> {describeActivity(a)}{" "}
                        <span className="bw-hint">
                          {new Date(a.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </p>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </aside>
    </div>,
    document.body
  );
}

function describeActivity(a: ActivityDto): string {
  const d = (a.data ?? {}) as Record<string, unknown>;
  switch (a.type) {
    case "created": return d.duplicatedFrom ? "duplicated this task" : "created this task";
    case "completed": return "completed it";
    case "reopened": return "reopened it";
    case "recurred": return `moved it to the next occurrence (${d.next})`;
    case "due_changed": return d.to ? `set the date to ${d.to}` : "removed the date";
    case "priority": return `set priority ${d.to}`;
    case "assigned": return d.to ? "changed the assignee" : "removed the assignee";
    case "moved": return "moved it";
    case "comment": return "commented";
    default: return a.type;
  }
}

function ReminderPicker({
  hasDue,
  reminders,
  onAdd,
  onRemove,
  onClose,
}: {
  hasDue: boolean;
  reminders: ReminderDto[];
  onAdd: (offsetMinutes: number | null, custom?: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState("");
  return (
    <div className="bw-menu bw-fade-up" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 70, width: 262, padding: 10 }}>
      {reminders.map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, padding: "4px 2px" }}>
          <Bell size={12} style={{ color: r.sentAt ? "var(--bw-ink-faint)" : "var(--bw-sage-ink)" }} />
          <span style={{ flex: 1 }}>
            {new Date(r.remindAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            {r.sentAt && <span className="bw-hint"> · sent</span>}
          </span>
          <button aria-label="Remove reminder" className="bw-btn bw-btn-ghost bw-btn-sm" style={{ width: 20, height: 20, padding: 0 }} onClick={() => void onRemove(r.id)}>
            <X size={10} />
          </button>
        </div>
      ))}
      {reminders.length > 0 && <div className="bw-menu-sep" />}
      {hasDue ? (
        <>
          <button className="bw-menu-item" onClick={() => void onAdd(0)}>At the due time</button>
          <button className="bw-menu-item" onClick={() => void onAdd(30)}>30 minutes before</button>
          <button className="bw-menu-item" onClick={() => void onAdd(60 * 24)}>The day before</button>
        </>
      ) : (
        <p className="bw-hint" style={{ margin: "2px 4px 6px" }}>Set a due date for relative reminders, or pick an exact time:</p>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input className="bw-input bw-input-sm" type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Custom reminder time" />
        <BwButton size="sm" disabled={!custom} onClick={() => void onAdd(null, new Date(custom).toISOString())}>Set</BwButton>
      </div>
      <button className="bw-btn bw-btn-ghost bw-btn-sm" style={{ width: "100%", marginTop: 6 }} onClick={onClose}>Close</button>
    </div>
  );
}
