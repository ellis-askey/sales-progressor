"use client";

import { useEffect } from "react";
import * as analytics from "@/lib/analytics/posthog";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

export function HubViewTracker({
  activeCount,
  attentionCount,
}: {
  activeCount: number;
  attentionCount: number;
}) {
  useEffect(() => {
    analytics.track(ANALYTICS_EVENTS.PAGE_VIEW_HUB, { activeCount, attentionCount });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
