"use client";

// Silent freshness keeper for the Automated-emails page: re-pulls the numbers
// every two minutes while the tab is visible (truth pass 2026-10-21 — a page
// left open went stale silently). router.refresh() re-runs the server
// component, so every figure on the page updates together. Renders nothing:
// the visible "Updated HH:MM" stamp was cut on founder feedback 2026-10-21.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ intervalMs = 120_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
