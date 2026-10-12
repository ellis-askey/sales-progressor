// Boardwalk To Do — shared domain types. Dependency-free (no React, no
// Prisma): used by the API layer, the service layer, and every client view.

// ─── Recurrence ──────────────────────────────────────────────────────────────
// Rules operate on CALENDAR DATES (Europe/London wall clock), never on UTC
// instants, so daylight-saving changes can't shift a task's day. See
// lib/todo/recurrence.ts for the engine.

export type RecurrenceFreq =
  | "daily"
  | "weekdays" // Mon–Fri
  | "weekly" // every N weeks on given weekdays
  | "monthly" // every N months on a day-of-month
  | "monthly_first_workday"
  | "yearly";

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  /** every N units (days for daily, weeks for weekly, months for monthly…) */
  interval: number;
  /** weekly: ISO weekdays 1 (Mon) … 7 (Sun) */
  weekdays?: number[];
  /** monthly: day of month 1–31 (clamped to month length) */
  monthDay?: number;
  /** yearly: month 1–12 (with monthDay) */
  month?: number;
  /** original phrase, shown in the UI ("every second friday") */
  label: string;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;
  sectionId: string | null;
  parentId: string | null;
  /** "YYYY-MM-DD" wall-clock date or null */
  dueDate: string | null;
  /** "HH:MM" or null */
  dueTime: string | null;
  duration: number | null;
  priority: number; // 1 highest … 4 none
  order: number;
  recurrence: RecurrenceRule | null;
  inboxOwnerId: string | null;
  assigneeId: string | null;
  createdById: string;
  completedAt: string | null;
  completedById: string | null;
  createdAt: string;
  labelIds: string[];
  subtaskCount: number;
  subtaskDone: number;
  commentCount: number;
}

export interface ProjectDto {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  visibility: "team" | "private";
  isTemplate: boolean;
  archivedAt: string | null;
  order: number;
  createdById: string;
  /** current user's relationship */
  isFavorite: boolean;
  viewPref: "list" | "board" | "calendar" | null;
  role: "owner" | "member" | null;
  memberIds: string[];
  activeTaskCount: number;
  sections: SectionDto[];
}

export interface SectionDto {
  id: string;
  projectId: string;
  name: string;
  order: number;
}

export interface LabelDto {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface TeamMemberDto {
  id: string;
  name: string;
  email: string;
}

export interface CommentDto {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface AttachmentDto {
  id: string;
  taskId: string;
  commentId: string | null;
  uploaderId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url?: string | null;
}

export interface ReminderDto {
  id: string;
  taskId: string;
  userId: string;
  remindAt: string; // ISO instant
  offsetMinutes: number | null;
  sentAt: string | null;
}

export interface ActivityDto {
  id: string;
  taskId: string;
  actorId: string;
  type: string;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  type: string;
  actorId: string | null;
  taskId: string | null;
  projectId: string | null;
  message: string;
  readAt: string | null;
  createdAt: string;
}

// ─── Saved filters ───────────────────────────────────────────────────────────

/** One condition line in the visual filter builder. */
export interface FilterCondition {
  field:
    | "due" // today | overdue | this_week | no_date | next_7_days
    | "priority" // 1-4
    | "assignee" // user id | "me" | "none"
    | "project" // project id
    | "label" // label id
    | "created"; // this_week
  value: string;
}

export interface FilterQuery {
  combinator: "and" | "or";
  conditions: FilterCondition[];
}

export interface FilterDto {
  id: string;
  name: string;
  query: FilterQuery;
  isFavorite: boolean;
  order: number;
}

// ─── Quick-add parse result ─────────────────────────────────────────────────

export interface ParsedQuickAdd {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  recurrence: RecurrenceRule | null;
  priority: number | null;
  /** #name token, matched against projects by the caller */
  projectToken: string | null;
  /** @name tokens, matched against labels by the caller */
  labelTokens: string[];
  /** +name token, matched against team members by the caller */
  assigneeToken: string | null;
}

// ─── Sidebar counts ─────────────────────────────────────────────────────────

export interface TodoCounts {
  inbox: number;
  today: number;
  overdue: number;
  upcoming: number;
  byProject: Record<string, number>;
  unreadNotifications: number;
}
