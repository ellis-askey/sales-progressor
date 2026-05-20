"use client";

import { useEffect } from "react";
import * as analytics from "@/lib/analytics/posthog";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { trackView } from "@/lib/agent/use-recently-viewed";

export function TransactionViewTracker({ transactionId, propertyAddress, userId }: { transactionId: string; propertyAddress: string; userId: string }) {
  useEffect(() => {
    analytics.track(ANALYTICS_EVENTS.TRANSACTION_VIEWED, { transactionId });
    trackView(transactionId, propertyAddress, userId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  return null;
}
