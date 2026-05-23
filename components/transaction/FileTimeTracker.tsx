"use client";

import { useFileTimeTracking } from "@/lib/hooks/useFileTimeTracking";

// When the file is on hold, we don't open a new file-time session and don't
// keep an existing one running. Time spent looking at a paused file
// shouldn't count toward "time on file" for billing / median purposes.
export function FileTimeTracker({
  transactionId,
  isOnHold,
}: {
  transactionId: string;
  isOnHold?: boolean;
}) {
  useFileTimeTracking(isOnHold ? null : transactionId);
  return null;
}
