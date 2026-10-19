"use client";

import { useTransition } from "react";
import { startViewAsAction } from "@/app/actions/view-as";

// Command Centre → Agency File: "View as" an agency user. Drops the founder into
// the agent app seeing exactly what that agent sees (read-only). Starting is a
// POST server action, allowed because the view-as cookie isn't set yet; the exit
// is a GET route (middleware blocks POSTs once viewing-as).
export function ViewAsButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => { void startViewAsAction(userId); })}
      className="text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
    >
      {pending ? "Opening…" : "View as"}
    </button>
  );
}
