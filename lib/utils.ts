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

/** Format a Date with time — "Today, 14:32" / "19 May, 14:32" / "19 May 2026, 14:32" */
export function formatTimestamp(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  const now = new Date();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return `Today, ${time}`;
  const isThisYear = d.getFullYear() === now.getFullYear();
  const datePart = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(isThisYear ? {} : { year: "numeric" }),
  });
  return `${datePart}, ${time}`;
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

/**
 * Title-case each word, but leave a word untouched when the user typed two or
 * more capital letters in a row (an acronym like "ABC" or "PLC"). Use for
 * user-entered names and agency names where acronyms must survive — plain
 * titleCase() above force-lowercases and would turn "ABC Estates" into
 * "Abc Estates".
 */
export function titleCaseKeepAcronyms(str: string): string {
  return str.trim().replace(/\S+/g, (word) =>
    /[A-Z]{2,}/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );
}

const NAME_PREFIXES = new Set(["mr","mrs","ms","miss","dr","prof","sir","lord","lady","rev"]);
const NAME_SUFFIXES = new Set(["jr","sr","ii","iii","iv","phd","md","esq","mbe","obe","cbe"]);

export function getFirstName(fullName: string): string {
  if (!fullName.trim()) return "";
  const parts = fullName.trim().split(/\s+/);
  for (const part of parts) {
    const lower = part.replace(/[.,]/g, "").toLowerCase();
    if (!NAME_PREFIXES.has(lower) && !NAME_SUFFIXES.has(lower)) {
      return titleCase(part.replace(/[.,]/g, ""));
    }
  }
  return titleCase(parts[0]!.replace(/[.,]/g, ""));
}

/**
 * Returns the name to address a contact by in a greeting.
 *   "Mrs Mary Parsons" → "Mary"
 *   "Mary Parsons"     → "Mary"
 *   "Mary"             → "Mary"
 *   "Mrs Parsons"      → "Mrs Parsons"   (formal — title kept when no first name)
 *   "Dr Smith"         → "Dr Smith"
 *   "Mrs"              → "there"
 *   ""                 → "there"
 */
export function greetingName(fullName: string): string {
  if (!fullName.trim()) return "there";
  const parts = fullName.trim().split(/\s+/).map((p) => p.replace(/[.,]/g, ""));
  const nonTitle = parts.filter(
    (p) => !NAME_PREFIXES.has(p.toLowerCase()) && !NAME_SUFFIXES.has(p.toLowerCase())
  );
  if (nonTitle.length === 0) return "there";
  if (nonTitle.length === 1) {
    const titles = parts.filter((p) => NAME_PREFIXES.has(p.toLowerCase())).map(titleCase);
    return titles.length > 0
      ? [...titles, titleCase(nonTitle[0])].join(" ")
      : titleCase(nonTitle[0]);
  }
  return titleCase(nonTitle[0]);
}

/** Normalise a UK postcode to "XX## #XX" format with a single space. */
export function normalizePostcode(raw: string): string {
  const clean = raw.replace(/\s+/g, "").toUpperCase();
  if (clean.length < 5) return clean;
  return clean.slice(0, -3) + " " + clean.slice(-3);
}

export function normalizePhone(phone: string): string {
  const cleaned = phone.trim();
  if (!cleaned) return cleaned;

  // Strip common formatting, normalise international prefix → local 0xx
  let digits = cleaned.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+44")) digits = "0" + digits.slice(3);
  else if (digits.startsWith("0044")) digits = "0" + digits.slice(4);

  // Must look like a UK number: leading 0 + 9–10 more digits
  if (!/^0[1-9]\d{8,9}$/.test(digits)) return cleaned;

  // Mobile (07xxx) → international +44 format
  if (digits.startsWith("07")) {
    return "+44" + digits.slice(1);
  }

  // London / geographic 02x codes (020, 023, 024, 028, 029) → "0xx xxxx xxxx"
  if (digits.startsWith("02")) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  }

  // Major city 4-digit codes (0113–0118, 0121, 0131, 0141, 0151, 0161, 0191) → "01xx xxx xxxx"
  if (/^01(?:1[3-8]|[2-9]1)/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  // Non-geographic 03xx, 08xx, 09xx → "0xxx xxx xxxx"
  if (/^0[389]/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  // Remaining 01xxx (5-digit area codes, 11 digits total) → "01xxx xxxxxx"
  if (digits.startsWith("01") && digits.length === 11) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  return cleaned;
}

/**
 * Build a list of phone-search variants to OR-search a stored phone field.
 *
 * The search box gets used with whatever format the agent types — typically a
 * UK mobile in domestic form (07700900123 or 07700 900 123). But phone numbers
 * in the database are stored in international form (+447700900123). A naive
 * `contains` against the typed query never matches.
 *
 * This helper turns the user's typed query into every representation the same
 * underlying digits could plausibly take in storage, so a single OR'd `contains`
 * lookup finds the contact regardless of which format their phone was saved in.
 *
 * Returns an empty array when the query doesn't look phone-like (no digits, or
 * fewer than 4 contiguous digits), so callers can short-circuit and fall back
 * to name-only search without polluting the query plan.
 */
export function phoneSearchVariants(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Strip whitespace + common separators, preserve "+" so prefix detection works.
  const tight = trimmed.replace(/[\s\-().]/g, "");
  const digitsOnly = tight.replace(/[^\d]/g, "");
  // Need at least 4 digits to be a meaningful phone fragment — anything shorter
  // would cross-match unrelated numbers (e.g. "07" would match every UK mobile).
  if (digitsOnly.length < 4) return [];

  // Canonical UK domestic form: replace any +44 / 0044 prefix with a leading 0.
  let canonical = tight;
  if (canonical.startsWith("+44")) canonical = "0" + canonical.slice(3);
  else if (canonical.startsWith("0044")) canonical = "0" + canonical.slice(4);
  canonical = canonical.replace(/^\+/, "");

  const variants = new Set<string>();
  variants.add(tight);       // exact (handles already-formatted stored values)
  variants.add(digitsOnly);  // digits with no separators, no prefix decisions
  variants.add(canonical);   // UK domestic with leading 0

  // If the canonical form looks like a full UK number with a leading 0, also
  // generate its international representations so a domestic-typed query finds
  // an internationally-stored value (and vice versa).
  if (canonical.startsWith("0") && canonical.length >= 5) {
    const withoutLeading = canonical.slice(1);
    variants.add(withoutLeading);            // e.g. 7700900123
    variants.add("+44" + withoutLeading);    // e.g. +447700900123
    variants.add("0044" + withoutLeading);   // e.g. 00447700900123
    variants.add("44" + withoutLeading);     // e.g. 447700900123 (matches stored "+447..." via substring)
  }

  // Drop anything too short to be useful (re-enforces the 4-digit floor after
  // prefix stripping turned "07" into "7").
  return [...variants].filter((v) => v.length >= 4);
}

/** Human-readable labels for transaction statuses */
export const STATUS_LABELS: Record<TransactionStatus, string> = {
  draft:     "Draft",
  active:    "Active",
  on_hold:   "On hold",
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

/** Returns "YYYY-MM-DD" in Europe/London timezone — timezone-safe for UK comparisons */
export function toUKDateStr(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date(date));
}

/** Days until a future date (negative = past), compared in Europe/London timezone */
export function daysUntil(date: Date | string): number {
  const todayStr = toUKDateStr(new Date());
  const dueStr = toUKDateStr(new Date(date));
  return Math.round((new Date(dueStr).getTime() - new Date(todayStr).getTime()) / 86400000);
}

// Renders an active-elapsed day count as a human label for the Progress card.
// 0 -> "Just started"; 1-6 -> "N day(s) elapsed"; exact weeks -> "N week(s) elapsed";
// mixed -> "N week(s) M day(s) elapsed". Compact swaps "week/day" for "wk/d"
// and keeps the " elapsed" suffix off (the narrow sidebar variant).
export function formatElapsedDays(days: number, opts?: { compact?: boolean }): string {
  const d = Math.max(0, Math.floor(days));
  const compact = opts?.compact ?? false;
  if (d === 0) return "Just started";

  const weeks = Math.floor(d / 7);
  const remDays = d % 7;
  const wkUnit = compact ? "wk" : "week";
  const dUnit = compact ? "d" : "day";
  const tail = compact ? "" : " elapsed";

  const wkPart = weeks > 0 ? `${weeks} ${wkUnit}${weeks !== 1 ? "s" : ""}` : "";
  const dPart  = remDays > 0 ? `${remDays} ${dUnit}${remDays !== 1 ? "s" : ""}` : "";

  if (wkPart && dPart) return `${wkPart} ${dPart}${tail}`;
  return `${wkPart || dPart}${tail}`;
}
