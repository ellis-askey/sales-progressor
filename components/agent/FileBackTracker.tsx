"use client";

// Mounted once in the agent layout. Watches client-side navigation and, each
// time you enter a NEW file, records the path you were on just before — so the
// file hero's "Back" can return you there even when the link didn't add an
// explicit ?from= (reminders, Focus, search, recently-viewed, anywhere).
// Renders nothing. See lib/agent/back-nav.ts for how the hero consumes it.

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { fileIdFromPath, recordFileOrigin, readFileOrigin } from "@/lib/agent/back-nav";

export function FileBackTracker() {
  const pathname = usePathname();
  const prev = useRef<string | null>(null);

  useEffect(() => {
    const from = prev.current;
    const currentFile = fileIdFromPath(pathname);
    if (currentFile && from) {
      const fromFileId = fileIdFromPath(from);
      // Only when ARRIVING at a different file than we were on — an in-file tab
      // switch (same id) must not overwrite the real origin.
      if (fromFileId !== currentFile) {
        // Don't create a mutual back-pointer. If the file we came FROM already
        // points back to THIS file, recording the reverse makes the two bounce
        // between each other forever (the "Back loops between two properties"
        // critique). Keep this file's existing, deeper origin so Back escapes to
        // where you actually started (hub / list / enquiries …).
        const fromPointsBackHere =
          fromFileId != null && fileIdFromPath(readFileOrigin(fromFileId)) === currentFile;
        if (!fromPointsBackHere) recordFileOrigin(currentFile, from);
      }
    }
    prev.current = pathname;
  }, [pathname]);

  return null;
}
