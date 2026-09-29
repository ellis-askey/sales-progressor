// Robust clipboard copy (critique #9, 2026-09-29).
//
// navigator.clipboard.writeText rejects intermittently — most often when it's
// awaited AFTER an async gap (the user-gesture "transient activation" has
// expired), when the document isn't focused, or outside a secure context. That's
// the "sometimes copy fails" symptom. Fall back to the legacy hidden-textarea +
// execCommand("copy"), which tolerates those cases. Returns true on success so
// the caller can decide what to show.
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof window !== "undefined" && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
