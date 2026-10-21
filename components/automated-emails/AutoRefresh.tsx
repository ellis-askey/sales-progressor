"use client";

// Quiet freshness line for the Automated-emails page: shows when the numbers
// were last loaded and re-pulls them every two minutes while the tab is
// visible (truth pass 2026-10-21 — a page left open went stale silently, with
// no way to tell). router.refresh() re-runs the server component, so every
// figure on the page updates together.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

export function AutoRefresh({ intervalMs = 120_000 }: { intervalMs?: number }) {
  const router = useRouter();
  // Stamped on mount and after each refresh — client-only so it can't cause a
  // server/client hydration mismatch.
  const [stamp, setStamp] = useState<string | null>(null);

  useEffect(() => {
    setStamp(fmt.format(new Date()));
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setStamp(fmt.format(new Date()));
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs]);

  if (!stamp) return null;
  return (
    <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)", whiteSpace: "nowrap" }}>
      Updated {stamp} · refreshes itself
    </span>
  );
}
