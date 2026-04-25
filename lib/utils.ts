// lib/utils.ts
// Shared utility functions.

import type { TransactionStatus, ContactRole } from "@prisma/client";

/** Format a Date to a readable UK-style string */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

/** Default exchange date: today + 12 months */
export function defaultExchangeDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

/**
 * Capitalise each word in a string.
 * Used for name and address formatting before saving.
 */
export function titleCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizePhone(phone: string): string {
  const cleaned = phone.trim();
  if (!cleaned) return cleaned;
  const digits = cleaned.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+44")) return digits;
  if (/^0[1-9]/.test(digits)) return "+44" + digits.slice(1);
  return cleaned;
}

/** Human-readable labels for transaction statuses */
export const STATUS_LABELS: Record<TransactionStatus, string> = {
  draft:     "Draft",
  active:    "Active",
  on_hold:   "On Hold",
  completed: "Completed",
  withdrawn: "Withdrawn",
};

/** Light-theme Tailwind colour classes per status */
export const STATUS_COLORS: Record<TransactionStatus, string> = {
  draft:     "text-slate-500  bg-slate-50  border-slate-200",
  active:    "text-green-700  bg-green-50  border-green-200",
  on_hold:   "text-amber-700  bg-amber-50  border-amber-200",
  completed: "text-slate-500  bg-slate-50  border-slate-200",
  withdrawn: "text-red-600    bg-red-50    border-red-200",
};

/** Dot colours per status */
export const STATUS_DOT_COLORS: Record<TransactionStatus, string> = {
  draft:     "bg-slate-300",
  active:    "bg-green-500",
  on_hold:   "bg-amber-500",
  completed: "bg-slate-400",
  withdrawn: "bg-red-500",
};

/** Card accent colours for summary cards */
export const STATUS_CARD: Record<TransactionStatus, { dot: string; number: string; bg: string; border: string }> = {
  draft:     { dot: "bg-slate-300",  number: "text-slate-500",  bg: "bg-slate-50",  border: "border-slate-100" },
  active:    { dot: "bg-green-500",  number: "text-green-700",  bg: "bg-green-50",  border: "border-green-100" },
  on_hold:   { dot: "bg-amber-500",  number: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-100" },
  completed: { dot: "bg-slate-400",  number: "text-slate-600",  bg: "bg-slate-50",  border: "border-slate-100" },
  withdrawn: { dot: "bg-red-500",    number: "text-red-600",    bg: "bg-red-50",    border: "border-red-100"  },
};

/** Human-readable labels for contact role types */
export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  vendor:    "Vendor",
  purchaser: "Purchaser",
  solicitor: "Solicitor",
  broker:    "Broker / IFA",
  other:     "Other",
};

/** All transaction status options for selects */
export const TRANSACTION_STATUSES: { value: TransactionStatus; label: string }[] = [
  { value: "active",    label: "Active" },
  { value: "on_hold",   label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "withdrawn", label: "Withdrawn" },
];

/** All contact role options for selects */
export const CONTACT_ROLES: { value: ContactRole; label: string }[] = [
  { value: "vendor",    label: "Vendor" },
  { value: "purchaser", label: "Purchaser" },
  { value: "solicitor", label: "Solicitor" },
  { value: "broker",    label: "Broker / IFA" },
  { value: "other",     label: "Other" },
];

/** Simple cn() helper for conditional class joining */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Format a date as a relative string: "Today", "Yesterday", "3 days ago" */
export function relativeDate(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "Last week";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

/** Days until a future date (negative = past) */
export function daysUntil(date: Date | string): number {
  const now = new Date();
  const d = new Date(date);
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}
