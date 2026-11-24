// Pure helpers ported verbatim-in-spirit from AgentTodoList + ReviewsSection, so
// grouping, sorting and the due-date semantics match the live page exactly. Date
// boundaries use the same toUKDateStr the production components use.
import { toUKDateStr } from "@/lib/utils";
import type { Task, ReviewItem, DueTone } from "./types";

export function splitAddress(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 2) return { line: parts[0] ?? address, location: parts.slice(1).join(" · ") };
  return { line: parts.slice(0, -2).join(", "), location: parts.slice(-2).join(" · ") };
}

export function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const todayStr = () => toUKDateStr(new Date());

// Task due status — AgentTodoList.getDueStatus, tones instead of CSS vars.
export function taskDue(dueDate: Date | string): { label: string; tone: DueTone; reassure: boolean } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - due.getTime()) / 86400000);
  if (diff < 0) {
    if (diff === -1) return { label: "Due tomorrow", tone: "muted", reassure: false };
    return { label: `Due ${fmtDate(dueDate)}`, tone: "muted", reassure: false };
  }
  if (diff === 0) return { label: "Due today", tone: "warn", reassure: true };
  if (diff === 1) return { label: "Due yesterday", tone: "warn", reassure: true };
  if (diff <= 3) return { label: "Overdue", tone: "warn", reassure: true };
  return { label: `Overdue · ${diff} days`, tone: "danger", reassure: false };
}

// Review due label — ReviewsSection.dueLabel.
export function reviewDue(reviewDate: Date | string | null): { label: string; tone: DueTone; due: boolean } {
  if (!reviewDate) return { label: "No date", tone: "muted", due: false };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(reviewDate); d.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff < -1) return { label: `Due ${fmtDate(reviewDate)}`, tone: "muted", due: false };
  if (diff === -1) return { label: "Due tomorrow", tone: "muted", due: false };
  if (diff === 0) return { label: "Due today", tone: "warn", due: true };
  if (diff === 1) return { label: "Due back yesterday", tone: "warn", due: true };
  if (diff <= 3) return { label: `Due back ${diff} days ago`, tone: "warn", due: true };
  return { label: `Due back ${diff} days ago`, tone: "danger", due: true };
}

export const ORIGIN_META: Record<string, { label: string; tone: "warn" | "info" | "coral" }> = {
  hold: { label: "On hold", tone: "warn" },
  chain_wait: { label: "Chain wait", tone: "info" },
  remarketing: { label: "Remarketing", tone: "coral" },
};

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (ad !== bd) return ad - bd;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export type Group = { transactionId: string | null; address: string | null; tasks: Task[] };
export function groupByTransaction(tasks: Task[]): Group[] {
  const map = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const key = t.transactionId ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  const groups: Group[] = [];
  for (const [txId, txTasks] of map.entries()) {
    groups.push({ transactionId: txId, address: txTasks[0].transaction?.propertyAddress ?? null, tasks: txTasks });
  }
  return groups.sort((a, b) => (a.transactionId === null ? 1 : b.transactionId === null ? -1 : 0));
}

// Three-way partition — AgentTodoList. Reviews (isReview) are excluded (they live
// in the Reviews bucket), matching the live page.
export function partition(tasks: Task[]) {
  const visible = tasks.filter((t) => !t.isReview);
  return {
    internal: visible.filter((t) => t.isInternalSelfAssigned),
    own: visible.filter((t) => !t.isInternalSelfAssigned && !t.isAgentRequest),
    prog: visible.filter((t) => !t.isInternalSelfAssigned && t.isAgentRequest),
  };
}

export function overdueUpcoming(open: Task[]) {
  const today = todayStr();
  return {
    overdue: open.filter((t) => t.dueDate && toUKDateStr(t.dueDate) < today),
    upcoming: open.filter((t) => !t.dueDate || toUKDateStr(t.dueDate) >= today),
  };
}

export const reviewKind = (r: ReviewItem) => (r as { kind: string }).kind as "hold" | "manual";
export function reviewDate(r: ReviewItem): Date | null {
  const v = (r as { reviewDate?: Date | string | null }).reviewDate;
  return v ? new Date(v) : null;
}
export function reviewKey(r: ReviewItem): string {
  return (r as { key: string }).key;
}
