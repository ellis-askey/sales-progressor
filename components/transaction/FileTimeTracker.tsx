"use client";

import { useFileTimeTracking } from "@/lib/hooks/useFileTimeTracking";

export function FileTimeTracker({ transactionId }: { transactionId: string }) {
  useFileTimeTracking(transactionId);
  return null;
}
