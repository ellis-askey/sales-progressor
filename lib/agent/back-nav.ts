// Context-aware "Back" for the property file page (critique).
//
// Every link into a file carries a `?from=<origin path>` marker. The file hero's
// Back link reads it and returns you to where you came from — hub, enquiries,
// completions, another file, etc. When there's no marker (deep link, refresh,
// new tab) or it isn't a trusted internal path, we fall back to the all-files
// list, exactly as before.

const FALLBACK = { href: "/agent/transactions", label: "Back to files" } as const;

// Longest / most specific prefixes first. A file path (/agent/transactions/<id>)
// must be tested before the list path (/agent/transactions).
const LABELS: Array<{ prefix: string; label: string }> = [
  { prefix: "/agent/hub", label: "Back to hub" },
  { prefix: "/agent/enquiries", label: "Back to enquiries" },
  { prefix: "/agent/completions", label: "Back to completions" },
  { prefix: "/agent/work-queue", label: "Back to reminders" },
  { prefix: "/agent/todo", label: "Back to to-do" },
  { prefix: "/agent/partners", label: "Back to partners" },
  { prefix: "/agent/analytics", label: "Back to analytics" },
  { prefix: "/agent/clients", label: "Back to client" },
  { prefix: "/agent/transactions/", label: "Back" }, // file -> file (one step back)
  { prefix: "/agent/transactions", label: "Back to files" },
];

// Only same-origin internal paths are honoured — never an absolute URL or a
// protocol-relative //host, so `?from=` can't be used to bounce off-site.
function isTrustedInternalPath(p: string): boolean {
  if (!p.startsWith("/agent/")) return false;
  if (p.startsWith("//")) return false;
  if (/\s/.test(p)) return false;
  return true;
}

export function resolveBackTarget(from: string | null | undefined): { href: string; label: string } {
  if (!from) return { ...FALLBACK };
  let decoded: string;
  try {
    decoded = decodeURIComponent(from);
  } catch {
    return { ...FALLBACK };
  }
  if (!isTrustedInternalPath(decoded)) return { ...FALLBACK };
  const rule = LABELS.find((r) => decoded === r.prefix || decoded.startsWith(r.prefix) || decoded.startsWith(`${r.prefix}?`));
  return { href: decoded, label: rule?.label ?? FALLBACK.label };
}

// Append a `?from=<origin>` marker to a file link. `origin` is the path of the
// page the link sits on (include its query string when it carries state worth
// returning to, e.g. a filtered list). Existing query on `href` is preserved.
export function withFrom(href: string, origin: string): string {
  if (!origin) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}from=${encodeURIComponent(origin)}`;
}

// ── Automatic origin capture ─────────────────────────────────────────────────
// Most links into a file never bother to add `?from=`, so Back fell back to
// "all files". FileBackTracker (mounted once in the agent layout) records the
// path you were on just before entering each file; the hero's Back uses it when
// there's no explicit `?from=`. This makes "back to where I came from" work from
// everywhere — reminders, Focus, search, recently-viewed, anywhere — without
// touching every call site. An explicit `?from=` still wins (it's shareable).

export const FILE_ORIGIN_EVENT = "sp:file-origin";
const ORIGIN_PREFIX = "spFileOrigin:";

// The file id from a file path (/agent/transactions/<id>[/tab]); null for the
// list route (/agent/transactions) or any non-file path.
export function fileIdFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const m = path.match(/^\/agent\/transactions\/([^/?#]+)/);
  const id = m?.[1];
  if (!id || id.startsWith("(")) return null; // route-group segment, not an id
  return id;
}

export function recordFileOrigin(fileId: string, origin: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${ORIGIN_PREFIX}${fileId}`, origin);
    window.dispatchEvent(new Event(FILE_ORIGIN_EVENT));
  } catch { /* storage unavailable (private mode / quota) — Back just falls back */ }
}

export function readFileOrigin(fileId: string | null | undefined): string | null {
  if (typeof window === "undefined" || !fileId) return null;
  try {
    return sessionStorage.getItem(`${ORIGIN_PREFIX}${fileId}`);
  } catch {
    return null;
  }
}
