"use client";

// Renders nothing. Marks the notification bell read when the Updates page is
// viewed, so reading your updates clears the bell (previously only clicking the
// bell itself cleared it). Fire-and-forget: a failure just leaves the bell as-is
// and the next poll reconciles it.

import { useEffect } from "react";
import { markAgentBellReadAction } from "@/app/actions/agent-preferences";

export function MarkBellReadOnView() {
  useEffect(() => {
    markAgentBellReadAction().catch(() => {});
  }, []);
  return null;
}
