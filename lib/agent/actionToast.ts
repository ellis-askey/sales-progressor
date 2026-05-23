// lib/agent/actionToast.ts
// Wraps a server action (or fetch POST) so unhandled throws surface as
// toast.error() instead of vanishing into the console. Use this around any
// action whose failure isn't otherwise visible to the user.
//
// Usage:
//   const { toast } = useAgentToast();
//   const result = await withErrorToast(
//     toast,
//     () => deleteCommAction(noteId, pathname),
//     "Couldn't delete note — try again",
//   );
//   if (result === null) return; // failure already surfaced
//
// The error's own message is preferred when it's short enough to read
// inline; otherwise the fallback is used. Server-action error messages
// are typically prepared for user consumption (e.g. "Transaction not
// found"); the length cap protects against stack-trace strings leaking.

import type { useAgentToast } from "@/components/agent/AgentToaster";

type Toast = ReturnType<typeof useAgentToast>["toast"];

export async function withErrorToast<T>(
  toast: Toast,
  action: () => Promise<T>,
  fallback: string,
): Promise<T | null> {
  try {
    return await action();
  } catch (err) {
    const msg = err instanceof Error ? err.message : null;
    toast.error(msg && msg.length > 0 && msg.length < 80 ? msg : fallback);
    return null;
  }
}
