"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PortalAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    function refresh() { router.refresh(); }
    function handleVisibility() { if (document.visibilityState === "visible") refresh(); }

    // Refresh when the tab/app regains visibility — catches the common case
    // where a client receives a push notification, switches to the portal,
    // and expects to see the latest data without manually reloading.
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", refresh);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  return null;
}
