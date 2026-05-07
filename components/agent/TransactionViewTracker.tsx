"use client";

import { useEffect } from "react";
import * as analytics from "@/lib/analytics/posthog";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

export function TransactionViewTracker({ transactionId }: { transactionId: string }) {
  useEffect(() => {
    analytics.track(ANALYTICS_EVENTS.TRANSACTION_VIEWED, { transactionId });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  return null;
}
