"use client";

// Boardwalk To Do client store. One provider at the /boardwalk/todo layout:
// bootstrap data (projects, labels, filters, team, counts), a per-view task
// cache, and OPTIMISTIC mutations — every change lands in the UI instantly,
// saves in the background, and rolls back with a toast if the server
// disagrees. Completing shows a 5-second undo.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formsApi } from "@/lib/forms/client";
import type {
  FilterDto,
  FilterQuery,
  LabelDto,
  ProjectDto,
  TaskDto,
  TeamMemberDto,
  TodoCounts,
} from "@/lib/todo/types";
import { useBwToast } from "../ui";
import { getSmartFilter } from "./smartFilters";

export type ViewKey = string; // "inbox" | "today" | "upcoming:FROM:TO" | "completed" | "project:ID" | "label:ID" | "filter:ID" | "search:Q"

interface Bootstrap {
  projects: ProjectDto[];
  labels: LabelDto[];
  filters: FilterDto[];
  members: TeamMemberDto[];
  prefs: Record<string, unknown>;
  counts: TodoCounts;
  unreadNotifications: number;
}

export interface TaskPatch {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  priority?: number;
  assigneeId?: string | null;
  projectId?: string | null;
  sectionId?: string | null;
  labelIds?: string[];
  recurrence?: TaskDto["recurrence"];
  duration?: number | null;
  order?: number;
}

interface TodoStore {
  ready: boolean;
  me: string;
  projects: ProjectDto[];
  labels: LabelDto[];
  filters: FilterDto[];
  members: TeamMemberDto[];
  counts: TodoCounts;
  prefs: Record<string, unknown>;
  memberName: (id: string | null | undefined) => string;

  views: Record<ViewKey, TaskDto[] | undefined>;
  loadView: (key: ViewKey, force?: boolean) => Promise<void>;

  addTask: (input: Record<string, unknown>, intoView?: ViewKey) => Promise<TaskDto | null>;
  patchTask: (id: string, patch: TaskPatch) => Promise<TaskDto | null>;
  completeTask: (id: string, completed?: boolean) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  duplicateTask: (id: string) => Promise<void>;
  reorder: (key: ViewKey, orderedIds: string[], target?: { projectId?: string | null; sectionId?: string | null }) => Promise<void>;
  bulkPatch: (ids: string[], patch: TaskPatch) => Promise<void>;

  selection: Set<string>;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;

  openTaskId: string | null;
  openTask: (id: string | null) => void;
  quickAddOpen: boolean;
  quickAddDefaults: Record<string, unknown>;
  openQuickAdd: (defaults?: Record<string, unknown>) => void;
  closeQuickAdd: () => void;

  refreshBootstrap: () => Promise<void>;
  refreshCounts: () => void;
  savePrefs: (patch: Record<string, unknown>) => void;
  runFilterQuery: (query: FilterQuery) => Promise<TaskDto[]>;
}

const TodoContext = createContext<TodoStore | null>(null);

export function useTodo(): TodoStore {
  const ctx = useContext(TodoContext);
  if (!ctx) throw new Error("useTodo outside TodoProvider");
  return ctx;
}

export function TodoProvider({ me, children }: { me: string; children: ReactNode }) {
  const { toast } = useBwToast();
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [views, setViews] = useState<Record<ViewKey, TaskDto[] | undefined>>({});
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDefaults, setQuickAddDefaults] = useState<Record<string, unknown>>({});
  const loading = useRef<Set<string>>(new Set());
  const countsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshBootstrap = useCallback(async () => {
    const data = await formsApi<Bootstrap>("/api/todo/bootstrap");
    setBoot(data);
  }, []);

  useEffect(() => {
    void refreshBootstrap().catch(() => toast("Couldn't load your tasks. Refresh to try again.", "error"));
  }, [refreshBootstrap, toast]);

  const refreshCounts = useCallback(() => {
    if (countsTimer.current) clearTimeout(countsTimer.current);
    countsTimer.current = setTimeout(async () => {
      try {
        const counts = await formsApi<TodoCounts>("/api/todo/counts");
        setBoot((b) => (b ? { ...b, counts } : b));
      } catch {
        // counts are cosmetic — never surface an error for them
      }
    }, 600);
  }, []);

  // ── view loading ──
  const loadView = useCallback(async (key: ViewKey, force = false) => {
    if (!force && (loading.current.has(key))) return;
    loading.current.add(key);
    try {
      const params = new URLSearchParams();
      const [kind, a, b] = key.split(":");
      if (kind === "inbox" || kind === "today" || kind === "completed") params.set("view", kind);
      else if (kind === "upcoming") {
        params.set("view", "upcoming");
        if (a) params.set("from", a);
        if (b) params.set("to", b);
      } else if (kind === "project") {
        params.set("view", "project");
        params.set("projectId", a);
      } else if (kind === "label") {
        params.set("view", "label");
        params.set("labelId", a);
      } else if (kind === "search") {
        params.set("view", "search");
        params.set("search", key.slice(7));
      } else if (kind === "filter") {
        params.set("view", "filter");
        const f = bootRef.current?.filters.find((x) => x.id === a);
        params.set("filter", JSON.stringify(f?.query ?? { combinator: "and", conditions: [] }));
      } else if (kind === "smart") {
        params.set("view", "filter");
        params.set("filter", JSON.stringify(getSmartFilter(a)?.query ?? { combinator: "and", conditions: [] }));
      }
      const res = await formsApi<{ tasks: TaskDto[] }>(`/api/todo/tasks?${params}`);
      setViews((v) => ({ ...v, [key]: res.tasks }));
    } finally {
      loading.current.delete(key);
    }
  }, []);

  const bootRef = useRef<Bootstrap | null>(null);
  bootRef.current = boot;

  // ── cache surgery ──
  const replaceEverywhere = useCallback((task: TaskDto) => {
    setViews((v) => {
      const next: typeof v = {};
      for (const [key, list] of Object.entries(v)) {
        next[key] = list?.map((t) => (t.id === task.id ? task : t));
      }
      return next;
    });
  }, []);

  const removeEverywhere = useCallback((id: string) => {
    setViews((v) => {
      const next: typeof v = {};
      for (const [key, list] of Object.entries(v)) {
        next[key] = list?.filter((t) => t.id !== id);
      }
      return next;
    });
  }, []);

  // ── mutations ──
  const addTask = useCallback(
    async (input: Record<string, unknown>, intoView?: ViewKey) => {
      const tempId = `tmp_${Math.random().toString(36).slice(2)}`;
      const optimistic: TaskDto = {
        id: tempId,
        title: String(input.title ?? ""),
        description: (input.description as string) ?? null,
        projectId: (input.projectId as string) ?? null,
        sectionId: (input.sectionId as string) ?? null,
        parentId: (input.parentId as string) ?? null,
        dueDate: (input.dueDate as string) ?? null,
        dueTime: (input.dueTime as string) ?? null,
        duration: null,
        priority: (input.priority as number) ?? 4,
        order: Date.now(),
        recurrence: (input.recurrence as TaskDto["recurrence"]) ?? null,
        inboxOwnerId: input.projectId ? null : me,
        assigneeId: (input.assigneeId as string) ?? null,
        createdById: me,
        completedAt: null,
        completedById: null,
        createdAt: new Date().toISOString(),
        labelIds: (input.labelIds as string[]) ?? [],
        subtaskCount: 0,
        subtaskDone: 0,
        commentCount: 0,
      };
      if (intoView) {
        setViews((v) => ({ ...v, [intoView]: [...(v[intoView] ?? []), optimistic] }));
      }
      try {
        const res = await formsApi<{ task: TaskDto }>("/api/todo/tasks", {
          method: "POST",
          body: JSON.stringify(input),
        });
        setViews((v) => {
          const next: typeof v = {};
          for (const [key, list] of Object.entries(v)) {
            next[key] = list?.map((t) => (t.id === tempId ? res.task : t));
          }
          return next;
        });
        refreshCounts();
        return res.task;
      } catch (err) {
        removeEverywhere(tempId);
        toast((err as Error).message, "error");
        return null;
      }
    },
    [me, refreshCounts, removeEverywhere, toast]
  );

  const patchTask = useCallback(
    async (id: string, patch: TaskPatch) => {
      // optimistic apply
      let before: TaskDto | undefined;
      setViews((v) => {
        const next: typeof v = {};
        for (const [key, list] of Object.entries(v)) {
          next[key] = list?.map((t) => {
            if (t.id !== id) return t;
            before = before ?? t;
            return { ...t, ...patch, recurrence: patch.recurrence !== undefined ? patch.recurrence : t.recurrence } as TaskDto;
          });
        }
        return next;
      });
      try {
        const res = await formsApi<{ task: TaskDto }>(`/api/todo/tasks/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        replaceEverywhere(res.task);
        refreshCounts();
        return res.task;
      } catch (err) {
        if (before) replaceEverywhere(before);
        toast((err as Error).message, "error");
        return null;
      }
    },
    [refreshCounts, replaceEverywhere, toast]
  );

  const completeTask = useCallback(
    async (id: string, completed = true) => {
      let snapshot: TaskDto | undefined;
      for (const list of Object.values(views)) {
        snapshot = snapshot ?? list?.find((t) => t.id === id);
      }
      const isRecurring = !!snapshot?.recurrence;

      if (completed && !isRecurring) {
        // optimistic strike-through then removal from active views
        setViews((v) => {
          const next: typeof v = {};
          for (const [key, list] of Object.entries(v)) {
            next[key] = key.startsWith("completed")
              ? list
              : list?.map((t) => (t.id === id ? { ...t, completedAt: new Date().toISOString() } : t));
          }
          return next;
        });
        setTimeout(() => {
          setViews((v) => {
            const next: typeof v = {};
            for (const [key, list] of Object.entries(v)) {
              next[key] = key.startsWith("completed") ? list : list?.filter((t) => !(t.id === id && t.completedAt));
            }
            return next;
          });
        }, 350);
      }

      try {
        const res = await formsApi<{ task: TaskDto }>(`/api/todo/tasks/${id}/complete`, {
          method: "POST",
          body: JSON.stringify({ completed }),
        });
        if (isRecurring && completed) {
          replaceEverywhere(res.task);
          toast(`Done. Next: ${res.task.dueDate ?? "soon"}`, "ok");
        } else if (completed) {
          removeEverywhere(id);
          toast("Completed.", "ok", {
            actionLabel: "Undo",
            onAction: () => void completeTask(id, false),
          });
        } else {
          // reopened — refresh affected views lazily
          setViews((v) => {
            const next: typeof v = { ...v };
            delete next["completed"];
            return next;
          });
          replaceEverywhere(res.task);
          for (const key of Object.keys(views)) void loadView(key, true);
        }
        refreshCounts();
      } catch (err) {
        if (snapshot) replaceEverywhere(snapshot);
        toast((err as Error).message, "error");
      }
    },
    [loadView, refreshCounts, removeEverywhere, replaceEverywhere, toast, views]
  );

  const removeTask = useCallback(
    async (id: string) => {
      removeEverywhere(id);
      try {
        await formsApi(`/api/todo/tasks/${id}`, { method: "DELETE" });
        refreshCounts();
        toast("Task removed.");
      } catch (err) {
        toast((err as Error).message, "error");
        for (const key of Object.keys(views)) void loadView(key, true);
      }
    },
    [loadView, refreshCounts, removeEverywhere, toast, views]
  );

  const duplicateTask = useCallback(
    async (id: string) => {
      try {
        await formsApi(`/api/todo/tasks/${id}/duplicate`, { method: "POST" });
        for (const key of Object.keys(views)) void loadView(key, true);
        refreshCounts();
        toast("Task duplicated.");
      } catch (err) {
        toast((err as Error).message, "error");
      }
    },
    [loadView, refreshCounts, toast, views]
  );

  const reorder = useCallback(
    async (key: ViewKey, orderedIds: string[], target?: { projectId?: string | null; sectionId?: string | null }) => {
      setViews((v) => {
        const list = v[key];
        if (!list) return v;
        const byId = new Map(list.map((t) => [t.id, t]));
        const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as TaskDto[];
        const rest = list.filter((t) => !orderedIds.includes(t.id));
        return { ...v, [key]: [...reordered, ...rest] };
      });
      try {
        await formsApi("/api/todo/tasks/bulk", {
          method: "POST",
          body: JSON.stringify({ op: "reorder", orderedIds, target }),
        });
      } catch (err) {
        toast((err as Error).message, "error");
        void loadView(key, true);
      }
    },
    [loadView, toast]
  );

  const bulkPatch = useCallback(
    async (ids: string[], patch: TaskPatch) => {
      try {
        await formsApi("/api/todo/tasks/bulk", {
          method: "POST",
          body: JSON.stringify({ op: "patch", taskIds: ids, patch }),
        });
        setSelection(new Set());
        for (const key of Object.keys(views)) void loadView(key, true);
        refreshCounts();
        toast(`${ids.length} task${ids.length === 1 ? "" : "s"} updated.`);
      } catch (err) {
        toast((err as Error).message, "error");
      }
    },
    [loadView, refreshCounts, toast, views]
  );

  const runFilterQuery = useCallback(async (query: FilterQuery) => {
    const params = new URLSearchParams();
    params.set("view", "filter");
    params.set("filter", JSON.stringify(query));
    const res = await formsApi<{ tasks: TaskDto[] }>(`/api/todo/tasks?${params}`);
    return res.tasks;
  }, []);

  const savePrefs = useCallback(
    (patch: Record<string, unknown>) => {
      setBoot((b) => (b ? { ...b, prefs: { ...b.prefs, ...patch } } : b));
      const merged = { ...(bootRef.current?.prefs ?? {}), ...patch };
      void formsApi("/api/todo/prefs", { method: "POST", body: JSON.stringify(merged) }).catch(() => {});
    },
    []
  );

  const memberName = useCallback(
    (id: string | null | undefined) => {
      if (!id) return "";
      return boot?.members.find((m) => m.id === id)?.name ?? "";
    },
    [boot]
  );

  const store = useMemo<TodoStore>(
    () => ({
      ready: !!boot,
      me,
      projects: boot?.projects ?? [],
      labels: boot?.labels ?? [],
      filters: boot?.filters ?? [],
      members: boot?.members ?? [],
      counts: boot?.counts ?? { inbox: 0, today: 0, overdue: 0, upcoming: 0, byProject: {}, unreadNotifications: 0 },
      prefs: boot?.prefs ?? {},
      memberName,
      views,
      loadView,
      addTask,
      patchTask,
      completeTask,
      removeTask,
      duplicateTask,
      reorder,
      bulkPatch,
      selection,
      toggleSelect: (id) =>
        setSelection((s) => {
          const next = new Set(s);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      clearSelection: () => setSelection(new Set()),
      openTaskId,
      openTask: setOpenTaskId,
      quickAddOpen,
      quickAddDefaults,
      openQuickAdd: (defaults) => {
        setQuickAddDefaults(defaults ?? {});
        setQuickAddOpen(true);
      },
      closeQuickAdd: () => setQuickAddOpen(false),
      refreshBootstrap,
      refreshCounts,
      savePrefs,
      runFilterQuery,
    }),
    [boot, me, memberName, views, loadView, addTask, patchTask, completeTask, removeTask, duplicateTask, reorder, bulkPatch, selection, openTaskId, quickAddOpen, quickAddDefaults, refreshBootstrap, refreshCounts, savePrefs, runFilterQuery]
  );

  return <TodoContext.Provider value={store}>{children}</TodoContext.Provider>;
}
