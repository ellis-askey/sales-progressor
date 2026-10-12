"use client";

// Task detail — second-pass. A compact drawer: title row with completion,
// a metadata field grid (due / priority / assignee / labels / reminders /
// move), a checklist with a progress bar, then tabbed Description, Comments,
// Activity and Files so no single stream dominates. Inline editing, saves on
// change via the optimistic store.

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

type Tab = "description" | "comments" | "activity" | "files";

export function TaskDetailPanel({ taskId, onClose, narrow }: { taskId: string; onClose: () => void; narrow: boolean }) {
  const todo = useTodo();
  const { toast } = useBwToast();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [picker, setPicker] = useState<"due" | "priority" | "project" | "labels" | "assignee" | "reminder" | null>(null);
  const [tab, setTab] = useState<Tab>("description");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [comment, setComment] = useState("");
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
  const subDone = detail?.subtasks.filter((s) => s.completedAt).length ?? 0;
  const subTotal = detail?.subtasks.length ?? 0;

  const metaField = (
    key: typeof picker,
    label: string,
    icon: React.ReactNode,
    value: React.ReactNode,
    tone?: string
  ) => (
    <div key={key} style={{ position: "relative" }}>
      <button className="bw-meta-field" style={{ width: "100%" }} onClick={() => setPicker(picker === key ? null : key)}>
        <span className="bw-meta-label">{label}</span>
        <span className="bw-meta-value" style={{ color: tone }}>
          {icon}
          {value}
        </span>
      </button>
      {picker === key && task && (
        <>
          {key === "due" && <DuePicker value={task.dueDate} time={task.dueTime} recurrence={task.recurrence} onClose={() => setPicker(null)} onChange={(d) => void patch(d)} />}
          {key === "priority" && <PriorityPicker value={task.priority} onClose={() => setPicker(null)} onChange={(p) => void patch({ priority: p })} />}
          {key === "assignee" && <AssigneePicker value={task.assigneeId} onClose={() => setPicker(null)} onChange={(id) => void patch({ assigneeId: id })} />}
          {key === "labels" && <LabelPicker value={task.labelIds} onClose={() => setPicker(null)} onChange={(ids) => void patch({ labelIds: ids })} />}
          {key === "project" && <ProjectPicker onClose={() => setPicker(null)} onPick={(projectId, sectionId) => void patch({ projectId, sectionId })} />}
          {key === "reminder" && (
            <ReminderPicker
              hasDue={!!task.dueDate}
              reminders={detail?.reminders ?? []}
              onAdd={addReminder}
              onRemove={async (id) => {
                await formsApi(`/api/todo/reminders/${id}`, { method: "DELETE" });
                await load();
              }}
              onClose={() => setPicker(null)}
            />
          )}
        </>
      )}
    </div>
  );

  return createPortal(
    <div className="bw-scope">
      <div className="bw-backdrop" style={{ background: narrow ? "rgba(43,48,50,0.5)" : "rgba(43,48,50,0.16)" }} onClick={onClose} />
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
          width: narrow ? "100%" : "min(540px, 92vw)",
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 16px", borderBottom: "1px solid var(--bw-line)", position: "sticky", top: 0, background: "var(--bw-paper-raised)", zIndex: 5 }}>
              <span className="bw-hint" style={{ flex: 1, display: "flex", alignItems: "center", gap: 5, minWidth: 0, overflow: "hidden" }}>
                {project ? (
                  <>
                    <Hash size={11} style={{ color: project.color, flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</span>
                    {task.sectionId && (
                      <>
                        <ChevronRight size={10} style={{ flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {project.sections.find((s) => s.id === task.sectionId)?.name}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  "Inbox"
                )}
              </span>
              <BwMenu trigger={<button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Task actions" style={{ width: 26, padding: 0 }}>⋯</button>}>
                <button className="bw-menu-item" onClick={() => void todo.duplicateTask(task.id)}><Copy size={13} /> Duplicate</button>
                <button className="bw-menu-item bw-menu-danger" onClick={() => { void todo.removeTask(task.id); onClose(); }}>
                  <Trash2 size={13} /> Remove task
                </button>
              </BwMenu>
              <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Close" style={{ width: 26, padding: 0 }} onClick={onClose}>
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: "14px 18px 28px", flex: 1 }}>
              {/* title row */}
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <button
                  aria-label={task.completedAt ? "Reopen" : "Complete"}
                  onClick={() => {
                    void todo.completeTask(task.id, !task.completedAt);
                    onClose();
                  }}
                  style={{
                    width: 19, height: 19, borderRadius: 999, flexShrink: 0, marginTop: 4,
                    border: `1.8px solid ${pColor}`,
                    background: task.completedAt ? pColor : "transparent",
                    color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  }}
                >
                  {task.completedAt && <Check size={11} strokeWidth={3} />}
                </button>
                <textarea
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => void saveTitle()}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
                  rows={1}
                  style={{ flex: 1, border: "none", outline: "none", resize: "none", fontSize: 17.5, fontWeight: 650, fontFamily: "var(--bw-font-sans)", color: task.completedAt ? "var(--bw-ink-faint)" : "var(--bw-ink-strong)", textDecoration: task.completedAt ? "line-through" : "none", background: "transparent", lineHeight: 1.35 }}
                />
              </div>

              {/* meta grid */}
              <div className="bw-meta-grid">
                {metaField("due", "Due", <CalendarDays size={12.5} />, task.dueDate ? formatDueLabel(task.dueDate, task.dueTime) : "Set date", task.dueDate ? dueTone(task.dueDate) : "var(--bw-ink-faint)")}
                {metaField("priority", "Priority", <Flag size={12.5} style={{ color: task.priority < 4 ? pColor : undefined }} />, task.priority < 4 ? `P${task.priority}` : "None", task.priority < 4 ? pColor : "var(--bw-ink-faint)")}
                {metaField("assignee", "Assignee", <UserRound size={12.5} />, task.assigneeId ? todo.memberName(task.assigneeId) : "Unassigned", task.assigneeId ? undefined : "var(--bw-ink-faint)")}
                {metaField(
                  "labels",
                  "Labels",
                  <Tag size={12.5} />,
                  task.labelIds.length ? (
                    <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {task.labelIds.map((id) => {
                        const l = todo.labels.find((x) => x.id === id);
                        return l ? (
                          <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <span style={{ width: 6, height: 6, borderRadius: 99, background: l.color }} />
                            {l.name}
                          </span>
                        ) : null;
                      })}
                    </span>
                  ) : (
                    "Add"
                  ),
                  task.labelIds.length ? undefined : "var(--bw-ink-faint)"
                )}
                {metaField("reminder", "Reminders", <Bell size={12.5} />, detail.reminders.length ? `${detail.reminders.length} set` : "None", detail.reminders.length ? "var(--bw-sage-ink)" : "var(--bw-ink-faint)")}
                {metaField("project", "Project", <Hash size={12.5} style={{ color: project?.color }} />, project ? project.name : "Inbox")}
              </div>

              {task.recurrence && (
                <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--bw-ink-soft)", margin: "8px 0 0" }}>
                  <Repeat size={11} /> Repeats {task.recurrence.label}. Completing it moves it to the next occurrence.
                </p>
              )}

              {/* checklist */}
              <section style={{ marginTop: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                  <p className="bw-kicker" style={{ fontSize: 9.5, margin: 0 }}>Checklist{subTotal ? ` · ${subDone}/${subTotal}` : ""}</p>
                  {subTotal > 0 && (
                    <span style={{ flex: 1, maxWidth: 140, height: 4, borderRadius: 99, background: "var(--bw-paper-sunken)", overflow: "hidden" }}>
                      <span style={{ display: "block", height: "100%", width: `${Math.round((subDone / subTotal) * 100)}%`, background: "var(--bw-sage-ink)", transition: "width 240ms ease" }} />
                    </span>
                  )}
                </div>
                {detail.subtasks.map((s) => (
                  <TaskRow key={s.id} task={s} viewKey={`detail:${taskId}`} />
                ))}
                <InlineAdd viewKey={`detail:${taskId}`} defaults={{ parentId: taskId }} placeholder="Add a subtask" />
              </section>

              {/* tabs */}
              <div className="bw-tabs" style={{ marginTop: 16 }}>
                {(
                  [
                    ["description", "Description"],
                    ["comments", `Comments${detail.comments.length ? ` (${detail.comments.length})` : ""}`],
                    ["activity", "Activity"],
                    ["files", `Files${detail.attachments.length ? ` (${detail.attachments.length})` : ""}`],
                  ] as [Tab, string][]
                ).map(([key, label]) => (
                  <button key={key} className="bw-tab" data-active={tab === key} onClick={() => setTab(key)}>
                    {label}
                  </button>
                ))}
              </div>

              {tab === "description" && (
                <textarea
                  value={description}
                  placeholder="Add a description…"
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => void saveDescription()}
                  rows={description ? Math.min(10, description.split("\n").length + 2) : 3}
                  style={{ width: "100%", border: "none", outline: "none", resize: "vertical", fontSize: 13.5, fontFamily: "var(--bw-font-sans)", color: "var(--bw-ink)", background: "transparent", lineHeight: 1.6 }}
                />
              )}

              {tab === "comments" && (
                <div>
                  {detail.comments.length === 0 && <p className="bw-hint" style={{ margin: "4px 0 10px" }}>No comments yet. Use @name to mention a colleague.</p>}
                  {detail.comments.map((c) => (
                    <div key={c.id} style={{ display: "flex", gap: 9, padding: "8px 0", borderBottom: "1px solid var(--bw-line)" }}>
                      <span style={{ width: 24, height: 24, borderRadius: 99, background: "var(--bw-blush)", color: "var(--bw-blush-ink)", fontSize: 9, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {todo.memberName(c.authorId).split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?"}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 11.5 }}>
                          <strong>{todo.memberName(c.authorId) || "Someone"}</strong>{" "}
                          <span className="bw-hint">
                            {new Date(c.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.body}</p>
                      </div>
                      {c.authorId === todo.me && (
                        <button aria-label="Remove comment" className="bw-btn bw-btn-ghost bw-btn-sm" style={{ width: 22, height: 22, padding: 0 }} onClick={async () => { await formsApi(`/api/todo/comments/${c.id}`, { method: "DELETE" }); await load(); }}>
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                  <textarea
                    className="bw-textarea"
                    rows={2}
                    placeholder="Write a comment… @name to mention"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void submitComment();
                      }
                    }}
                    style={{ fontSize: 13, marginTop: 10 }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                    <BwButton size="sm" variant="primary" disabled={!comment.trim()} onClick={() => void submitComment()}>
                      Comment
                    </BwButton>
                  </div>
                </div>
              )}

              {tab === "activity" && (
                <div>
                  {detail.activity.map((a) => (
                    <p key={a.id} style={{ margin: "0 0 6px", fontSize: 12, color: "var(--bw-ink-soft)", lineHeight: 1.5 }}>
                      <strong style={{ color: "var(--bw-ink)" }}>{todo.memberName(a.actorId) || "Someone"}</strong> {describeActivity(a)}{" "}
                      <span className="bw-hint">
                        {new Date(a.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </p>
                  ))}
                </div>
              )}

              {tab === "files" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {detail.attachments.length === 0 && <p className="bw-hint" style={{ margin: "4px 0 6px" }}>No files yet.</p>}
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
                  <button className="bw-btn bw-btn-secondary bw-btn-sm" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={() => fileRef.current?.click()}>
                    <Paperclip size={12} /> Attach a file
                  </button>
                  <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAttachment(f); e.target.value = ""; }} />
                </div>
              )}
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
