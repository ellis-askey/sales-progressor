// Command Centre shared formatters for the usage surfaces. Extracted from
// app/command/(protected)/agencies/page.tsx and the agent drill-down, which
// carried copy-pasted duplicates that had started to drift (CC rebuild PR3).
// Pure functions only: safe to import from server pages and client components.

export function fmtDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}

export function fmtHoursShort(seconds: number): string {
  const h = seconds / 3600;
  if (h >= 10) return `${Math.round(h)}h`;
  if (h >= 1) return `${h.toFixed(1)}h`;
  const m = Math.round(seconds / 60);
  return m > 0 ? `${m}m` : "0";
}

export function fmtRelative(d: Date | null): string {
  if (!d) return "never";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days >= 2) return `${days} days ago`;
  if (days === 1) return "yesterday";
  const hrs = Math.floor((Date.now() - new Date(d).getTime()) / 3_600_000);
  if (hrs >= 1) return `${hrs}h ago`;
  return "just now";
}

export function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

const AV_COLORS = ["#8b9dff", "#34d399", "#e0a44a", "#f0716f", "#c084fc", "#38bdf8"];

export function avColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}
