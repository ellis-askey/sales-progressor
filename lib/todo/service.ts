import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  FilterQuery,
  ProjectDto,
  RecurrenceRule,
  TaskDto,
  TodoCounts,
} from "./types";
import { addDays, londonWallTimeToUtc, nextOccurrence, todayInLondon } from "./recurrence";
import { extractFirstName } from "@/lib/contacts/displayName";

// Boardwalk To Do service layer. EVERY function takes (tenantId, userId) and
// scopes queries to that tenant; project access is membership/visibility
// checked server-side (private projects are invisible to non-members even
// within the tenant). No handler touches Prisma directly.

const err = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

// ─── Access helpers ──────────────────────────────────────────────────────────

export function visibleProjectWhere(tenantId: string, userId: string): Prisma.TodoProjectWhereInput {
  return {
    tenantId,
    OR: [{ visibility: "team" }, { members: { some: { userId } } }],
  };
}

export async function assertProjectAccess(tenantId: string, userId: string, projectId: string) {
  const project = await prisma.todoProject.findFirst({
    where: { id: projectId, ...visibleProjectWhere(tenantId, userId) },
  });
  if (!project) throw err("Project not found", 404);
  return project;
}

/** A task is visible if it's in the user's inbox or in a visible project. */
function visibleTaskWhere(tenantId: string, userId: string): Prisma.TodoTaskWhereInput {
  return {
    tenantId,
    OR: [
      { projectId: null, inboxOwnerId: userId },
      { project: { is: { OR: [{ visibility: "team" }, { members: { some: { userId } } }] } } },
    ],
  };
}

export async function assertTaskAccess(tenantId: string, userId: string, taskId: string) {
  const task = await prisma.todoTask.findFirst({
    where: { id: taskId, ...visibleTaskWhere(tenantId, userId) },
  });
  if (!task) throw err("Task not found", 404);
  return task;
}

async function assertTenantUser(tenantId: string, userId: string) {
  const user = await prisma.formTenantUser.findFirst({ where: { id: userId, tenantId } });
  if (!user) throw err("That person isn't in your team.", 400);
  return user;
}

// ─── Mapping ─────────────────────────────────────────────────────────────────

type TaskRow = Prisma.TodoTaskGetPayload<{
  include: {
    labels: { select: { labelId: true } };
    subtasks: { select: { completedAt: true } };
    _count: { select: { comments: true } };
  };
}>;

const TASK_INCLUDE = {
  labels: { select: { labelId: true } },
  subtasks: { select: { completedAt: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TodoTaskInclude;

function dateStr(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export function toTaskDto(t: TaskRow): TaskDto {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    projectId: t.projectId,
    sectionId: t.sectionId,
    parentId: t.parentId,
    dueDate: dateStr(t.dueDate),
    dueTime: t.dueTime,
    duration: t.duration,
    priority: t.priority,
    order: t.order,
    recurrence: (t.recurrence as unknown as RecurrenceRule) ?? null,
    inboxOwnerId: t.inboxOwnerId,
    assigneeId: t.assigneeId,
    createdById: t.createdById,
    completedAt: t.completedAt?.toISOString() ?? null,
    completedById: t.completedById,
    createdAt: t.createdAt.toISOString(),
    labelIds: t.labels.map((l) => l.labelId),
    subtaskCount: t.subtasks.length,
    subtaskDone: t.subtasks.filter((s) => s.completedAt !== null).length,
    commentCount: t._count.comments,
  };
}

function dueDateInput(dueDate: string | null | undefined): Date | null | undefined {
  if (dueDate === undefined) return undefined;
  if (dueDate === null) return null;
  return new Date(`${dueDate}T00:00:00Z`);
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

export async function getBootstrap(tenantId: string, userId: string) {
  const [projects, labels, filters, members, pref, unread] = await Promise.all([
    prisma.todoProject.findMany({
      where: { ...visibleProjectWhere(tenantId, userId), archivedAt: null },
      include: {
        sections: { orderBy: { order: "asc" } },
        members: true,
        _count: { select: { tasks: { where: { completedAt: null, parentId: null } } } },
      },
      orderBy: { order: "asc" },
    }),
    prisma.todoLabel.findMany({ where: { tenantId }, orderBy: { order: "asc" } }),
    prisma.todoFilter.findMany({ where: { tenantId, userId }, orderBy: { order: "asc" } }),
    prisma.formTenantUser.findMany({
      where: { tenantId },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.todoUserPref.findUnique({ where: { userId } }),
    prisma.todoNotification.count({ where: { tenantId, userId, readAt: null } }),
  ]);

  const projectDtos: ProjectDto[] = projects.map((p) => {
    const mine = p.members.find((m) => m.userId === userId);
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      icon: p.icon,
      description: p.description,
      visibility: p.visibility as "team" | "private",
      isTemplate: p.isTemplate,
      archivedAt: p.archivedAt?.toISOString() ?? null,
      order: p.order,
      createdById: p.createdById,
      isFavorite: mine?.isFavorite ?? false,
      viewPref: (mine?.viewPref as ProjectDto["viewPref"]) ?? null,
      role: (mine?.role as ProjectDto["role"]) ?? null,
      memberIds: p.members.map((m) => m.userId),
      activeTaskCount: p._count.tasks,
      sections: p.sections.map((s) => ({ id: s.id, projectId: s.projectId, name: s.name, order: s.order })),
    };
  });

  return {
    projects: projectDtos,
    labels,
    filters,
    members,
    prefs: (pref?.data as Record<string, unknown>) ?? {},
    unreadNotifications: unread,
  };
}

export async function getCounts(tenantId: string, userId: string): Promise<TodoCounts> {
  const today = todayInLondon();
  const todayDate = new Date(`${today}T00:00:00Z`);
  const in7 = new Date(`${addDays(today, 7)}T00:00:00Z`);
  const visible = visibleTaskWhere(tenantId, userId);

  const [inbox, todayCount, overdue, upcoming, byProject, unread] = await Promise.all([
    prisma.todoTask.count({ where: { tenantId, projectId: null, inboxOwnerId: userId, completedAt: null, parentId: null } }),
    prisma.todoTask.count({ where: { ...visible, completedAt: null, parentId: null, dueDate: todayDate } }),
    prisma.todoTask.count({ where: { ...visible, completedAt: null, parentId: null, dueDate: { lt: todayDate } } }),
    prisma.todoTask.count({ where: { ...visible, completedAt: null, parentId: null, dueDate: { gt: todayDate, lte: in7 } } }),
    prisma.todoTask.groupBy({
      by: ["projectId"],
      where: { ...visible, completedAt: null, parentId: null, projectId: { not: null } },
      _count: { _all: true },
    }),
    prisma.todoNotification.count({ where: { tenantId, userId, readAt: null } }),
  ]);

  const byProjectMap: Record<string, number> = {};
  for (const row of byProject) if (row.projectId) byProjectMap[row.projectId] = row._count._all;

  return { inbox, today: todayCount, overdue, upcoming, byProject: byProjectMap, unreadNotifications: unread };
}

// ─── Task queries ────────────────────────────────────────────────────────────

export interface TaskQuery {
  view: "inbox" | "today" | "upcoming" | "completed" | "project" | "search" | "filter" | "label";
  projectId?: string;
  labelId?: string;
  search?: string;
  from?: string;
  to?: string;
  filter?: FilterQuery;
  cursor?: string;
}

export async function listTasks(tenantId: string, userId: string, q: TaskQuery): Promise<{ tasks: TaskDto[]; nextCursor: string | null }> {
  const today = todayInLondon();
  const todayDate = new Date(`${today}T00:00:00Z`);
  const visible = visibleTaskWhere(tenantId, userId);
  let where: Prisma.TodoTaskWhereInput;
  let orderBy: Prisma.TodoTaskOrderByWithRelationInput[] = [{ dueDate: "asc" }, { priority: "asc" }, { order: "asc" }];
  let take = 500;

  switch (q.view) {
    case "inbox":
      where = { tenantId, projectId: null, inboxOwnerId: userId, completedAt: null, parentId: null };
      orderBy = [{ order: "asc" }, { createdAt: "asc" }];
      break;
    case "today":
      where = { ...visible, completedAt: null, parentId: null, dueDate: { lte: todayDate } };
      break;
    case "upcoming": {
      const from = q.from ?? addDays(today, 1);
      const to = q.to ?? addDays(today, 30);
      where = {
        ...visible,
        completedAt: null,
        parentId: null,
        dueDate: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) },
      };
      break;
    }
    case "completed":
      where = { ...visible, completedAt: { not: null }, parentId: null };
      orderBy = [{ completedAt: "desc" }];
      take = 100;
      break;
    case "project":
      if (!q.projectId) throw err("Missing project", 400);
      await assertProjectAccess(tenantId, userId, q.projectId);
      where = { tenantId, projectId: q.projectId, completedAt: null, parentId: null };
      orderBy = [{ order: "asc" }, { createdAt: "asc" }];
      break;
    case "label":
      if (!q.labelId) throw err("Missing label", 400);
      where = { ...visible, completedAt: null, parentId: null, labels: { some: { labelId: q.labelId } } };
      break;
    case "search": {
      const needle = (q.search ?? "").trim();
      if (!needle) return { tasks: [], nextCursor: null };
      where = {
        ...visible,
        parentId: null,
        OR: [
          { title: { contains: needle, mode: "insensitive" } },
          { description: { contains: needle, mode: "insensitive" } },
          { comments: { some: { body: { contains: needle, mode: "insensitive" } } } },
        ],
      };
      take = 60;
      orderBy = [{ completedAt: "asc" }, { updatedAt: "desc" }];
      break;
    }
    case "filter": {
      where = { ...visible, completedAt: null, parentId: null, ...buildFilterWhere(q.filter, userId, today) };
      break;
    }
    default:
      throw err("Unknown view", 400);
  }

  const rows = await prisma.todoTask.findMany({
    where,
    include: TASK_INCLUDE,
    orderBy,
    take: take + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  return {
    tasks: (hasMore ? rows.slice(0, take) : rows).map(toTaskDto),
    nextCursor: hasMore ? rows[take].id : null,
  };
}

function buildFilterWhere(filter: FilterQuery | undefined, userId: string, today: string): Prisma.TodoTaskWhereInput {
  if (!filter?.conditions?.length) return {};
  const todayDate = new Date(`${today}T00:00:00Z`);
  const parts: Prisma.TodoTaskWhereInput[] = filter.conditions.map((c) => {
    switch (c.field) {
      case "due":
        if (c.value === "today") return { dueDate: todayDate };
        if (c.value === "overdue") return { dueDate: { lt: todayDate } };
        if (c.value === "this_week") return { dueDate: { gte: todayDate, lte: new Date(`${addDays(today, 7)}T00:00:00Z`) } };
        if (c.value === "next_7_days") return { dueDate: { gte: todayDate, lte: new Date(`${addDays(today, 7)}T00:00:00Z`) } };
        if (c.value === "no_date") return { dueDate: null };
        return {};
      case "priority":
        return { priority: Number(c.value) || 4 };
      case "assignee":
        if (c.value === "me") return { assigneeId: userId };
        if (c.value === "none") return { assigneeId: null };
        return { assigneeId: c.value };
      case "project":
        return { projectId: c.value };
      case "label":
        return { labels: { some: { labelId: c.value } } };
      case "created":
        return { createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } };
      default:
        return {};
    }
  });
  return filter.combinator === "or" ? { OR: parts } : { AND: parts };
}

// ─── Task mutations ──────────────────────────────────────────────────────────

export interface TaskInput {
  title?: string;
  description?: string | null;
  projectId?: string | null;
  sectionId?: string | null;
  parentId?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  duration?: number | null;
  priority?: number;
  order?: number;
  recurrence?: RecurrenceRule | null;
  assigneeId?: string | null;
  labelIds?: string[];
}

async function logActivity(taskId: string, actorId: string, type: string, data?: Record<string, unknown>) {
  await prisma.todoActivity.create({
    data: { taskId, actorId, type, data: (data ?? undefined) as Prisma.InputJsonValue | undefined },
  });
}

export async function notify(opts: {
  tenantId: string;
  userId: string;
  actorId?: string;
  type: string;
  message: string;
  taskId?: string;
  projectId?: string;
}) {
  if (opts.actorId && opts.actorId === opts.userId) return; // never self-notify
  await prisma.todoNotification.create({
    data: {
      tenantId: opts.tenantId,
      userId: opts.userId,
      actorId: opts.actorId ?? null,
      type: opts.type,
      message: opts.message.slice(0, 500),
      taskId: opts.taskId ?? null,
      projectId: opts.projectId ?? null,
    },
  });
}

export async function createTask(tenantId: string, userId: string, input: TaskInput): Promise<TaskDto> {
  const title = (input.title ?? "").trim();
  if (!title) throw err("Give the task a name.", 400);
  if (title.length > 500) throw err("Keep the task name under 500 characters.", 400);

  if (input.projectId) await assertProjectAccess(tenantId, userId, input.projectId);
  if (input.parentId) {
    const parent = await assertTaskAccess(tenantId, userId, input.parentId);
    input.projectId = parent.projectId;
    input.sectionId = parent.sectionId;
  }
  if (input.assigneeId) await assertTenantUser(tenantId, input.assigneeId);

  const task = await prisma.todoTask.create({
    data: {
      tenantId,
      title,
      description: input.description ?? null,
      projectId: input.projectId ?? null,
      sectionId: input.sectionId ?? null,
      parentId: input.parentId ?? null,
      inboxOwnerId: input.projectId || input.parentId ? null : userId,
      dueDate: dueDateInput(input.dueDate ?? null) as Date | null,
      dueTime: input.dueTime ?? null,
      duration: input.duration ?? null,
      priority: input.priority && input.priority >= 1 && input.priority <= 4 ? input.priority : 4,
      order: input.order ?? Date.now(),
      recurrence: (input.recurrence ?? undefined) as Prisma.InputJsonValue | undefined,
      assigneeId: input.assigneeId ?? null,
      createdById: userId,
      ...(input.labelIds?.length
        ? { labels: { create: input.labelIds.map((labelId) => ({ labelId })) } }
        : {}),
    },
    include: TASK_INCLUDE,
  });

  await logActivity(task.id, userId, "created");
  if (task.assigneeId && task.assigneeId !== userId) {
    await notify({ tenantId, userId: task.assigneeId, actorId: userId, type: "assigned", message: `assigned you "${task.title}"`, taskId: task.id });
  }
  return toTaskDto(task);
}

export async function updateTask(tenantId: string, userId: string, taskId: string, input: TaskInput): Promise<TaskDto> {
  const existing = await assertTaskAccess(tenantId, userId, taskId);

  if (input.projectId !== undefined && input.projectId !== null) {
    await assertProjectAccess(tenantId, userId, input.projectId);
  }
  if (input.assigneeId) await assertTenantUser(tenantId, input.assigneeId);

  const data: Prisma.TodoTaskUpdateInput = {};
  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t) throw err("Give the task a name.", 400);
    data.title = t.slice(0, 500);
  }
  if (input.description !== undefined) data.description = input.description;
  if (input.dueDate !== undefined) data.dueDate = dueDateInput(input.dueDate);
  if (input.dueTime !== undefined) data.dueTime = input.dueTime;
  if (input.duration !== undefined) data.duration = input.duration;
  if (input.priority !== undefined) data.priority = Math.min(4, Math.max(1, input.priority));
  if (input.order !== undefined) data.order = input.order;
  if (input.recurrence !== undefined) {
    data.recurrence = input.recurrence === null ? Prisma.DbNull : (input.recurrence as unknown as Prisma.InputJsonValue);
  }
  if (input.assigneeId !== undefined) data.assigneeId = input.assigneeId;
  if (input.projectId !== undefined) {
    data.project = input.projectId ? { connect: { id: input.projectId } } : { disconnect: true };
    data.inboxOwnerId = input.projectId ? null : existing.inboxOwnerId ?? userId;
    if (input.projectId !== existing.projectId) data.section = { disconnect: true };
  }
  if (input.sectionId !== undefined) {
    data.section = input.sectionId ? { connect: { id: input.sectionId } } : { disconnect: true };
  }

  const task = await prisma.$transaction(async (tx) => {
    if (input.labelIds !== undefined) {
      await tx.todoTaskLabel.deleteMany({ where: { taskId } });
      if (input.labelIds.length) {
        const labels = await tx.todoLabel.findMany({ where: { tenantId, id: { in: input.labelIds } }, select: { id: true } });
        await tx.todoTaskLabel.createMany({ data: labels.map((l) => ({ taskId, labelId: l.id })) });
      }
    }
    return tx.todoTask.update({ where: { id: taskId }, data, include: TASK_INCLUDE });
  });

  // Activity + notifications for the meaningful changes
  if (input.dueDate !== undefined && dateStr(existing.dueDate) !== (input.dueDate ?? null)) {
    await logActivity(taskId, userId, "due_changed", { from: dateStr(existing.dueDate), to: input.dueDate ?? null });
  }
  if (input.priority !== undefined && input.priority !== existing.priority) {
    await logActivity(taskId, userId, "priority", { from: existing.priority, to: input.priority });
  }
  if (input.assigneeId !== undefined && input.assigneeId !== existing.assigneeId) {
    await logActivity(taskId, userId, "assigned", { to: input.assigneeId });
    if (input.assigneeId) {
      await notify({ tenantId, userId: input.assigneeId, actorId: userId, type: "assigned", message: `assigned you "${task.title}"`, taskId });
    }
  }
  if (input.projectId !== undefined && input.projectId !== existing.projectId) {
    await logActivity(taskId, userId, "moved", { to: input.projectId });
  }
  return toTaskDto(task);
}

/**
 * Complete / reopen. Completing a recurring task advances it to the next
 * occurrence (task stays open on the new date) and logs the completed
 * occurrence — no duplicates, rule preserved.
 */
export async function setTaskCompletion(tenantId: string, userId: string, taskId: string, completed: boolean): Promise<TaskDto> {
  const task = await assertTaskAccess(tenantId, userId, taskId);
  const rule = task.recurrence as unknown as RecurrenceRule | null;

  if (completed && rule && task.parentId === null) {
    const today = todayInLondon();
    const current = dateStr(task.dueDate) ?? today;
    const from = current > today ? current : today;
    const next = nextOccurrence(rule, from, current);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.todoTask.update({
        where: { id: taskId },
        data: { dueDate: new Date(`${next}T00:00:00Z`), completedAt: null, completedById: null },
        include: TASK_INCLUDE,
      });
      // Re-aim unsent offset reminders at the new occurrence
      const reminders = await tx.todoReminder.findMany({ where: { taskId, sentAt: null, offsetMinutes: { not: null } } });
      for (const r of reminders) {
        const at = londonWallTimeToUtc(next, u.dueTime ?? "09:00");
        await tx.todoReminder.update({
          where: { id: r.id },
          data: { remindAt: new Date(at.getTime() - (r.offsetMinutes ?? 0) * 60000) },
        });
      }
      return u;
    });
    await logActivity(taskId, userId, "completed", { occurrence: current });
    await logActivity(taskId, userId, "recurred", { next });
    return toTaskDto(updated);
  }

  const updated = await prisma.todoTask.update({
    where: { id: taskId },
    data: completed
      ? { completedAt: new Date(), completedById: userId }
      : { completedAt: null, completedById: null },
    include: TASK_INCLUDE,
  });
  await logActivity(taskId, userId, completed ? "completed" : "reopened");
  return toTaskDto(updated);
}

export async function deleteTask(tenantId: string, userId: string, taskId: string) {
  await assertTaskAccess(tenantId, userId, taskId);
  await prisma.todoTask.delete({ where: { id: taskId } });
}

export async function duplicateTask(tenantId: string, userId: string, taskId: string): Promise<TaskDto> {
  const task = await assertTaskAccess(tenantId, userId, taskId);
  const labels = await prisma.todoTaskLabel.findMany({ where: { taskId } });
  const subtasks = await prisma.todoTask.findMany({ where: { parentId: taskId } });
  const copy = await prisma.todoTask.create({
    data: {
      tenantId,
      title: task.title,
      description: task.description,
      projectId: task.projectId,
      sectionId: task.sectionId,
      inboxOwnerId: task.projectId ? null : userId,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      duration: task.duration,
      priority: task.priority,
      order: task.order + 0.5,
      recurrence: task.recurrence === null ? undefined : (task.recurrence as Prisma.InputJsonValue),
      assigneeId: task.assigneeId,
      createdById: userId,
      labels: { create: labels.map((l) => ({ labelId: l.labelId })) },
    },
    include: TASK_INCLUDE,
  });
  for (const s of subtasks) {
    await prisma.todoTask.create({
      data: {
        tenantId,
        title: s.title,
        description: s.description,
        parentId: copy.id,
        projectId: copy.projectId,
        sectionId: copy.sectionId,
        priority: s.priority,
        order: s.order,
        createdById: userId,
      },
    });
  }
  await logActivity(copy.id, userId, "created", { duplicatedFrom: taskId });
  return toTaskDto({ ...copy, subtasks: subtasks.map(() => ({ completedAt: null })) } as TaskRow);
}

export async function bulkUpdate(tenantId: string, userId: string, taskIds: string[], patch: Pick<TaskInput, "dueDate" | "priority" | "assigneeId" | "projectId" | "sectionId">) {
  const ids = taskIds.slice(0, 100);
  const results: TaskDto[] = [];
  for (const id of ids) {
    try {
      results.push(await updateTask(tenantId, userId, id, patch));
    } catch {
      // skip tasks that disappeared or aren't accessible — report what worked
    }
  }
  return results;
}

export async function reorderTasks(tenantId: string, userId: string, orderedIds: string[], target?: { projectId?: string | null; sectionId?: string | null }) {
  const ids = orderedIds.slice(0, 300);
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      const where: Prisma.TodoTaskWhereInput = { id: ids[i], ...visibleTaskWhere(tenantId, userId) };
      const found = await tx.todoTask.findFirst({ where, select: { id: true } });
      if (!found) continue;
      await tx.todoTask.update({
        where: { id: ids[i] },
        data: {
          order: (i + 1) * 10,
          ...(target?.projectId !== undefined ? { projectId: target.projectId, inboxOwnerId: target.projectId ? null : userId } : {}),
          ...(target?.sectionId !== undefined ? { sectionId: target.sectionId } : {}),
        },
      });
    }
  });
}

// ─── Subtree fetch (detail panel) ───────────────────────────────────────────

export async function getTaskDetail(tenantId: string, userId: string, taskId: string) {
  await assertTaskAccess(tenantId, userId, taskId);
  const [task, subtasks, comments, attachments, reminders, activity] = await Promise.all([
    prisma.todoTask.findUnique({ where: { id: taskId }, include: TASK_INCLUDE }),
    prisma.todoTask.findMany({ where: { parentId: taskId }, include: TASK_INCLUDE, orderBy: { order: "asc" } }),
    prisma.todoComment.findMany({ where: { taskId }, orderBy: { createdAt: "asc" } }),
    prisma.todoAttachment.findMany({ where: { taskId }, orderBy: { createdAt: "asc" } }),
    prisma.todoReminder.findMany({ where: { taskId }, orderBy: { remindAt: "asc" } }),
    prisma.todoActivity.findMany({ where: { taskId }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return { task: toTaskDto(task as TaskRow), subtasks: subtasks.map(toTaskDto), comments, attachments, reminders, activity };
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function createProject(tenantId: string, userId: string, input: { name: string; color?: string; icon?: string | null; description?: string | null; visibility?: "team" | "private"; isTemplate?: boolean }) {
  const name = input.name?.trim();
  if (!name) throw err("Give the project a name.", 400);
  const max = await prisma.todoProject.aggregate({ where: { tenantId }, _max: { order: true } });
  return prisma.todoProject.create({
    data: {
      tenantId,
      name: name.slice(0, 120),
      color: input.color ?? "#404648",
      icon: input.icon ?? null,
      description: input.description ?? null,
      visibility: input.visibility === "private" ? "private" : "team",
      isTemplate: input.isTemplate ?? false,
      order: (max._max.order ?? 0) + 1,
      createdById: userId,
      members: { create: { userId, role: "owner" } },
    },
    include: { sections: true, members: true },
  });
}

export async function updateProject(tenantId: string, userId: string, projectId: string, input: Partial<{ name: string; color: string; icon: string | null; description: string | null; visibility: "team" | "private"; archived: boolean; order: number }>) {
  await assertProjectAccess(tenantId, userId, projectId);
  return prisma.todoProject.update({
    where: { id: projectId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim().slice(0, 120) } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
    },
  });
}

export async function deleteProject(tenantId: string, userId: string, projectId: string) {
  const project = await assertProjectAccess(tenantId, userId, projectId);
  if (!project.archivedAt) throw err("Archive the project first, then remove it for good.", 400);
  await prisma.todoProject.delete({ where: { id: projectId } });
}

export async function setMembership(tenantId: string, userId: string, projectId: string, patch: { isFavorite?: boolean; viewPref?: string | null }) {
  await assertProjectAccess(tenantId, userId, projectId);
  await prisma.todoProjectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role: "member", isFavorite: patch.isFavorite ?? false, viewPref: patch.viewPref ?? null },
    update: {
      ...(patch.isFavorite !== undefined ? { isFavorite: patch.isFavorite } : {}),
      ...(patch.viewPref !== undefined ? { viewPref: patch.viewPref } : {}),
    },
  });
}

export async function shareProject(tenantId: string, actorId: string, projectId: string, memberUserId: string, remove = false) {
  const project = await assertProjectAccess(tenantId, actorId, projectId);
  await assertTenantUser(tenantId, memberUserId);
  if (remove) {
    if (memberUserId === project.createdById) throw err("The project owner can't be removed.", 400);
    await prisma.todoProjectMember.deleteMany({ where: { projectId, userId: memberUserId } });
    return;
  }
  await prisma.todoProjectMember.upsert({
    where: { projectId_userId: { projectId, userId: memberUserId } },
    create: { projectId, userId: memberUserId, role: "member" },
    update: {},
  });
  await notify({ tenantId, userId: memberUserId, actorId, type: "project_shared", message: `shared the project "${project.name}" with you`, projectId });
}

export async function duplicateProject(tenantId: string, userId: string, projectId: string, opts?: { name?: string; asTemplate?: boolean; fromTemplate?: boolean }) {
  const source = await assertProjectAccess(tenantId, userId, projectId);
  const sections = await prisma.todoSection.findMany({ where: { projectId }, orderBy: { order: "asc" } });
  const tasks = await prisma.todoTask.findMany({
    where: { projectId, completedAt: null },
    include: { labels: true },
    orderBy: { order: "asc" },
  });

  const copy = await createProject(tenantId, userId, {
    name: opts?.name ?? (opts?.fromTemplate ? source.name : `${source.name} (copy)`),
    color: source.color,
    icon: source.icon,
    description: source.description,
    visibility: source.visibility as "team" | "private",
    isTemplate: opts?.asTemplate ?? false,
  });

  const sectionMap = new Map<string, string>();
  for (const s of sections) {
    const ns = await prisma.todoSection.create({ data: { projectId: copy.id, name: s.name, order: s.order } });
    sectionMap.set(s.id, ns.id);
  }
  const parentMap = new Map<string, string>();
  for (const t of tasks.filter((x) => !x.parentId)) {
    const nt = await prisma.todoTask.create({
      data: {
        tenantId,
        title: t.title,
        description: t.description,
        projectId: copy.id,
        sectionId: t.sectionId ? sectionMap.get(t.sectionId) ?? null : null,
        priority: t.priority,
        order: t.order,
        recurrence: t.recurrence === null ? undefined : (t.recurrence as Prisma.InputJsonValue),
        createdById: userId,
        labels: { create: t.labels.map((l) => ({ labelId: l.labelId })) },
      },
    });
    parentMap.set(t.id, nt.id);
  }
  for (const t of tasks.filter((x) => x.parentId)) {
    const newParent = parentMap.get(t.parentId!);
    if (!newParent) continue;
    await prisma.todoTask.create({
      data: {
        tenantId,
        title: t.title,
        projectId: copy.id,
        parentId: newParent,
        priority: t.priority,
        order: t.order,
        createdById: userId,
      },
    });
  }
  return copy;
}

// ─── Sections ────────────────────────────────────────────────────────────────

export async function createSection(tenantId: string, userId: string, projectId: string, name: string) {
  await assertProjectAccess(tenantId, userId, projectId);
  const max = await prisma.todoSection.aggregate({ where: { projectId }, _max: { order: true } });
  return prisma.todoSection.create({ data: { projectId, name: name.trim().slice(0, 120) || "Section", order: (max._max.order ?? 0) + 1 } });
}

export async function updateSection(tenantId: string, userId: string, sectionId: string, patch: { name?: string; order?: number }) {
  const section = await prisma.todoSection.findUnique({ where: { id: sectionId } });
  if (!section) throw err("Section not found", 404);
  await assertProjectAccess(tenantId, userId, section.projectId);
  return prisma.todoSection.update({
    where: { id: sectionId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 120) } : {}),
      ...(patch.order !== undefined ? { order: patch.order } : {}),
    },
  });
}

export async function deleteSection(tenantId: string, userId: string, sectionId: string) {
  const section = await prisma.todoSection.findUnique({ where: { id: sectionId } });
  if (!section) return;
  await assertProjectAccess(tenantId, userId, section.projectId);
  // Tasks keep their project; they just lose the section (SetNull via update
  // first so nothing is orphaned mid-delete).
  await prisma.todoTask.updateMany({ where: { sectionId }, data: { sectionId: null } });
  await prisma.todoSection.delete({ where: { id: sectionId } });
}

// ─── Labels & filters ────────────────────────────────────────────────────────

export async function createLabel(tenantId: string, name: string, color?: string) {
  const n = name.trim().slice(0, 60);
  if (!n) throw err("Give the label a name.", 400);
  const existing = await prisma.todoLabel.findUnique({ where: { tenantId_name: { tenantId, name: n } } });
  if (existing) return existing;
  const max = await prisma.todoLabel.aggregate({ where: { tenantId }, _max: { order: true } });
  return prisma.todoLabel.create({ data: { tenantId, name: n, color: color ?? "#c3c5c1", order: (max._max.order ?? 0) + 1 } });
}

export async function updateLabel(tenantId: string, labelId: string, patch: { name?: string; color?: string }) {
  const label = await prisma.todoLabel.findFirst({ where: { id: labelId, tenantId } });
  if (!label) throw err("Label not found", 404);
  return prisma.todoLabel.update({
    where: { id: labelId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 60) } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
    },
  });
}

export async function deleteLabel(tenantId: string, labelId: string) {
  const label = await prisma.todoLabel.findFirst({ where: { id: labelId, tenantId } });
  if (!label) return;
  await prisma.todoLabel.delete({ where: { id: labelId } });
}

export async function saveFilter(tenantId: string, userId: string, input: { id?: string; name: string; query: FilterQuery; isFavorite?: boolean }) {
  const name = input.name.trim().slice(0, 80) || "Filter";
  if (input.id) {
    const existing = await prisma.todoFilter.findFirst({ where: { id: input.id, tenantId, userId } });
    if (!existing) throw err("Filter not found", 404);
    return prisma.todoFilter.update({
      where: { id: input.id },
      data: { name, query: input.query as unknown as Prisma.InputJsonValue, ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}) },
    });
  }
  return prisma.todoFilter.create({
    data: { tenantId, userId, name, query: input.query as unknown as Prisma.InputJsonValue, isFavorite: input.isFavorite ?? false },
  });
}

export async function deleteFilter(tenantId: string, userId: string, filterId: string) {
  await prisma.todoFilter.deleteMany({ where: { id: filterId, tenantId, userId } });
}

// ─── Comments & attachments ─────────────────────────────────────────────────

export async function addComment(tenantId: string, userId: string, taskId: string, body: string) {
  const task = await assertTaskAccess(tenantId, userId, taskId);
  const text = body.trim().slice(0, 5000);
  if (!text) throw err("Write a comment first.", 400);
  const comment = await prisma.todoComment.create({ data: { taskId, authorId: userId, body: text } });
  await logActivity(taskId, userId, "comment");

  // @mentions → notifications (match by first name or full name, case-insensitive)
  const members = await prisma.formTenantUser.findMany({ where: { tenantId }, select: { id: true, name: true } });
  const lower = text.toLowerCase();
  const notified = new Set<string>();
  for (const m of members) {
    const first = extractFirstName(m.name)?.toLowerCase();
    if (!first || m.id === userId || notified.has(m.id)) continue;
    if (lower.includes(`@${first}`) || lower.includes(`@${m.name.toLowerCase()}`)) {
      notified.add(m.id);
      await notify({ tenantId, userId: m.id, actorId: userId, type: "mention", message: `mentioned you on "${task.title}"`, taskId });
    }
  }
  // Tell the assignee about new comments from others
  if (task.assigneeId && task.assigneeId !== userId && !notified.has(task.assigneeId)) {
    await notify({ tenantId, userId: task.assigneeId, actorId: userId, type: "comment", message: `commented on "${task.title}"`, taskId });
  }
  return comment;
}

export async function deleteComment(tenantId: string, userId: string, commentId: string) {
  const comment = await prisma.todoComment.findUnique({ where: { id: commentId } });
  if (!comment) return;
  await assertTaskAccess(tenantId, userId, comment.taskId);
  if (comment.authorId !== userId) throw err("Only the author can remove a comment.", 403);
  await prisma.todoComment.delete({ where: { id: commentId } });
}

// ─── Reminders ───────────────────────────────────────────────────────────────

export async function setReminder(tenantId: string, userId: string, taskId: string, input: { offsetMinutes?: number | null; remindAt?: string }) {
  const task = await assertTaskAccess(tenantId, userId, taskId);
  let remindAt: Date;
  let offsetMinutes: number | null = null;

  if (typeof input.offsetMinutes === "number") {
    if (!task.dueDate) throw err("Set a due date before adding a relative reminder.", 400);
    offsetMinutes = Math.max(0, Math.min(input.offsetMinutes, 60 * 24 * 14));
    const at = londonWallTimeToUtc(task.dueDate.toISOString().slice(0, 10), task.dueTime ?? "09:00");
    remindAt = new Date(at.getTime() - offsetMinutes * 60000);
  } else if (input.remindAt) {
    remindAt = new Date(input.remindAt);
    if (Number.isNaN(remindAt.getTime())) throw err("That reminder time isn't valid.", 400);
  } else {
    throw err("Choose when to be reminded.", 400);
  }

  const count = await prisma.todoReminder.count({ where: { taskId, userId } });
  if (count >= 5) throw err("Five reminders per task is plenty.", 400);
  return prisma.todoReminder.create({ data: { taskId, userId, remindAt, offsetMinutes } });
}

export async function deleteReminder(tenantId: string, userId: string, reminderId: string) {
  const reminder = await prisma.todoReminder.findUnique({ where: { id: reminderId } });
  if (!reminder) return;
  await assertTaskAccess(tenantId, userId, reminder.taskId);
  await prisma.todoReminder.delete({ where: { id: reminderId } });
}

// ─── Notifications ───────────────────────────────────────────────────────────

export async function listNotifications(tenantId: string, userId: string) {
  return prisma.todoNotification.findMany({
    where: { tenantId, userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markNotificationsRead(tenantId: string, userId: string, ids?: string[]) {
  await prisma.todoNotification.updateMany({
    where: { tenantId, userId, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export async function savePrefs(userId: string, data: Record<string, unknown>) {
  await prisma.todoUserPref.upsert({
    where: { userId },
    create: { userId, data: data as Prisma.InputJsonValue },
    update: { data: data as Prisma.InputJsonValue },
  });
}

// ─── Built-in template instantiation ────────────────────────────────────────

import { getTodoTemplate } from "./templates";

export async function createProjectFromBuiltinTemplate(tenantId: string, userId: string, templateId: string) {
  const template = getTodoTemplate(templateId);
  if (!template) throw err("Template not found", 404);
  const today = todayInLondon();

  const project = await createProject(tenantId, userId, {
    name: template.name,
    color: template.color,
    icon: template.icon,
    description: template.description,
    visibility: "team",
  });

  const sectionMap = new Map<string, string>();
  for (let i = 0; i < template.sections.length; i++) {
    const s = await prisma.todoSection.create({
      data: { projectId: project.id, name: template.sections[i], order: (i + 1) * 10 },
    });
    sectionMap.set(template.sections[i], s.id);
  }

  let order = 10;
  for (const t of template.tasks) {
    // Recurring template tasks start life on their next natural occurrence.
    const dueDate = t.recurrence ? nextOccurrence(t.recurrence, addDays(today, -1), today) : null;
    const task = await prisma.todoTask.create({
      data: {
        tenantId,
        title: t.title,
        description: t.description ?? null,
        projectId: project.id,
        sectionId: t.section ? sectionMap.get(t.section) ?? null : null,
        priority: t.priority ?? 4,
        order: order,
        recurrence: (t.recurrence ?? undefined) as Prisma.InputJsonValue | undefined,
        dueDate: dueDate ? new Date(`${dueDate}T00:00:00Z`) : null,
        createdById: userId,
      },
    });
    let subOrder = 10;
    for (const st of t.subtasks ?? []) {
      await prisma.todoTask.create({
        data: {
          tenantId,
          title: st,
          parentId: task.id,
          projectId: project.id,
          sectionId: task.sectionId,
          order: subOrder,
          createdById: userId,
        },
      });
      subOrder += 10;
    }
    order += 10;
  }
  return project;
}
