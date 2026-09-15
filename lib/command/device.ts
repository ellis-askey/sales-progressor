// Server-side device classification from a stored User-Agent string.
// Used by the Command Centre agent-usage view to split agent activity into
// mobile vs desktop. No new instrumentation: this only parses the userAgent
// we already store on every FileTimeSession row.
//
// Best-effort UA sniffing. Known blind spot: modern iPad Safari defaults to
// "desktop mode" and reports a Macintosh UA, so some tablet use is counted as
// desktop. Good enough for a "which way do they lean" read, not forensics.

export type DeviceClass = "mobile" | "desktop" | "unknown";

// Covers phones and tablets (touch-first usage) — everything else is desktop.
// "Mobi" catches both "Mobi" and "Mobile" tokens; the named platforms cover the
// cases that omit it.
const MOBILE_RE = /Android|iPhone|iPad|iPod|Windows Phone|IEMobile|BlackBerry|Opera Mini|Mobi/i;

export function classifyDevice(ua: string | null | undefined): DeviceClass {
  if (!ua || !ua.trim()) return "unknown";
  return MOBILE_RE.test(ua) ? "mobile" : "desktop";
}
